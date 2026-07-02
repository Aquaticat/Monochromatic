/**
 * Client-side entry point for the wc text-stats tool.
 *
 * Debounces the input textarea, then recomputes and renders both the Stats
 * section and the Frequency table on every settled change.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import { STAT_ROWS, } from '../page.ts';
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
 * Writes every {@link STAT_ROWS} field from stats into its DOM element.
 *
 * @param stats - aggregate statistics to render
 */
function renderStats(stats: TextStats,): void {
  for (const {
    id,
    key,
  } of STAT_ROWS) {
    /**
     * Stat display element for the current row, or `null` when absent.
     */
    const element = document.querySelector<HTMLElement>(`#${id}`,);

    if (element !== null) {
      element.textContent = String(stats[key],);
    }
  }
}

/**
 * Renders one Frequency table row for a word-frequency entry.
 *
 * @param entry - frequency row to render
 *
 * @returns HTML string for the table row
 */
function renderFrequencyRow(entry: FrequencyEntry,): string {
  return h(
    {
      tag: 'tr',
      children: [
        h(
          {
            tag: 'td',
            text: entry.word,
          },
        ),
        h(
          {
            tag: 'td',
            text: String(entry.count,),
          },
        ),
        h(
          {
            tag: 'td',
            text: `${entry.percentage
              .toFixed(1,)}%`,
          },
        ),
      ],
    },
  );
}

/**
 * Column count {@link renderEmptyFrequencyRow}'s placeholder cell spans.
 */
const FREQUENCY_COLUMN_COUNT = 3;

/**
 * Renders the Frequency table's placeholder row for when no word occurs
 * more than once.
 *
 * @returns HTML string for the placeholder row
 */
function renderEmptyFrequencyRow(): string {
  return h(
    {
      tag: 'tr',
      children: [
        h(
          {
            tag: 'td',
            class: 'frequency-empty',
            attrs: { colspan: String(FREQUENCY_COLUMN_COUNT,), },
            text: 'No repeated words yet.',
          },
        ),
      ],
    },
  );
}

/**
 * Replaces the Frequency table body with rows for entries, via
 * {@link renderFrequencyRow}, or {@link renderEmptyFrequencyRow} when
 * entries is empty.
 *
 * @param entries - frequency rows to render
 */
function renderFrequency(entries: readonly FrequencyEntry[],): void {
  /**
   * Frequency table body element, or `null` when absent.
   */
  const tbody = document.querySelector<HTMLElement>('#frequency-body',);

  if (tbody === null) {
    return;
  }

  if (entries.length === 0) {
    tbody.innerHTML = renderEmptyFrequencyRow();
    return;
  }

  /**
   * Row HTML strings collected by one pass over entries.
   */
  const rows: string[] = [];

  for (const entry of entries) {
    rows.push(renderFrequencyRow(entry,),);
  }

  tbody.innerHTML = rows.join('',);
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
 * Input textarea the user types or pastes text into.
 */
const textarea = document.querySelector<HTMLTextAreaElement>('#wc-input',);

if (textarea !== null) {
  /**
   * Container for the shared debounce timer handle, so the binding stays
   * `const` while the handle is reassigned on every keystroke.
   */
  const timer: { handle?: ReturnType<typeof setTimeout>; } = {};

  textarea.addEventListener(
    'input',
    function handleInput(): void {
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
