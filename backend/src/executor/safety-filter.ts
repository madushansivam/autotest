/**
 * executor/safety-filter.ts — Two-layer safety filter for generated scripts.
 *
 * Layer 1 (text blocklist): Fast string-match on the test description.
 *   Source: safe-mode.config.json phrases from the prototype, consolidated here.
 *   Limitation: trivially bypassed by novel phrasing — that's why Layer 2 exists.
 *
 * Layer 2 (mutation heuristic): Inspects the generated script for form
 *   submissions targeting routes that match state-changing mutation patterns
 *   (payment, account deletion, email sending).
 *   Limitation: this is still a heuristic, not a guarantee. True isolation
 *   requires running AutoTest against a staging/sandboxed environment, not
 *   a production site. This is documented in the README limitations section.
 *
 * Neither layer replaces proper test isolation. They are best-effort
 * guardrails to reduce the risk of accidental side effects during testing.
 */

// ── Layer 1: text blocklist ────────────────────────────────────────────────
// Phrases from the prototype's safe-mode.config.json, plus extras.
// Case-insensitive substring match against the test description.
const BLOCKED_BUTTON_TEXT_PHRASES: string[] = [
  'delete account', 'delete my account', 'close account',
  'deactivate account', 'cancel subscription', 'unsubscribe',
  'pay now', 'confirm payment', 'place order', 'checkout',
  'buy now', 'add to basket', 'add to cart', 'add to bag',
  'submit payment', 'delete permanently', 'remove permanently',
  'send email', 'reset password', 'forgot password',
];

// ── Layer 2: mutation route heuristic ─────────────────────────────────────
// Patterns matched against form action URLs in the generated script.
const MUTATION_ROUTE_PATTERNS: RegExp[] = [
  /payment/i,
  /checkout/i,
  /purchase/i,
  /order/i,
  /delete[_-]?account/i,
  /account[_-]?delete/i,
  /account[_-]?removal/i,
  /send[_-]?email/i,
  /email[_-]?send/i,
  /reset[_-]?password/i,
  /password[_-]?reset/i,
  /unsubscribe/i,
  /cancel[_-]?subscription/i,
];

export interface SafetyCheckResult {
  skip: boolean;
  reason?: string;
  layer?: 1 | 2;
}

export interface ElementSafetyInput {
  type: string;
  label: string;
  formAction?: string;
  formMethod?: string;
  inputType?: string;
  name?: string;
  id?: string;
}

/**
 * Layer 1 check on an individual element during crawling.
 * Returns whether it is safe to include in the interface map.
 */
export function isElementSafe(
  el: ElementSafetyInput
): { safe: boolean; reason?: string } {
  const label = (el.label ?? '').toLowerCase();
  const name = (el.name ?? '').toLowerCase();
  const id = (el.id ?? '').toLowerCase();

  // Block known payment/sensitive input field names/ids
  const sensitiveFields = ['cardnumber', 'cvv', 'cvc', 'ccexp', 'creditcard'];
  if (
    el.inputType === 'password' ||
    sensitiveFields.some((f) => name.includes(f) || id.includes(f))
  ) {
    return { safe: false, reason: `Sensitive field: name="${el.name}" id="${el.id}"` };
  }

  // Check button text against Layer 1 blocklist
  for (const phrase of BLOCKED_BUTTON_TEXT_PHRASES) {
    if (label.includes(phrase)) {
      return { safe: false, reason: `Blocked phrase in label: "${phrase}"` };
    }
  }

  return { safe: true };
}

/**
 * Checks whether a generated test script should be skipped before execution.
 *
 * @param description — The test case description
 * @param script — The generated Playwright script body
 */
export function shouldSkipScript(
  description: string,
  script: string
): SafetyCheckResult {
  const descLower = description.toLowerCase();

  // ── Layer 1: description text blocklist ───────────────────────────────
  for (const phrase of BLOCKED_BUTTON_TEXT_PHRASES) {
    if (descLower.includes(phrase)) {
      return {
        skip: true,
        reason: `Description matches blocklist phrase: "${phrase}"`,
        layer: 1,
      };
    }
  }

  // ── Layer 2: form action/mutation heuristic ───────────────────────────
  // Extract form action values from the script (e.g. form[action="/payment"])
  const actionMatches = script.matchAll(/action\s*[=:]\s*["'`]([^"'`]+)["'`]/gi);
  for (const match of actionMatches) {
    const action = match[1];
    for (const pattern of MUTATION_ROUTE_PATTERNS) {
      if (pattern.test(action)) {
        return {
          skip: true,
          // NOTE: This is a heuristic, not a guarantee. A script could still
          // trigger mutations through paths this regex doesn't match.
          // True safety requires running against a sandboxed/staging environment.
          reason: `Script targets a route matching mutation pattern "${pattern.source}" (action: "${action}"). ` +
                  'Mark as behavioral+safe explicitly to override, or run against a sandboxed environment.',
          layer: 2,
        };
      }
    }
  }

  // Also check for form.submit() on pages where the URL looks mutating
  if (/\.submit\(\)|\.dispatchEvent\(/.test(script)) {
    for (const pattern of MUTATION_ROUTE_PATTERNS) {
      if (pattern.test(script)) {
        return {
          skip: true,
          reason: `Script calls form.submit() with content matching mutation pattern "${pattern.source}".`,
          layer: 2,
        };
      }
    }
  }

  return { skip: false };
}
