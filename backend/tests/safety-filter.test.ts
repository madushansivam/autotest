import { shouldSkipScript } from '../src/executor/safety-filter';

describe('shouldSkipScript — Layer 1 text blocklist', () => {
  const blockedDescriptions = [
    'Click the delete account button',
    'Submit the checkout form',
    'Click pay now button',
    'Confirm payment on the page',
    'Click cancel subscription link',
  ];

  test.each(blockedDescriptions)('blocks: %s', (description) => {
    const result = shouldSkipScript(description, '');
    expect(result.skip).toBe(true);
    expect(result.reason).toContain('blocklist');
  });

  const safeDescriptions = [
    'Click the submit button for the contact form',
    'Verify the login form is visible',
    'Check navigation links exist',
  ];

  test.each(safeDescriptions)('allows: %s', (description) => {
    const result = shouldSkipScript(description, '');
    // May still be blocked by Layer 2, but Layer 1 alone should pass these
    if (result.skip) {
      // If it was blocked, it must be Layer 2, not Layer 1
      expect(result.reason).not.toContain('blocklist');
    }
  });
});

describe('shouldSkipScript — Layer 2 mutation heuristic', () => {
  test('blocks POST to payment route', () => {
    const script = `
      await page.locator('form[action="/payment"]').fill('data');
      await page.locator('form[action="/payment"]').evaluate(f => f.submit());
    `;
    const result = shouldSkipScript('Submit payment form', script);
    expect(result.skip).toBe(true);
  });

  test('blocks form submission to account-deletion route', () => {
    const script = `await page.locator('form[action="/delete-account"]').evaluate(f => f.submit());`;
    const result = shouldSkipScript('Delete user account', script);
    expect(result.skip).toBe(true);
  });

  test('does not block read-only form interaction', () => {
    const script = `
      await page.locator('input[name="search"]').fill('test query');
      await page.locator('button[type="submit"]').click();
    `;
    const result = shouldSkipScript('Search for test query', script);
    // Should not be blocked by Layer 2 (GET search is not a state-changing mutation)
    expect(result.skip).toBe(false);
  });
});
