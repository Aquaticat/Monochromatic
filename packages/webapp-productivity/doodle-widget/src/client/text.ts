/**
 * Text placement for the doodle widget.
 *
 * Creates text inputs as absolutely-positioned DOM elements inside a
 * text layer. Inputs become readonly once the user finishes typing;
 * no conversion to a different element type is needed.
 */

import {
  getStrokeColor,
  getStrokeWidth,
} from './drawing-config.ts';
import type { NormalizedPoint, } from './drawing.ts';
import { createTextInput, } from './text-page.ts';

/** Multiplier converting a 0..1 normalized coordinate to a percentage */
const PERCENT_SCALE = 100;

/** Multiplier converting stroke width to text font size in pixels */
const TEXT_SIZE_FACTOR = 2;

//region State

/**
 * Text layer container, set via {@link setTextLayer}
 */
let layerElement: HTMLDivElement | null = null;

/** Currently focused text input, or null when idle */
let activeInput: HTMLInputElement | null = null;

//endregion State

/**
 * Custom event type dispatched on the text layer when a text input
 * is finalized with content. Subscribers (e.g. undo system) listen
 * on the text layer element directly.
 */
const TEXT_FINALIZED_EVENT = 'textfinalized';

/**
 * Sets the text layer container element.
 *
 * @param layer - div element that holds text overlays
 */
export function setTextLayer(layer: HTMLDivElement,): void {
  layerElement = layer;
}

/**
 * Finalizes the active input: makes it readonly if it has content,
 * removes it if empty. Dispatches a `textfinalized` custom event
 * on the text layer when content is kept.
 */
export function finalizeActiveInput(): void {
  if (activeInput === null)
    return;

  /** Whether the input has non-empty content worth keeping */
  const hasContent = activeInput.value.trim() !== '';
  if (hasContent)
    activeInput.readOnly = true;
  else
    activeInput.remove();

  activeInput = null;

  if (hasContent && layerElement !== null)
    layerElement.dispatchEvent(new CustomEvent(TEXT_FINALIZED_EVENT,),);
}

/**
 * Creates a text input at the given normalized position and appends
 * it to the text layer.
 *
 * Finalizes any previously active input first.
 *
 * @param position - normalized [0..1] coordinate for placement
 */
export function placeTextInput(position: NormalizedPoint,): void {
  finalizeActiveInput();

  if (layerElement === null)
    return;

  /** Active color captured at text input creation */
  const color = getStrokeColor();
  /** Text font size derived from active stroke width */
  const textSizePx = getStrokeWidth() * TEXT_SIZE_FACTOR;

  const input = createTextInput({
    insetInlineStart: `${String(position[0] * PERCENT_SCALE,)}%`,
    insetBlockStart: `${String(position[1] * PERCENT_SCALE,)}%`,
    color,
    fontSize: String(textSizePx,),
  },);

  input.addEventListener('keydown', function handleKeydown(event: KeyboardEvent,): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      finalizeActiveInput();
    }
    else if (event.key === 'Escape') {
      discardActiveInput();
    }
  },);

  input.addEventListener('blur', finalizeActiveInput,);

  activeInput = input;
  layerElement.append(input,);
  /**
   * preventScroll stops the browser from scrolling the overflow-hidden
   * canvas container to reveal the input when it extends past the edge.
   */
  input.focus({ preventScroll: true, },);
}

/**
 * Discards the active input without keeping it.
 */
export function discardActiveInput(): void {
  if (activeInput !== null) {
    activeInput.remove();
    activeInput = null;
  }
}

/**
 * Removes all text entries and discards any active input.
 */
export function clearTextEntries(): void {
  discardActiveInput();
  if (layerElement !== null)
    layerElement.replaceChildren();
}

