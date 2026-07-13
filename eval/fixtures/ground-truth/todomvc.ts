/**
 * Human-authored ground-truth test cases for TodoMVC React.
 * URL: https://todomvc.com/examples/react/dist/
 *
 * These cases were written manually by inspecting the live site.
 * They are NOT AI-generated. They serve as the reference set
 * for evaluating AutoTest's recall and precision.
 */
import type { GroundTruthCase } from '../index';

export const todoMvcGroundTruth: GroundTruthCase[] = [
  {
    id: 'todomvc-01',
    description: 'The main todo input field is visible on page load',
    confidence: 'structural',
    targetElement: 'input.new-todo',
    actionType: 'existence',
    expectedOutcome: 'Input element with placeholder "What needs to be done?" is present',
  },
  {
    id: 'todomvc-02',
    description: 'Typing in the todo input and pressing Enter adds a new todo item',
    confidence: 'behavioral',
    targetElement: 'input.new-todo',
    actionType: 'input_and_submit',
    expectedOutcome: 'A new list item appears in .todo-list with the entered text',
  },
  {
    id: 'todomvc-03',
    description: 'Clicking the checkbox on a todo item marks it as completed',
    confidence: 'behavioral',
    targetElement: '.todo-list li .toggle',
    actionType: 'click',
    expectedOutcome: 'The todo list item receives the class "completed"',
  },
  {
    id: 'todomvc-04',
    description: 'The "All", "Active", and "Completed" filter links are present',
    confidence: 'structural',
    targetElement: '.filters',
    actionType: 'existence',
    expectedOutcome: 'Three filter links are visible in the footer',
  },
  {
    id: 'todomvc-05',
    description: 'Clicking "Active" filter shows only non-completed todos',
    confidence: 'behavioral',
    targetElement: '.filters a[href="#/active"]',
    actionType: 'click',
    expectedOutcome: 'Only todo items without the "completed" class are visible',
  },
  {
    id: 'todomvc-06',
    description: 'The "Clear completed" button appears after completing a todo',
    confidence: 'behavioral',
    targetElement: '.clear-completed',
    actionType: 'existence_conditional',
    expectedOutcome: '"Clear completed" button is visible when at least one todo is completed',
  },
  {
    id: 'todomvc-07',
    description: 'Double-clicking a todo item activates inline editing',
    confidence: 'behavioral',
    targetElement: '.todo-list li label',
    actionType: 'double_click',
    expectedOutcome: 'The todo list item receives the class "editing" and an edit input appears',
  },
];
