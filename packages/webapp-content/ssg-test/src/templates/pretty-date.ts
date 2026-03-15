/**
 * Date formatting template.
 *
 * Renders a `<time>` element with a human-readable date string
 * and machine-readable `datetime` attribute.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

/**
 * Renders a date as a `<time>` element with locale-formatted text.
 *
 * @param date - date to render
 *
 * @returns HTML string for the `<time>` element
 *
 * @example
 * ```ts
 * prettyDate(new Date('2022-07-01')) // '<time datetime="...">Jul 01, 2022</time>'
 * ```
 */
export function prettyDate(date: Date,): string {
  const formatted = date.toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  },);

  return h({
    tag: 'time',
    attrs: { datetime: date.toISOString(), },
    text: formatted,
  },);
}
