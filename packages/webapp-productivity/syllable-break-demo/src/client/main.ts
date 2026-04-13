/**
 * Client-side entry point for the syllable break demo.
 *
 * Processes user-entered text through TeX hyphenation patterns,
 * inserting zero-width spaces at syllable boundaries instead of soft hyphens.
 * The browser then wraps at those boundaries without showing a hyphen character.
 */
import { hyphenateSync, } from 'hyphen/en-us';

/** Zero-width space character used as an invisible break opportunity. */
const ZWS = '\u200B';

/**
 * Inserts zero-width spaces at syllable boundaries in the given text.
 *
 * Uses TeX hyphenation patterns (via the `hyphen` library) to find syllable
 * boundaries, but replaces the default soft hyphen with a zero-width space
 * so the browser can break there without rendering a visible hyphen.
 *
 * @param text - plain text to process
 *
 * @returns text with zero-width spaces at syllable boundaries
 *
 * @example
 * ```ts
 * insertBreakOpportunities('extraordinary');
 * // 'ex\u200Btra\u200Bor\u200Bdi\u200Bnary'
 * ```
 */
function insertBreakOpportunities(text: string): string {
  return hyphenateSync(text, { hyphenChar: ZWS, },);
}

/**
 * Updates all output containers with hyphenated and plain versions of the input text.
 *
 * @param text - raw user input
 */
function updateOutputs(text: string): void {
  const processed = insertBreakOpportunities(text,);

  const zwsOutput = document.getElementById('output-zws',);
  const hyphensAutoOutput = document.getElementById('output-hyphens-auto',);
  const plainOutput = document.getElementById('output-plain',);
  const processedDisplay = document.getElementById('processed-text',);

  if (zwsOutput) {
    zwsOutput.textContent = processed;
  }
  if (hyphensAutoOutput) {
    hyphensAutoOutput.textContent = text;
  }
  if (plainOutput) {
    plainOutput.textContent = text;
  }
  if (processedDisplay) {
    /** Show the zero-width spaces as visible markers for debugging */
    processedDisplay.textContent = processed.replaceAll(ZWS, '\u00B7',);
  }
}

/**
 * Reads the width slider value and applies it to all output containers.
 */
function updateWidth(): void {
  const slider = document.getElementById('width-slider',) as HTMLInputElement | null;
  const widthLabel = document.getElementById('width-label',);
  if (!slider) return;

  const value = `${slider.value}ch`;
  for (const id of ['output-zws', 'output-hyphens-auto', 'output-plain',]) {
    const el = document.getElementById(id,);
    if (el) {
      el.style.inlineSize = value;
    }
  }
  if (widthLabel) {
    widthLabel.textContent = value;
  }
}

/** Default sample text demonstrating scientific terminology that CSS hyphens: auto may not cover. */
const DEFAULT_TEXT = 'Ribulose-1,5-bisphosphate carboxylase/oxygenase';

const textarea = document.getElementById('input-text',) as HTMLTextAreaElement | null;
const slider = document.getElementById('width-slider',) as HTMLInputElement | null;

if (textarea) {
  textarea.value = DEFAULT_TEXT;
  textarea.addEventListener('input', function handleInput(): void {
    updateOutputs(textarea.value,);
  },);
}

if (slider) {
  slider.addEventListener('input', function handleSlider(): void {
    updateWidth();
  },);
}

updateOutputs(DEFAULT_TEXT,);
updateWidth();
