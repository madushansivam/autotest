/**
 * Human-authored ground-truth test cases for The Internet (Heroku test site).
 * URL: https://the-internet.herokuapp.com/
 *
 * This site is specifically designed for testing tools. Cases focus on
 * the homepage navigation structure.
 */
import type { GroundTruthCase } from '../index';

export const theInternetGroundTruth: GroundTruthCase[] = [
  {
    id: 'internet-01',
    description: 'The page heading reads "Welcome to the Internet"',
    confidence: 'structural',
    targetElement: 'h1',
    actionType: 'existence',
    expectedOutcome: 'h1 element contains the text "Welcome to the-internet"',
  },
  {
    id: 'internet-02',
    description: 'There is a list of available examples on the homepage',
    confidence: 'structural',
    targetElement: '#content ul li a',
    actionType: 'existence',
    expectedOutcome: 'Multiple anchor links are present in the content list',
  },
  {
    id: 'internet-03',
    description: 'Clicking the "Form Authentication" link navigates to the login page',
    confidence: 'behavioral',
    targetElement: 'a[href="/login"]',
    actionType: 'click',
    expectedOutcome: 'URL changes to /login and a login form is visible',
  },
  {
    id: 'internet-04',
    description: 'Clicking the "Checkboxes" link navigates to the checkboxes page',
    confidence: 'behavioral',
    targetElement: 'a[href="/checkboxes"]',
    actionType: 'click',
    expectedOutcome: 'URL changes to /checkboxes and checkbox inputs are visible',
  },
  {
    id: 'internet-05',
    description: 'The footer contains a link to Elemental Selenium',
    confidence: 'structural',
    targetElement: '#page-footer',
    actionType: 'existence',
    expectedOutcome: 'Footer element is present with attribution text',
  },
];
