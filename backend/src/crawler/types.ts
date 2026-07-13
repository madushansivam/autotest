/**
 * crawler/types.ts — Type definitions for the Playwright-based crawler.
 *
 * The InterfaceMap is the canonical data structure that flows through
 * the entire pipeline: crawler → generator → executor.
 */

export type ElementType =
  | 'button'
  | 'input'
  | 'link'
  | 'form'
  | 'select'
  | 'textarea'
  | 'heading';

export interface ElementDescriptor {
  type: ElementType;
  /** Visible text content */
  text?: string;
  /** input placeholder or aria-placeholder */
  placeholder?: string;
  /** name attribute */
  name?: string;
  /** id attribute */
  id?: string;
  /** aria-label attribute */
  ariaLabel?: string;
  /** First few CSS classes (not the full class string) */
  className?: string;
  /** For links: the href value */
  href?: string;
  /** For inputs: the input type (text, email, password, etc.) */
  inputType?: string;
  /** For forms: the action attribute */
  formAction?: string;
  /** For forms: the method attribute */
  formMethod?: string;
  /**
   * Whether the safety filter considers this element safe to interact with.
   * false = blocked by the safe-mode blocklist; the generator will be
   * instructed to avoid generating scripts for these elements.
   */
  safe: boolean;
  /** Reason for blocking, if safe === false */
  blockedReason?: string;
}

export interface PageSnapshot {
  url: string;
  title: string;
  elements: ElementDescriptor[];
  /** HTTP status code returned when loading this page */
  httpStatus?: number;
}

export interface InterfaceMap {
  /** The base URL that was submitted by the user */
  baseUrl: string;
  pages: PageSnapshot[];
  crawledAt: string;
  /** Total number of elements across all pages (convenience field for generator prompts) */
  totalElements: number;
}
