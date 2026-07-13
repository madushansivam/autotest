/**
 * Evaluation fixture definitions.
 *
 * Each EvalSite describes a target URL and its human-authored
 * ground-truth test cases. These are the reference cases used to
 * compute recall, precision, and false-positive rate in run-eval.ts.
 *
 * Ground-truth cases were authored manually by inspecting each site.
 * They are NOT AI-generated and represent what a human QA engineer
 * would consider the minimal set of meaningful tests for each site.
 */
import { todoMvcGroundTruth } from './ground-truth/todomvc';
import { theInternetGroundTruth } from './ground-truth/the-internet';
import { quotesToScrapeGroundTruth } from './ground-truth/quotes-toscrape';
import { demoqaGroundTruth } from './ground-truth/demoqa';

export type ConfidenceTag = 'structural' | 'behavioral' | 'unvalidated';

export interface GroundTruthCase {
  id: string;
  description: string;
  confidence: ConfidenceTag;
  /** CSS selector or description of the primary element being tested */
  targetElement: string;
  /** Type of action being tested */
  actionType:
    | 'existence'
    | 'existence_conditional'
    | 'click'
    | 'double_click'
    | 'input_and_submit'
    | 'navigation';
  expectedOutcome: string;
}

export interface EvalSite {
  id: string;
  name: string;
  url: string;
  groundTruth: GroundTruthCase[];
}

export const EVAL_SITES: EvalSite[] = [
  {
    id: 'todomvc',
    name: 'TodoMVC React',
    url: 'https://todomvc.com/examples/react/dist/',
    groundTruth: todoMvcGroundTruth,
  },
  {
    id: 'the-internet',
    name: 'The Internet (Heroku)',
    url: 'https://the-internet.herokuapp.com/',
    groundTruth: theInternetGroundTruth,
  },
  {
    id: 'quotes-toscrape',
    name: 'Quotes to Scrape',
    url: 'https://quotes.toscrape.com/',
    groundTruth: quotesToScrapeGroundTruth,
  },
  {
    id: 'demoqa',
    name: 'DemoQA',
    url: 'https://demoqa.com/',
    groundTruth: demoqaGroundTruth,
  },
];
