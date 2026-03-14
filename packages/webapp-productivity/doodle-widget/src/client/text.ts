/**
 * Text placement for the doodle widget.
 *
 * Creates text inputs as absolutely-positioned DOM elements inside a
 * text layer. Inputs become readonly once the user finishes typing;
 * no conversion to a different element type is needed.
 */

import type { NormalizedPoint } from './drawing.ts';

//region State

/** Text layer container, set via {@link setTextLayer} */
let layerElement: HTMLDivElement | null = null;

/** Currently focused text input, or null when idle */
let activeInput: HTMLInputElement | null = null;

//endregion State

/**
 * Sets the text layer container element.
 *
 * @param layer - div element that holds text overlays
 */
export function setTextLayer(layer: HTMLDivElement): void {
  layerElement = layer;
}

/**
 * Finalizes the active input: makes it readonly if it has content,
 * removes it if empty.
 */
function finalizeActiveInput(): void {
  if (activeInput === null) {
    return;
  }

  if (activeInput.value.trim() === '') {
    activeInput.remove();
  } else {
    activeInput.readOnly = true;
  }

  activeInput = null;
}

/**
 * Creates a text input at the given normalized position and appends
 * it to the text layer.
 *
 * Finalizes any previously active input first.
 *
 * @param position - normalized [0..1] coordinate for placement
 */
export function placeTextInput(position: NormalizedPoint): void {
  finalizeActiveInput();

  if (layerElement === null) {
    return;
  }

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'text-input';
  input.autocomplete = 'off';
  input.style.insetInlineStart = `${String(position[0] * 100)}%`;
  input.style.insetBlockStart = `${String(position[1] * 100)}%`;

  input.addEventListener('keydown', function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      finalizeActiveInput();
    } else if (event.key === 'Escape') {
      discardActiveInput();
    }
  });

  input.addEventListener('blur', finalizeActiveInput);

  activeInput = input;
  layerElement.appendChild(input);
  /**
   * preventScroll stops the browser from scrolling the overflow-hidden
   * canvas container to reveal the input when it extends past the edge.
   */
  input.focus({ preventScroll: true, });
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
  if (layerElement !== null) {
    layerElement.replaceChildren();
  }
}
