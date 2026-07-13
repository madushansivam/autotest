/**
 * crawler/index.ts — Playwright-based BFS site crawler.
 *
 * Accepts an arbitrary target URL and crawls up to `budget` pages,
 * building a structured InterfaceMap that describes every interactive
 * element found. This map is passed to the generator module.
 *
 * Security:
 *  - validateTargetUrl() is called ONCE before any navigation starts
 *    (at API route time) AND AGAIN immediately before each page.goto()
 *    call here. This closes the TOCTOU / DNS-rebinding window.
 *
 * Non-goals:
 *  - No multi-browser support (Chromium only, per project scope).
 *  - No JavaScript-heavy SPA deep-crawling; we follow <a href> links
 *    that stay on the same origin.
 */

import { chromium, type Page, type Browser } from 'playwright';
import { validateTargetUrl } from '../lib/ssrf-guard';
import { isElementSafe } from '../executor/safety-filter';
import type { InterfaceMap, PageSnapshot, ElementDescriptor } from './types';
import { config } from '../config';

const PAGE_LOAD_TIMEOUT = 20_000; // ms — hard cap per navigation
const ACTION_TIMEOUT = 5_000;     // ms — per element interaction

/**
 * Scans a single page and extracts all interactive elements.
 * Does NOT navigate; assumes `page` is already at the target URL.
 */
async function scanPage(page: Page, url: string): Promise<PageSnapshot> {
  const title = await page.title().catch(() => '');

  const elements = await page.evaluate((): Array<{
    type: string; text?: string; placeholder?: string; name?: string;
    id?: string; ariaLabel?: string; className?: string; href?: string;
    inputType?: string; formAction?: string; formMethod?: string;
  }> => {
    const els: Array<Record<string, unknown>> = [];

    // Buttons (including role="button")
    document.querySelectorAll<HTMLElement>('button, [role="button"]').forEach((el) => {
      els.push({
        type: 'button',
        text: (el.textContent ?? '').trim().slice(0, 120),
        ariaLabel: el.getAttribute('aria-label') ?? undefined,
        id: el.id || undefined,
        className: el.className?.toString().split(' ').slice(0, 3).join(' ') || undefined,
      });
    });

    // Inputs
    document.querySelectorAll<HTMLInputElement>('input:not([type="hidden"])').forEach((el) => {
      els.push({
        type: 'input',
        inputType: el.type || 'text',
        name: el.name || undefined,
        id: el.id || undefined,
        placeholder: el.placeholder || undefined,
        ariaLabel: el.getAttribute('aria-label') ?? undefined,
      });
    });

    // Textareas
    document.querySelectorAll<HTMLTextAreaElement>('textarea').forEach((el) => {
      els.push({
        type: 'textarea',
        name: el.name || undefined,
        id: el.id || undefined,
        placeholder: el.placeholder || undefined,
        ariaLabel: el.getAttribute('aria-label') ?? undefined,
      });
    });

    // Selects
    document.querySelectorAll<HTMLSelectElement>('select').forEach((el) => {
      els.push({
        type: 'select',
        name: el.name || undefined,
        id: el.id || undefined,
        ariaLabel: el.getAttribute('aria-label') ?? undefined,
      });
    });

    // Forms
    document.querySelectorAll<HTMLFormElement>('form').forEach((el) => {
      els.push({
        type: 'form',
        id: el.id || undefined,
        name: el.name || undefined,
        formAction: el.action || undefined,
        formMethod: el.method || undefined,
      });
    });

    // Links (same-origin only)
    document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((el) => {
      const href = el.getAttribute('href') ?? '';
      // Skip anchors, javascript:, mailto:, tel:
      if (!href || href.startsWith('#') || href.includes(':')) return;
      els.push({
        type: 'link',
        text: (el.textContent ?? '').trim().slice(0, 80),
        href,
        ariaLabel: el.getAttribute('aria-label') ?? undefined,
      });
    });

    // Headings (h1-h3, useful for structural tests)
    document.querySelectorAll<HTMLHeadingElement>('h1, h2, h3').forEach((el) => {
      els.push({
        type: 'heading',
        text: (el.textContent ?? '').trim().slice(0, 120),
      });
    });

    return els as Array<{
      type: string; text?: string; placeholder?: string; name?: string;
      id?: string; ariaLabel?: string; className?: string; href?: string;
      inputType?: string; formAction?: string; formMethod?: string;
    }>;
  });

  // Apply safety filter to each element
  const annotated: ElementDescriptor[] = elements.map((el) => {
    const label =
      el.text ?? el.ariaLabel ?? el.placeholder ?? el.name ?? el.id ?? '';
    const { safe, reason } = isElementSafe({
      type: el.type as ElementDescriptor['type'],
      label,
      formAction: el.formAction,
      formMethod: el.formMethod,
      inputType: el.inputType,
      name: el.name,
      id: el.id,
    });

    return {
      ...el,
      type: el.type as ElementDescriptor['type'],
      safe,
      blockedReason: safe ? undefined : reason,
    };
  });

  return { url, title, elements: annotated };
}

/**
 * Resolves a relative href to an absolute URL, returning null if it
 * is not on the same origin as baseUrl.
 */
function resolveLink(href: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(href, baseUrl);
    const base = new URL(baseUrl);
    if (resolved.origin !== base.origin) return null;
    // Normalise: drop hash fragment
    resolved.hash = '';
    return resolved.href;
  } catch {
    return null;
  }
}

export interface CrawlOptions {
  /** Hard cap on pages to visit. Defaults to config.MAX_PAGES_PER_RUN */
  budget?: number;
  /** If true, the crawl runs headlessly (default: true) */
  headless?: boolean;
}

/**
 * Crawls the given URL up to `budget` pages and returns an InterfaceMap.
 *
 * @throws {SsrfBlockedError} if the URL fails SSRF validation.
 */
export async function crawl(
  targetUrl: string,
  options: CrawlOptions = {}
): Promise<InterfaceMap> {
  const budget = options.budget ?? config.MAX_PAGES_PER_RUN;
  const headless = options.headless ?? true;

  // First SSRF check — at crawl-entry time
  await validateTargetUrl(targetUrl);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless });

    const context = await browser.newContext({
      userAgent:
        'AutoTest-Crawler/1.0 (Educational research project; not a commercial scraper)',
      javaScriptEnabled: true,
    });

    // Global action timeout for all operations on pages created from this context
    context.setDefaultTimeout(ACTION_TIMEOUT);

    const visited = new Set<string>();
    const queue: string[] = [targetUrl];
    const pages: PageSnapshot[] = [];

    while (queue.length > 0 && visited.size < budget) {
      const url = queue.shift()!;

      // Normalise URL (drop hash)
      const normUrl = (() => {
        try {
          const u = new URL(url);
          u.hash = '';
          return u.href;
        } catch {
          return url;
        }
      })();

      if (visited.has(normUrl)) continue;
      visited.add(normUrl);

      // Second SSRF check — immediately before each navigation (anti-rebinding)
      try {
        await validateTargetUrl(normUrl);
      } catch (e) {
        console.warn(`[crawler] SSRF check failed for ${normUrl}: ${e}. Skipping.`);
        continue;
      }

      const page = await context.newPage();

      try {
        const response = await page.goto(normUrl, {
          waitUntil: 'domcontentloaded',
          timeout: PAGE_LOAD_TIMEOUT,
        });

        const httpStatus = response?.status();
        const snapshot = await scanPage(page, normUrl);
        snapshot.httpStatus = httpStatus ?? undefined;
        pages.push(snapshot);

        // Enqueue discovered same-origin links from this page
        for (const el of snapshot.elements) {
          if (el.type === 'link' && el.href) {
            const resolved = resolveLink(el.href, normUrl);
            if (resolved && !visited.has(resolved) && !queue.includes(resolved)) {
              queue.push(resolved);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[crawler] Failed to load ${normUrl}: ${msg}`);
        // Continue crawling other pages; don't crash the whole run
      } finally {
        await page.close().catch(() => undefined);
      }
    }

    const totalElements = pages.reduce((s, p) => s + p.elements.length, 0);

    return {
      baseUrl: targetUrl,
      pages,
      crawledAt: new Date().toISOString(),
      totalElements,
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
