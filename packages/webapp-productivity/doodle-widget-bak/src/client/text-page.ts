/**
 * Text entry serialization for multi-page state persistence.
 *
 * Provides type-safe serialization and restoration of text input
 * elements between page switches. Serialization captures position,
 * style, and content; restoration recreates readonly input elements.
 */

/**
 * Serialized representation of a text input for page state persistence.
 *
 * @example
 * ```ts
 * const entries = serializeTextEntries(layer);
 * restoreTextEntries({ entries, layer: otherLayer });
 * ```
 */
export type TextEntryData = {
  /** Text content of the input */
  readonly value: string;
  /** CSS percentage string for horizontal position */
  readonly insetInlineStart: string;
  /** CSS percentage string for vertical position */
  readonly insetBlockStart: string;
  /** CSS color string captured at creation */
  readonly color: string;
  /** Font size in pixels as a numeric string */
  readonly fontSize: string;
};

/**
 * Serializes all text entries in a text layer element.
 *
 * Caller must finalize any active input before calling this function
 * to ensure all entries are readonly and complete.
 *
 * @param layer - text layer div containing `.text-input` elements
 *
 * @returns array of serialized text entry data
 */
export function serializeTextEntries(layer: HTMLDivElement,): TextEntryData[] {
  const inputs = layer.querySelectorAll<HTMLInputElement>('.text-input',);
  return Array.from(inputs, function serializeInput(input,): TextEntryData {
    return {
      value: input.value,
      insetInlineStart: input.style.insetInlineStart,
      insetBlockStart: input.style.insetBlockStart,
      color: input.dataset.color ?? '',
      fontSize: input.dataset.fontSize ?? '',
    };
  },);
}

/**
 * Recreates text inputs from serialized data.
 *
 * All restored inputs are set to readonly since they were finalized
 * during serialization.
 *
 * @param entries - serialized text entry data to restore
 *
 * @param layer - text layer element to append inputs to
 */
export function restoreTextEntries({ entries, layer, }: {
  entries: readonly TextEntryData[];
  layer: HTMLDivElement;
},): void {
  for (const entry of entries) {
    const input = document.createElement('input',);
    input.type = 'text';
    input.className = 'text-input';
    input.autocomplete = 'off';
    input.value = entry.value;
    input.style.insetInlineStart = entry.insetInlineStart;
    input.style.insetBlockStart = entry.insetBlockStart;
    input.style.color = entry.color;
    input.style.fontSize = `${entry.fontSize}px`;
    input.dataset.color = entry.color;
    input.dataset.fontSize = entry.fontSize;
    input.readOnly = true;
    layer.append(input,);
  }
}
