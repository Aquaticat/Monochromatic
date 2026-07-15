/**
 * MDX component registry.
 *
 * Every named export from this barrel is automatically available
 * in MDX content without an import statement. To add a new component,
 * create a `.ts` file in this directory and add an `export` line here.
 *
 * Authors write the capitalized identifier in MDX source
 * (e.g. `<CalloutAlert>`); the component function renders a
 * custom-element-compliant tag in the output HTML
 * (e.g. `<callout-alert data-is>...</callout-alert>`). This split is
 * required because MDX only consults the components map for
 * capitalized tag names; lowercase hyphenated JSX tags compile to
 * raw HTML element strings.
 */
export { CalloutAlert, } from './callout-alert.ts';
export { QuestionCheckbox, } from './question-checkbox.ts';
export { QuestionRadio, } from './question-radio.ts';
export { ShuffleChildren, } from './shuffle-children.ts';
