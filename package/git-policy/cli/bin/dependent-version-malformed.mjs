/**
 One malformed variant of a manifest text for the dependent-version differential generator: a comment, a trailing
 comma, single quotes, a missing comma, truncation, a scalar or array root, a numeric name, a non-string version, or a
 duplicated version key whose first value differs.
 */

/** @typedef {import('./dependent-version-random.mjs').Tool} Tool */

/**
 A scalar root, which is JSON but not an object.

 @returns {string} text
 */
function scalarRoot() {
  return '"just a string"';
}

/**
 The span of the first string value of a key spelled `"key"`, as `[start, end)` around its quotes.

 @param {{ text: string, key: string }} request - manifest text and key
 @returns {[number, number] | undefined} span, or nothing
 */
function stringValueSpan({
  text,
  key
}) {
  const spelled = JSON.stringify(key);
  const state = { from: text.indexOf(spelled) };
  while (state.from !== (-1)) {
    const afterKey = state.from + spelled.length;
    const rest = text.slice(afterKey);
    if (rest.trimStart()
      .startsWith(':')) {
      const afterColon = afterKey + (rest.length
        - rest.trimStart()
        .length)
        + 1;
      const tail = text.slice(afterColon);
      const valueStart = afterColon + (tail.length
        - tail.trimStart()
        .length);
      const valueEnd = text.indexOf(
        '"',
        valueStart + 1,
      );
      if ((text[valueStart] === '"') && (valueEnd !== (-1)))
        return [
          valueStart,
          valueEnd + 1
        ];
    }
    state.from = text.indexOf(
      spelled,
      state.from + 1,
    );
  }
  return undefined;
}

/**
 Text with the first string value of a key replaced by raw JSON, or unchanged when there is none.

 @param {{ text: string, key: string, value: string }} request - manifest text, key and replacement
 @returns {string} text
 */
function replaceStringValue({
  text,
  key,
  value
}) {
  const span = stringValueSpan({
    text,
    key,
  });
  return span === undefined ? text : `${text.slice(
    0,
    span[0]
  )}${value}${text.slice(span[1])}`;
}

/**
 One malformed variant of a manifest text.

 @param {{ tool: Tool, text: string }} request - choices and manifest text
 @returns {string} text with one defect
 */
export function malformed({
  tool,
  text
}) {
  const defects = [
    function trailingComma() {
      const close = text.lastIndexOf('}');
      return `${text.slice(
        0,
        close
      )},${text.slice(close)}`;
    },
    function comment() {
      return `// comment\n${text}`;
    },
    function singleQuotes() {
      return text.replace(
        '"name"',
        "'name'"
      );
    },
    function missingComma() {
      return text.replace(
        ',',
        ''
      );
    },
    function truncated() {
      return text.slice(
        0,
        Math.max(
          1,
          text.indexOf('"name"') + '"na'.length
        )
      );
    },
    scalarRoot,
    function arrayRoot() {
      return `[${text}]`;
    },
    function numericName() {
      return replaceStringValue({
        text,
        key: 'name',
        value: '1'
      });
    },
    function arrayVersion() {
      return replaceStringValue({
        text,
        key: 'version',
        value: '[1]'
      });
    },
    function duplicateVersion() {
      return text.replace(
        '{',
        '{"version":"0.0.0-first",'
      );
    },
  ];
  return tool.pick(defects)();
}
