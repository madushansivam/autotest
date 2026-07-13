/**
 * ssrf-guard.ts — SSRF protection for user-submitted URLs.
 *
 * AutoTest accepts a user-submitted URL and makes server-side HTTP
 * requests + drives a real browser against it. Without this guard,
 * a malicious user could target internal services, cloud metadata
 * endpoints (169.254.169.254), or localhost.
 *
 * Protection layers implemented:
 *  1. Scheme allowlist (http/https only)
 *  2. Hostname blocklist (localhost + configurable internal domains)
 *  3. DNS resolution to actual IP address
 *  4. IP address checked against all private/reserved CIDR ranges
 *
 * TOCTOU / DNS-rebinding defence:
 *  Call validateTargetUrl() twice:
 *   - Once at request-validation time (in the API route handler)
 *   - Again immediately before each page.goto() call in the crawler
 *  This closes the gap where a hostname resolves to a public IP at
 *  validation time, then resolves to a private IP a few seconds later.
 *
 * This module has no side effects and is fully unit-testable in
 * isolation. See tests/ssrf-guard.test.ts for the test suite.
 */

import { promises as dns } from 'dns';
import { config } from '../config';

// ─── CIDR helpers ────────────────────────────────────────────────────────────

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) throw new Error(`Not a valid IPv4: ${ip}`);
  return parts.reduce((acc, octet) => {
    const n = parseInt(octet, 10);
    if (isNaN(n) || n < 0 || n > 255) throw new Error(`Invalid octet in IPv4: ${ip}`);
    return (acc * 256 + n) >>> 0;
  }, 0) >>> 0;
}

interface Cidr4 {
  network: number;
  mask: number;
  label: string;
}

function parseCidr4(cidr: string, label: string): Cidr4 {
  const [addr, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr, 10);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  const network = (ipv4ToInt(addr) & mask) >>> 0;
  return { network, mask, label };
}

const BLOCKED_IPV4_RANGES: Cidr4[] = [
  parseCidr4('0.0.0.0/8',         'this-network (RFC 1122)'),
  parseCidr4('10.0.0.0/8',        'private class-A (RFC 1918)'),
  parseCidr4('100.64.0.0/10',     'shared address space (RFC 6598)'),
  parseCidr4('127.0.0.0/8',       'loopback (RFC 1122)'),
  parseCidr4('169.254.0.0/16',    'link-local / cloud metadata (RFC 3927)'),
  parseCidr4('172.16.0.0/12',     'private class-B (RFC 1918)'),
  parseCidr4('192.0.0.0/24',      'IETF protocol assignments (RFC 6890)'),
  parseCidr4('192.168.0.0/16',    'private class-C (RFC 1918)'),
  parseCidr4('198.18.0.0/15',     'benchmarking (RFC 2544)'),
  parseCidr4('198.51.100.0/24',   'documentation TEST-NET-2 (RFC 5737)'),
  parseCidr4('203.0.113.0/24',    'documentation TEST-NET-3 (RFC 5737)'),
  parseCidr4('240.0.0.0/4',       'reserved (RFC 1112)'),
  parseCidr4('255.255.255.255/32','broadcast'),
];

function isBlockedIPv4(ip: string): { blocked: boolean; reason?: string } {
  let ipInt: number;
  try {
    ipInt = ipv4ToInt(ip);
  } catch {
    return { blocked: true, reason: `Could not parse IPv4 address: ${ip}` };
  }

  for (const range of BLOCKED_IPV4_RANGES) {
    if ((ipInt & range.mask) >>> 0 === range.network) {
      return { blocked: true, reason: `IP ${ip} is in blocked range: ${range.label}` };
    }
  }
  return { blocked: false };
}

function isBlockedIPv6(ip: string): { blocked: boolean; reason?: string } {
  const lower = ip.toLowerCase().replace(/^::ffff:/, ''); // strip IPv4-mapped prefix

  // Loopback
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') {
    return { blocked: true, reason: `IPv6 loopback: ${ip}` };
  }
  // Unspecified
  if (lower === '::' || lower === '0:0:0:0:0:0:0:0') {
    return { blocked: true, reason: `IPv6 unspecified: ${ip}` };
  }
  // Link-local fe80::/10
  if (/^fe[89ab]/i.test(lower)) {
    return { blocked: true, reason: `IPv6 link-local: ${ip}` };
  }
  // Unique local fc00::/7
  if (/^f[cd]/i.test(lower)) {
    return { blocked: true, reason: `IPv6 unique-local (ULA): ${ip}` };
  }
  // IPv4-mapped loopback / private (handled by recursing as IPv4)
  if (/^::ffff:/i.test(ip)) {
    const v4 = ip.replace(/^::ffff:/i, '');
    return isBlockedIPv4(v4);
  }

  return { blocked: false };
}

// ─── Main exported validator ──────────────────────────────────────────────────

export class SsrfBlockedError extends Error {
  constructor(public readonly reason: string) {
    super(`SSRF blocked: ${reason}`);
    this.name = 'SsrfBlockedError';
  }
}

/**
 * Validates a user-submitted URL against SSRF attack vectors.
 *
 * @throws {SsrfBlockedError} if the URL is potentially dangerous.
 * @throws {Error} if DNS resolution fails.
 */
export async function validateTargetUrl(
  rawUrl: string,
  internalDomainBlocklist: string[] = config.INTERNAL_DOMAIN_BLOCKLIST
): Promise<void> {
  // ── 1. Parse URL ─────────────────────────────────────────────────
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError(`Invalid URL format: "${rawUrl}"`);
  }

  // ── 2. Scheme allowlist ──────────────────────────────────────────
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new SsrfBlockedError(
      `Scheme "${parsed.protocol}" is not allowed. Only http and https are permitted.`
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // ── 3. Hostname string blocklist ─────────────────────────────────
  if (hostname === 'localhost') {
    throw new SsrfBlockedError('Hostname "localhost" is not allowed.');
  }

  for (const blocked of internalDomainBlocklist) {
    const lower = blocked.toLowerCase();
    // Match exact hostname or any subdomain of the blocked domain
    if (hostname === lower || hostname.endsWith(`.${lower}`)) {
      throw new SsrfBlockedError(
        `Hostname "${hostname}" matches internal domain blocklist entry "${blocked}".`
      );
    }
  }

  // ── 4. DNS resolution ────────────────────────────────────────────
  // Resolve to actual IPs to prevent DNS rebinding attacks.
  // We do NOT trust the hostname string alone — a DNS record could
  // map a public-looking hostname to a private IP.
  let addresses: string[];
  try {
    // lookup returns only one address by default; use lookupAll / resolve
    // for thoroughness. We resolve both A (IPv4) and AAAA (IPv6) records.
    const results = await Promise.allSettled([
      dns.resolve4(hostname).catch(() => [] as string[]),
      dns.resolve6(hostname).catch(() => [] as string[]),
    ]);

    const v4 = results[0].status === 'fulfilled' ? results[0].value : [];
    const v6 = results[1].status === 'fulfilled' ? results[1].value : [];
    addresses = [...v4, ...v6];

    if (addresses.length === 0) {
      // Fallback to lookup if resolve returns nothing (e.g. /etc/hosts entries)
      const fallback = await dns.lookup(hostname, { all: true });
      addresses = fallback.map((e) => e.address);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new SsrfBlockedError(`DNS resolution failed for "${hostname}": ${msg}`);
  }

  if (addresses.length === 0) {
    throw new SsrfBlockedError(`No DNS records found for "${hostname}".`);
  }

  // ── 5. IP range checks ───────────────────────────────────────────
  for (const ip of addresses) {
    const isV6 = ip.includes(':');
    const check = isV6 ? isBlockedIPv6(ip) : isBlockedIPv4(ip);
    if (check.blocked) {
      throw new SsrfBlockedError(check.reason ?? `IP ${ip} is blocked.`);
    }
  }
  // URL passed all checks.
}
