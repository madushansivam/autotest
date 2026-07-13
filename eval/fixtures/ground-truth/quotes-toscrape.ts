/**
 * Human-authored ground-truth test cases for Quotes to Scrape.
 * URL: https://quotes.toscrape.com/
 *
 * A static content site with a simple structure, useful for testing
 * that AutoTest generates structural tests for content-heavy pages.
 */
import type { GroundTruthCase } from '../index';

export const quotesToScrapeGroundTruth: GroundTruthCase[] = [
  {
    id: 'quotes-01',
    description: 'Quote cards are visible on the homepage',
    confidence: 'structural',
    targetElement: '.quote',
    actionType: 'existence',
    expectedOutcome: 'At least one element with class "quote" is visible on the page',
  },
  {
    id: 'quotes-02',
    description: 'Each quote card contains the quote text',
    confidence: 'structural',
    targetElement: '.quote .text',
    actionType: 'existence',
    expectedOutcome: 'Element with class "text" is present inside each quote card',
  },
  {
    id: 'quotes-03',
    description: 'Each quote card shows the author name',
    confidence: 'structural',
    targetElement: '.quote .author',
    actionType: 'existence',
    expectedOutcome: 'Element with class "author" is present inside each quote card',
  },
  {
    id: 'quotes-04',
    description: 'A navigation link to the next page is present',
    confidence: 'structural',
    targetElement: '.next a',
    actionType: 'existence',
    expectedOutcome: 'An anchor link labelled "Next" or similar is visible',
  },
  {
    id: 'quotes-05',
    description: 'Clicking the "Next" link navigates to page 2',
    confidence: 'behavioral',
    targetElement: '.next a',
    actionType: 'click',
    expectedOutcome: 'URL changes to /page/2/ and quote cards are still visible',
  },
  {
    id: 'quotes-06',
    description: 'The login link is present in the top navigation',
    confidence: 'structural',
    targetElement: 'a[href="/login"]',
    actionType: 'existence',
    expectedOutcome: 'An anchor link pointing to /login is visible in the navigation',
  },
];
