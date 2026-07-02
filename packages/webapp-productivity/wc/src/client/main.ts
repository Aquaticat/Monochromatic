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
 * Header label of the Frequency word column, included in word-column
 * measurement so the column never renders narrower than its heading.
 */
const WORD_COLUMN_HEADER = 'Word';

/**
 * Slack in rem added to the measured word column, absorbing the small
 * differences between canvas text measurement and DOM rendering
 * (hinting, `font-variant-numeric` on digit-bearing words).
 */
const WORD_COLUMN_SLACK_REM = 1 / (2 * 2);

/**
 * Ceiling in rem on the word column, so one pathological token (a
 * chemical name, a URL, a DNA string) cannot crush the bar tracks.
 * Longer words truncate visually with an ellipsis while the full word
 * rides in the cell's `title` and `aria-label`.
 */
const WORD_COLUMN_MAX_REM = ((2 * 2) * 2) + (2 + 2);

/**
 * Detached canvas backing the word-width measuring context.
 */
const measureCanvas = document.createElement('canvas',);

/**
 * 2D canvas context for measuring rendered word widths without
 * touching DOM layout. Nullable per the platform API; where 2D
 * contexts are unavailable the word column falls back to per-cell
 * content sizing.
 */
const measureContext = measureCanvas.getContext('2d',);

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
            // Displayed text can truncate with an ellipsis once the
            // word column hits its cap; title (hover) and aria-label
            // (assistive tech) always carry the whole word.
            attrs: {
              role: 'cell',
              title: entry.word,
              'aria-label': entry.word,
            },
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
 * Measures the widest of words as rendered in reference's computed
 * font, via canvas `measureText`, so unbounded row counts never force
 * per-row DOM layout reads. The width sizes the shared word column:
 * with the number columns already equal (figure-space padding) and the
 * word column fixed, the flex-growing bar track comes out identical in
 * every row, keeping bar lengths comparable.
 *
 * @param words - word column contents to measure
 *
 * @param reference - element whose computed font the words render in
 *
 * @param context - measuring canvas context, narrowed by caller
 *
 * @returns widest width in rem plus {@link WORD_COLUMN_SLACK_REM},
 * capped at {@link WORD_COLUMN_MAX_REM}
 */
function measureWordColumnRem(
  {
    words,
    reference,
    context,
  }: Readonly<{
    words: readonly string[];
    reference: HTMLElement;
    context: CanvasRenderingContext2D;
  }>,
): number {
  /**
   * Computed font parts of the element the words render inside.
   */
  const {
    fontWeight,
    fontSize,
    fontFamily,
  } = getComputedStyle(reference,);

  context.font = `${fontWeight} ${fontSize} ${fontFamily}`;

  /**
   * Widest measured word width in CSS pixels.
   */
  const widestPx = words.reduce(
    function widestSoFar(
      max,
      word,
    ): number {
      /**
       * Measured metrics of word in the reference font.
       */
      const metrics = context.measureText(word,);

      return Math.max(
        max,
        metrics.width,
      );
    },
    0,
  );

  /**
   * Root computed font-size string, always serialized in `px`.
   */
  const { fontSize: rootFontSize, } = getComputedStyle(
    document.documentElement,
  );

  /**
   * Index where the `px` unit starts inside the root font-size string.
   */
  const unitStart = rootFontSize.indexOf('px',);

  /**
   * Root font size in CSS pixels, for the px-to-rem conversion (rem
   * keeps the column proportional if the root size changes).
   */
  const rootPx = Number(rootFontSize.slice(
    0,
    unitStart,
  ),);

  return Math.min(
    (widestPx / rootPx) + WORD_COLUMN_SLACK_REM,
    WORD_COLUMN_MAX_REM,
  );
}

/**
 * Replaces the Frequency body rowgroup with rows for entries, via
 * {@link renderFrequencyRow}, or {@link renderEmptyFrequencyRow} when
 * entries is empty, and pins the shared `--word-col` custom property
 * to the measured widest word so every row's bar track is equal.
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

  /**
   * Frequency table container carrying the shared word-column custom
   * property (header and body word cells both read it).
   */
  const frequency = body.closest<HTMLElement>('.frequency',);

  if (entries.length === 0) {
    body.innerHTML = renderEmptyFrequencyRow();

    if (frequency !== null) {
      /**
       * Container style, destructured so member access stays flat.
       */
      const { style, } = frequency;

      style.removeProperty('--word-col',);
    }

    return;
  }

  if ((frequency !== null) && (measureContext !== null)) {
    /**
     * Word column inline size in rem, from the widest rendered word.
     */
    const wordColumnRem = measureWordColumnRem(
      {
        words: [
          ...entries.map(function pickWord(entry,): string {
            return entry.word;
          },),
          WORD_COLUMN_HEADER,
        ],
        reference: frequency,
        context: measureContext,
      },
    );

    /**
     * Container style, destructured so member access stays flat.
     */
    const { style, } = frequency;

    style.setProperty(
      '--word-col',
      `${wordColumnRem}rem`,
    );
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
 * Renders every result section from input's current value and re-grows
 * input to fit it. Runs at startup and again on `pageshow` because
 * browsers restore textarea values across reloads (F5) and
 * back/forward navigations without firing `input`, at timings that
 * vary by browser (often after inline scripts have run); re-reading
 * the live value once the page has fully shown is the reliable hook.
 *
 * @param input - textarea whose current value drives the page
 */
function syncFromInput(
  { input, }: Readonly<{ input: HTMLTextAreaElement; }>,
): void {
  autoGrow({ input, },);
  updateResults(input.value,);
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
  syncFromInput({ input: textarea, },);

  window.addEventListener(
    'pageshow',
    function handlePageShow(): void {
      syncFromInput({ input: textarea, },);
    },
  );

  /**
   * Document font set, destructured so member access stays flat.
   */
  const { fonts, } = document;

  // Word-column measurement runs against the fallback font until the
  // embedded Inter finishes decoding; re-sync once font loading
  // settles so the measured column matches the real rendering.
  fonts.addEventListener(
    'loadingdone',
    function handleFontsLoaded(): void {
      syncFromInput({ input: textarea, },);
    },
  );

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
