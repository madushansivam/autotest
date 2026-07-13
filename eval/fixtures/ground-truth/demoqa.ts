/**
 * Human-authored ground-truth test cases for DemoQA.
 * URL: https://demoqa.com/
 *
 * A QA practice site with various widget types. Cases focus on the
 * homepage category navigation structure.
 */
import type { GroundTruthCase } from '../index';

export const demoqaGroundTruth: GroundTruthCase[] = [
  {
    id: 'demoqa-01',
    description: 'Category cards are visible on the homepage',
    confidence: 'structural',
    targetElement: '.card.mt-4',
    actionType: 'existence',
    expectedOutcome: 'At least one category card is visible on the homepage',
  },
  {
    id: 'demoqa-02',
    description: 'The "Elements" category card is present',
    confidence: 'structural',
    targetElement: '.card-body h5',
    actionType: 'existence',
    expectedOutcome: 'A heading containing "Elements" is visible in a card',
  },
  {
    id: 'demoqa-03',
    description: 'Clicking the "Forms" category card navigates to the forms section',
    confidence: 'behavioral',
    targetElement: '.card-body h5',
    actionType: 'click',
    expectedOutcome: 'URL changes to a section-specific path and category-specific content loads',
  },
  {
    id: 'demoqa-04',
    description: 'The page title is "DEMOQA"',
    confidence: 'structural',
    targetElement: 'head title',
    actionType: 'existence',
    expectedOutcome: 'Document title contains "DEMOQA"',
  },
];
