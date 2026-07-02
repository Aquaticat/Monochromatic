/**
 * Client-side entry point for the wc text-stats tool.
 *
 * Debounces the input textarea, then recomputes and renders the stat
 * tiles and the Frequency rows on every settled change. Also auto-grows
 * the textarea to its content (`field-sizing: content` is missing from
 * the Firefox ESR baseline, so the growth is scripted).
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import { STAT_FIELDS, } from '../page.ts';
import {
  analyzeText,
  computeFrequency,
  splitWords,
  type FrequencyEntry,
  type TextStats,
} from '../stats/index.ts';

/**
 * Idle period after the last keystroke before stats/frequency recompute.
 */
const STATS_DEBOUNCE_MS = 150;

/**
 * Figure space (U+2007): a digit-width space in tabular-numeral context,
 * used to pad frequency numbers so columns align with no column-width
 * CSS. Retained in the Inter subset via `src/subset-fonts.ts`.
 */
const FIGURE_SPACE = ' ';

/**
 * Grouping formatter for tile headline values ("7,801"). Locale pinned
 * to `en-US` so the group separator stays inside the Inter subset's
 * charset (other locales separate with code points the subset lacks).
 */
const countFormat = new Intl.NumberFormat('en-US',);

/**
 * Writes every {@link STAT_FIELDS} pairing from stats into its DOM
 * element, formatted with {@link countFormat}.
 *
 * @param stats - aggregate statistics to render
 */
function renderStats(stats: TextStats,): void {
  for (const {
    id,
    key,
  } of STAT_FIELDS) {
    /**
     * Stat display element for the current pairing, or `null` when
     * absent.
     */
    const element = document.querySelector<HTMLElement>(`#${id}`,);

    if (element !== null) {
      element.textContent = countFormat.format(stats[key],);
    }
  }
}

/**
 * Renders one Frequency row: count, percentage, word, and a
 * proportional bar, with count and percentage figure-space padded to
 * the widths of the top entry so tabular numerals align.
 *
 * @param entry - frequency row to render
 *
 * @param countWidth - character width counts are padded to
 *
 * @param pctWidth - character width percentage strings are padded to
 *
 * @param maxCount - top entry's count, the 100%-width bar reference
 *
 * @returns HTML string for the row
 */
function renderFrequencyRow(
  {
    entry,
    countWidth,
    pctWidth,
    maxCount,
  }: Readonly<{
    entry: FrequencyEntry;
    countWidth: number;
    pctWidth: number;
    maxCount: number;
  }>,
): string {
  /**
   * Bar inline size as a percentage of the fixed-width track, relative
   * to the most frequent word.
   */
  const barPercent = ((entry.count / maxCount) * 100)
    .toFixed(1,);

  return h(
    {
      tag: 'div',
      class: 'frequency-row',
      attrs: {
        role: 'row',
        style: `--bar:${barPercent}%`,
      },
      children: [
        h(
          {
            tag: 'span',
            class: 'freq-count',
            attrs: { role: 'cell', },
            text: String(entry.count,)
              .padStart(
                countWidth,
                FIGURE_SPACE,
              ),
          },
        ),
        h(
          {
            tag: 'span',
            class: 'freq-pct',
            attrs: { role: 'cell', },
            text: `${
              entry.percentage
                .toFixed(1,)
            }%`
              .padStart(
                pctWidth,
                FIGURE_SPACE,
              ),
          },
        ),
        h(
          {
            tag: 'span',
            class: 'freq-word',
            attrs: { role: 'cell', },
            text: entry.word,
          },
        ),
        h(
          {
            tag: 'span',
            class: 'freq-bar-track',
            attrs: { role: 'cell', },
            children: [
              h(
                {
                  tag: 'span',
                  class: 'freq-bar',
                  attrs: { 'aria-hidden': 'true', },
                },
              ),
            ],
          },
        ),
      ],
    },
  );
}

/**
 * Column count of the Frequency table, for the placeholder row's
 * `aria-colspan`.
 */
const FREQUENCY_COLUMN_COUNT = 4;

/**
 * Renders the Frequency placeholder row for when no word occurs more
 * than once.
 *
 * @returns HTML string for the placeholder row
 */
function renderEmptyFrequencyRow(): string {
  return h(
    {
      tag: 'div',
      class: 'frequency-row',
      attrs: { role: 'row', },
      children: [
        h(
          {
            tag: 'span',
            class: 'frequency-empty',
            attrs: {
              role: 'cell',
              'aria-colspan': String(FREQUENCY_COLUMN_COUNT,),
            },
            text: 'No repeated words yet.',
          },
        ),
      ],
    },
  );
}

/**
 * Replaces the Frequency body rowgroup with rows for entries, via
 * {@link renderFrequencyRow}, or {@link renderEmptyFrequencyRow} when
 * entries is empty.
 *
 * @param entries - frequency rows to render, sorted by count descending
 */
function renderFrequency(entries: readonly FrequencyEntry[],): void {
  /**
   * Frequency body rowgroup element, or `null` when absent.
   */
  const body = document.querySelector<HTMLElement>('#frequency-body',);

  if (body === null) {
    return;
  }

  if (entries.length === 0) {
    body.innerHTML = renderEmptyFrequencyRow();
    return;
  }

  /**
   * Top entry; entries are sorted by count descending, so it defines
   * the widest count string, the widest percentage string, and the
   * 100%-width bar reference.
   */
  const [top,] = entries;

  if (top === undefined) {
    return;
  }

  /**
   * Character width counts are padded to.
   */
  const countWidth = String(top.count,)
    .length;

  /**
   * Character width percentage strings are padded to.
   */
  const pctWidth = `${
    top.percentage
      .toFixed(1,)
  }%`.length;

  body.innerHTML = entries
    .map(function renderRow(entry,): string {
      return renderFrequencyRow(
        {
          entry,
          countWidth,
          pctWidth,
          maxCount: top.count,
        },
      );
    },)
    .join('',);
}

/**
 * Recomputes and renders every result section for text, via
 * {@link renderStats} and {@link renderFrequency}.
 *
 * @param text - current textarea value
 */
function updateResults(text: string,): void {
  renderStats(analyzeText(text,),);
  renderFrequency(
    computeFrequency(splitWords(text,),),
  );
}

updateResults('',);

/**
 * Grows a textarea to fit its content: resets the scripted minimum so
 * the flex layout can reclaim space after deletions, then raises it to
 * the content's scroll height. The flex stretch keeps the
 * viewport-filling floor, so short content never shrinks the box below
 * the visible page remainder.
 *
 * @param input - textarea to grow
 */
function autoGrow({ input, }: Readonly<{ input: HTMLTextAreaElement; }>,): void {
  /**
   * Style declaration destructured once so member access stays flat.
   */
  const { style, } = input;

  style.minBlockSize = '';

  /**
   * Block-axis border total: `min-block-size` spans borders under
   * `border-box` sizing while `scrollHeight` does not, so growing to
   * bare `scrollHeight` leaves a border-height sliver of internal
   * scroll.
   */
  const borderCompensation = input.offsetHeight - input.clientHeight;

  style.minBlockSize = `${input.scrollHeight + borderCompensation}px`;
}

/**
 * Input textarea the user types or pastes text into.
 */
const textarea = document.querySelector<HTMLTextAreaElement>('#wc-input',);

if (textarea !== null) {
  /**
   * Style declaration destructured once so member access stays flat.
   */
  const { style, } = textarea;

  // Growth tracks content, so the inner scrollbar never has anything
  // to scroll; hiding it here (not in CSS) keeps content reachable if
  // scripting is unavailable.
  style.overflowY = 'hidden';
  autoGrow({ input: textarea, },);

  /**
   * Container for the shared debounce timer handle, so the binding stays
   * `const` while the handle is reassigned on every keystroke.
   */
  const timer: { handle?: ReturnType<typeof setTimeout>; } = {};

  textarea.addEventListener(
    'input',
    function handleInput(): void {
      autoGrow({ input: textarea, },);
      clearTimeout(timer.handle,);
      timer.handle = setTimeout(
        function updateAfterDebounce(): void {
          updateResults(textarea.value,);
        },
        STATS_DEBOUNCE_MS,
      );
    },
  );
}
