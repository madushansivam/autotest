/**
 * ssrf-guard.test.ts
 *
 * Table-driven unit tests for the SSRF guard module.
 * These tests mock DNS resolution to avoid actual network calls,
 * making the suite fast and deterministic.
 */
import { validateTargetUrl, SsrfBlockedError } from '../src/lib/ssrf-guard';
import dns from 'dns';

// Mock the dns module so tests don't make real network calls
jest.mock('dns', () => ({
  promises: {
    resolve4: jest.fn(),
    resolve6: jest.fn(),
    lookup: jest.fn(),
  },
}));

const mockResolve4 = dns.promises.resolve4 as jest.MockedFunction<typeof dns.promises.resolve4>;
const mockResolve6 = dns.promises.resolve6 as jest.MockedFunction<typeof dns.promises.resolve6>;
const mockLookup = dns.promises.lookup as jest.MockedFunction<typeof dns.promises.lookup>;

function mockDnsResolves(ipv4: string[], ipv6: string[] = []): void {
  mockResolve4.mockResolvedValue(ipv4 as unknown as string[]);
  mockResolve6.mockResolvedValue(ipv6 as unknown as string[]);
  mockLookup.mockResolvedValue(
    [...ipv4, ...ipv6].map((address) => ({
      address,
      family: address.includes(':') ? 6 : 4,
    })) as unknown as { address: string; family: number }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('validateTargetUrl — scheme checks', () => {
  const blockedSchemes = [
    'file:///etc/passwd',
    'ftp://example.com/file',
    'javascript:alert(1)',
    'gopher://example.com',
    'data:text/html,<h1>xss</h1>',
    'ldap://example.com',
  ];

  test.each(blockedSchemes)('blocks non-http/https scheme: %s', async (url) => {
    await expect(validateTargetUrl(url, [])).rejects.toThrow(SsrfBlockedError);
  });

  test('accepts http scheme with valid public IP', async () => {
    mockDnsResolves(['93.184.216.34']); // example.com
    await expect(validateTargetUrl('http://example.com', [])).resolves.toBeUndefined();
  });

  test('accepts https scheme with valid public IP', async () => {
    mockDnsResolves(['93.184.216.34']);
    await expect(validateTargetUrl('https://example.com', [])).resolves.toBeUndefined();
  });
});

describe('validateTargetUrl — hostname blocklist', () => {
  test('blocks localhost', async () => {
    await expect(validateTargetUrl('http://localhost/admin', [])).rejects.toThrow(SsrfBlockedError);
  });

  test('blocks configured internal domain', async () => {
    await expect(
      validateTargetUrl('http://internal.example.com', ['internal.example.com'])
    ).rejects.toThrow(SsrfBlockedError);
  });

  test('blocks subdomain of configured internal domain', async () => {
    await expect(
      validateTargetUrl('http://api.internal.example.com', ['internal.example.com'])
    ).rejects.toThrow(SsrfBlockedError);
  });

  test('does not block unrelated domain', async () => {
    mockDnsResolves(['93.184.216.34']);
    await expect(
      validateTargetUrl('https://example.com', ['internal.example.com'])
    ).resolves.toBeUndefined();
  });
});

describe('validateTargetUrl — IPv4 range checks', () => {
  const blockedIPs: Array<[string, string]> = [
    ['127.0.0.1', 'loopback'],
    ['127.0.0.254', 'loopback range'],
    ['10.0.0.1', 'private class-A'],
    ['10.255.255.255', 'private class-A boundary'],
    ['172.16.0.1', 'private class-B'],
    ['172.31.255.255', 'private class-B boundary'],
    ['172.16.100.50', 'private class-B middle'],
    ['192.168.0.1', 'private class-C'],
    ['192.168.255.255', 'private class-C boundary'],
    ['169.254.169.254', 'AWS metadata endpoint'],
    ['169.254.0.1', 'link-local'],
    ['0.0.0.0', 'this-network'],
    ['100.64.0.1', 'shared address space'],
  ];

  test.each(blockedIPs)('blocks %s (%s)', async (ip) => {
    mockDnsResolves([ip]);
    await expect(validateTargetUrl('https://evil.com', [])).rejects.toThrow(SsrfBlockedError);
  });

  const allowedPublicIPs: Array<[string, string]> = [
    ['8.8.8.8', 'Google DNS'],
    ['93.184.216.34', 'example.com'],
    ['1.1.1.1', 'Cloudflare DNS'],
    ['172.15.255.255', 'just below class-B private'],
    ['172.32.0.0', 'just above class-B private'],
  ];

  test.each(allowedPublicIPs)('allows %s (%s)', async (ip) => {
    mockDnsResolves([ip]);
    await expect(validateTargetUrl('https://example.com', [])).resolves.toBeUndefined();
  });
});

describe('validateTargetUrl — IPv6 checks', () => {
  test('blocks IPv6 loopback ::1', async () => {
    mockDnsResolves([], ['::1']);
    await expect(validateTargetUrl('https://evil.com', [])).rejects.toThrow(SsrfBlockedError);
  });

  test('blocks IPv6 link-local fe80::1', async () => {
    mockDnsResolves([], ['fe80::1']);
    await expect(validateTargetUrl('https://evil.com', [])).rejects.toThrow(SsrfBlockedError);
  });

  test('blocks IPv6 unique-local fc00::1', async () => {
    mockDnsResolves([], ['fc00::1']);
    await expect(validateTargetUrl('https://evil.com', [])).rejects.toThrow(SsrfBlockedError);
  });
});

describe('validateTargetUrl — DNS rebinding', () => {
  test('blocks URL whose public-looking hostname resolves to 127.0.0.1', async () => {
    // This is the DNS rebinding scenario: hostname looks public but resolves internally
    mockDnsResolves(['127.0.0.1']);
    await expect(
      validateTargetUrl('https://public-looking-domain.com', [])
    ).rejects.toThrow(SsrfBlockedError);
  });

  test('blocks URL that resolves to cloud metadata endpoint', async () => {
    mockDnsResolves(['169.254.169.254']);
    await expect(
      validateTargetUrl('https://notmetadata.com', [])
    ).rejects.toThrow(SsrfBlockedError);
  });
});

describe('validateTargetUrl — URL format', () => {
  test('blocks invalid URL format', async () => {
    await expect(validateTargetUrl('not-a-url', [])).rejects.toThrow(SsrfBlockedError);
  });

  test('blocks empty string', async () => {
    await expect(validateTargetUrl('', [])).rejects.toThrow(SsrfBlockedError);
  });
});
