/**
 * Alert callout component for MDX.
 *
 * Renders a `<blockquote>` with a `data-type` attribute for styling.
 *
 * @example
 * ```mdx
 * <Alert data-type="note">Important information here.</Alert>
 * ```
 */
import {
  jsx,
  type SafeHtml,
} from '../lib/jsx-to-html.ts';

/** Valid alert type identifiers. */
type AlertType = 'caution' | 'important' | 'note' | 'tip' | 'warning';

/**
 * Renders an alert callout as a semantic blockquote.
 *
 * @param props - component props
 * @param props.data-type - alert type: `note`, `tip`, `important`, `warning`, or `caution`
 * @param props.children - alert content
 *
 * @returns rendered alert HTML
 */
export function Alert(props: { 'children': unknown; 'data-type': AlertType },): SafeHtml {
  return jsx(
    'blockquote',
    {
      'data-type': props['data-type'],
      children: props.children,
    },
  );
}

