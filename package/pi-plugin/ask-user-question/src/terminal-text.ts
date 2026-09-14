//region Terminal-safe model text

/**
 Width of hexadecimal code-point labels used for ASCII control characters.
 */
const ASCII_CONTROL_HEX_WIDTH = 4;

/**
 First printable ASCII code point.
 */
const ASCII_PRINTABLE_START = 32;

/**
 Delete control-character code point.
 */
const ASCII_DELETE = 127;

/**
 Renders terminal control characters as visible labels while preserving free text.
 
 Newlines and tabs remain structural text.
 Every other C0 control and DEL becomes a visible `U+XXXX` token,
 preventing model-authored terminal escape sequences from crossing into ANSI syntax.
 
 @param text - model-authored text
 
 @returns terminal-safe text with no hidden control instructions
 
 @example
 ```ts
 visibleTerminalText({ text: 'question\u001b[2J' });
 ```
 */
export function visibleTerminalText(
  { text, }: { readonly text: string; },
): string {
  /**
   Visible chunks accumulated without repeated string reconstruction.
   */
  const chunks: string[] = [];
  for (const character of text) {
    /**
     Unicode scalar value for current character.
     */
    const codePoint = character.codePointAt(0,);
    if (codePoint === undefined)
      continue;
    if ((character === '\n') || (character === '\t')
      || ((codePoint >= ASCII_PRINTABLE_START) && (codePoint !== ASCII_DELETE))) {
      chunks.push(character,);
      continue;
    }
    chunks.push(
      `<U+${codePoint
        .toString(16,)
        .toUpperCase()
        .padStart(
          ASCII_CONTROL_HEX_WIDTH,
          '0',
        )}>`,
    );
  }
  return chunks.join('',);
}

//endregion Terminal-safe model text
