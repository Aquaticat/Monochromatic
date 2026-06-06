//region XML primitives: read and write the LSP4IJ persistent-state subset

/**
 * Entry block found inside an LSP4IJ persistent-state XML map.
 */
export type XmlEntry = {
  readonly block: string;
  readonly end: number;
  readonly key: string;
  readonly start: number;
};

/**
 * Decodes XML attribute text used by JetBrains persistent-state files.
 *
 * @param value - XML attribute value without surrounding quote characters.
 *
 * @returns Decoded text.
 *
 * @example
 * ```ts
 * unescapeXmlAttribute({ value: '&quot;x&quot;' });
 * ```
 */
function unescapeXmlAttribute({ value, }: { readonly value: string; },): string {
  let output = '';
  let cursorIndex = 0;
  while (cursorIndex < value.length) {
    const entityStart = value.indexOf('&', cursorIndex,);
    if (entityStart === (-1)) {
      output += value.slice(cursorIndex,);
      break;
    }
    output += value.slice(cursorIndex, entityStart,);
    const entityEnd = value.indexOf(';', entityStart + 1,);
    if (entityEnd === (-1)) {
      output += value.slice(entityStart,);
      break;
    }
    output += decodeXmlEntity({ entity: value.slice(entityStart + 1, entityEnd,), },);
    cursorIndex = entityEnd + 1;
  }
  return output;
}

/**
 * Encodes text for a double-quoted XML attribute.
 *
 * @param value - Raw attribute text.
 *
 * @returns XML-safe attribute value.
 *
 * @example
 * ```ts
 * escapeXmlAttribute({ value: '"x"' });
 * ```
 */
export function escapeXmlAttribute({ value, }: { readonly value: string; },): string {
  let output = '';
  for (const char of value) {
    if (char === '&') output += '&amp;';
    else if (char === '"') output += '&quot;';
    else if (char === '<') output += '&lt;';
    else if (char === '>') output += '&gt;';
    else if (char === '\n') output += '&#10;';
    else if (char === '\r') output += '&#13;';
    else if (char === '\t') output += '&#9;';
    else output += char;
  }
  return output;
}

/**
 * Decodes one XML entity body.
 *
 * @param entity - Entity body between ampersand and semicolon.
 *
 * @returns Decoded entity or original entity syntax when unknown.
 *
 * @example
 * ```ts
 * decodeXmlEntity({ entity: 'quot' });
 * ```
 */
function decodeXmlEntity({ entity, }: { readonly entity: string; },): string {
  if (entity === 'quot') return '"';
  if (entity === 'amp') return '&';
  if (entity === 'lt') return '<';
  if (entity === 'gt') return '>';
  if (entity === 'apos') return "'";
  if (entity.startsWith('#x',)) return decodeXmlCodePoint({ text: entity.slice(2,), radix: 16, });
  if (entity.startsWith('#',)) return decodeXmlCodePoint({ text: entity.slice(1,), radix: 10, });
  return `&${entity};`;
}

/**
 * Decodes one numeric XML entity code point.
 *
 * @param text - Numeric text after entity prefix.
 *
 * @param radix - Number base used by entity notation.
 *
 * @returns Decoded code point or original entity syntax when invalid.
 *
 * @example
 * ```ts
 * decodeXmlCodePoint({ text: '10', radix: 10 });
 * ```
 */
function decodeXmlCodePoint({ text, radix, }: { readonly radix: number; readonly text: string; },): string {
  const codePoint = Number.parseInt(text, radix,);
  if (Number.isNaN(codePoint,)) return `&#${text};`;
  try {
    return String.fromCodePoint(codePoint,);
  }
  catch {
    return `&#${text};`;
  }
}

//endregion XML primitives

//region XML entry editing: locate entries, options, and insertion points

/**
 * Lists top-level map entries in JetBrains persistent-state XML.
 *
 * @param xml - XML document text.
 *
 * @returns Entry ranges and keys.
 *
 * @example
 * ```ts
 * const entries = listXmlEntries({ xml });
 * ```
 */
export function listXmlEntries({ xml, }: { readonly xml: string; },): readonly XmlEntry[] {
  const entries: XmlEntry[] = [];
  let searchStart = 0;
  while (true) {
    const entryStart = xml.indexOf('<entry key="', searchStart,);
    if (entryStart === (-1)) return entries;
    const keyStart = entryStart + '<entry key="'.length;
    const keyEnd = xml.indexOf('"', keyStart,);
    const closeStart = xml.indexOf('</entry>', keyEnd,);
    if (keyEnd === (-1) || closeStart === (-1)) return entries;
    const entryEnd = closeStart + '</entry>'.length;
    entries.push({
      block: xml.slice(entryStart, entryEnd,),
      end: entryEnd,
      key: unescapeXmlAttribute({ value: xml.slice(keyStart, keyEnd,), },),
      start: entryStart,
    },);
    searchStart = entryEnd;
  }
}

/**
 * Finds one XML map entry by key.
 *
 * @param xml - XML document text.
 *
 * @param key - Entry key to find.
 *
 * @returns Matching entry or undefined.
 *
 * @example
 * ```ts
 * const entry = findXmlEntryByKey({ xml, key: 'server' });
 * ```
 */
export function findXmlEntryByKey(
  { xml, key, }: { readonly key: string; readonly xml: string; },
): XmlEntry | undefined {
  return listXmlEntries({ xml, },)
    .find(function keyMatches(entry,): boolean {
      return entry.key === key;
    },);
}

/**
 * Reads an XML option attribute value from an entry block.
 *
 * @param block - XML block containing option tags.
 *
 * @param optionName - Option name attribute to find.
 *
 * @returns Decoded option value or undefined.
 *
 * @example
 * ```ts
 * const command = getXmlOptionValue({ block, optionName: 'commandLine' });
 * ```
 */
export function getXmlOptionValue(
  { block, optionName, }: { readonly block: string; readonly optionName: string; },
): string | undefined {
  const token = `<option name="${optionName}" value="`;
  const optionStart = block.indexOf(token,);
  if (optionStart === (-1)) return undefined;
  const valueStart = optionStart + token.length;
  const valueEnd = block.indexOf('"', valueStart,);
  if (valueEnd === (-1)) return undefined;
  return unescapeXmlAttribute({ value: block.slice(valueStart, valueEnd,), },);
}

/**
 * Replaces an XML map entry if present, otherwise inserts before map close.
 *
 * @param xml - XML document text.
 *
 * @param key - Entry key to replace.
 *
 * @param block - Full entry block to insert.
 *
 * @returns Updated XML document text.
 *
 * @example
 * ```ts
 * const updated = replaceOrInsertXmlEntry({ xml, key, block });
 * ```
 */
export function replaceOrInsertXmlEntry(
  { xml, key, block, }: { readonly block: string; readonly key: string; readonly xml: string; },
): string {
  const existing = findXmlEntryByKey({ xml, key, },);
  if (existing !== undefined) return `${xml.slice(0, existing.start,)}${block}${xml.slice(existing.end,)}`;
  const mapClose = '      </map>';
  const mapCloseIndex = xml.lastIndexOf(mapClose,);
  if (mapCloseIndex === (-1)) throw new Error('Could not find LSP4IJ XML map close tag',);
  return `${xml.slice(0, mapCloseIndex,)}${block}\n${xml.slice(mapCloseIndex,)}`;
}

//endregion XML entry editing

//region XML builders: render canonical LSP4IJ entries

/**
 * Renders one XML option line.
 *
 * @param indent - Whitespace prefix for line.
 *
 * @param name - Option name.
 *
 * @param value - Raw option value.
 *
 * @returns XML option line.
 *
 * @example
 * ```ts
 * const line = xmlOptionLine({ indent: '  ', name: 'x', value: 'y' });
 * ```
 */
function xmlOptionLine(
  { indent, name, value, }: { readonly indent: string; readonly name: string; readonly value: string; },
): string {
  return `${indent}<option name="${name}" value="${escapeXmlAttribute({ value, },)}" />`;
}

/**
 * Builds language-server settings XML entry for a Harper server.
 *
 * @param serverId - LSP4IJ server id.
 *
 * @param configContent - Flat Harper settings JSON text.
 *
 * @param schemaContent - LSP4IJ settings schema JSON text.
 *
 * @returns XML entry block.
 *
 * @example
 * ```ts
 * const entry = buildLanguageSettingsEntry({ serverId, configContent, schemaContent });
 * ```
 */
export function buildLanguageSettingsEntry(
  {
    configContent,
    schemaContent,
    serverId,
  }: {
    readonly configContent: string;
    readonly schemaContent: string;
    readonly serverId: string;
  },
): string {
  return [
    `        <entry key="${escapeXmlAttribute({ value: serverId, },)}">`,
    '          <value>',
    '            <LanguageServerDefinitionSettings>',
    xmlOptionLine({ indent: '              ', name: 'configurationContent', value: configContent, },),
    xmlOptionLine({ indent: '              ', name: 'configurationSchemaContent', value: schemaContent, },),
    xmlOptionLine({ indent: '              ', name: 'experimentalContent', value: '{}', },),
    xmlOptionLine({ indent: '              ', name: 'initializationOptionsContent', value: '{}', },),
    '            </LanguageServerDefinitionSettings>',
    '          </value>',
    '        </entry>',
  ].join('\n',);
}

/**
 * Builds XML option line when source option exists.
 *
 * @param block - Source user-defined server entry block.
 *
 * @param optionName - Option to copy.
 *
 * @returns XML option line or undefined.
 *
 * @example
 * ```ts
 * const line = copiedOptionLine({ block, optionName: 'commandLine' });
 * ```
 */
function copiedOptionLine(
  { block, optionName, }: { readonly block: string; readonly optionName: string; },
): string | undefined {
  const value = getXmlOptionValue({ block, optionName, },);
  if (value === undefined) return undefined;
  return xmlOptionLine({ indent: '              ', name: optionName, value, },);
}

/**
 * Builds file-pattern mapping lines for special Harper server.
 *
 * @param fileNames - File names to map to Markdown language id.
 *
 * @returns XML mapping block lines.
 *
 * @example
 * ```ts
 * const mapping = cavemanMappingLines({ fileNames: ['AGENTS.md'] });
 * ```
 */
function cavemanMappingLines({ fileNames, }: { readonly fileNames: readonly string[]; },): string {
  const fileNameLines = fileNames.map(function patternLine(fileName,): string {
    return `                        <option value="${escapeXmlAttribute({ value: fileName, },)}" />`;
  },);
  return [
    '              <option name="mappings">',
    '                <ServerMappingSettings languageId="markdown">',
    '                  <fileType>',
    '                    <FileTypeSettings>',
    '                      <option name="patterns">',
    ...fileNameLines,
    '                      </option>',
    '                    </FileTypeSettings>',
    '                  </fileType>',
    '                </ServerMappingSettings>',
    '              </option>',
  ].join('\n',);
}

/**
 * Builds user-defined LSP4IJ server entry for caveman-style agent docs.
 *
 * @param fileNames - File names mapped to this special server.
 *
 * @param mainEntryBlock - Existing Harper server entry to copy command and installer settings from.
 *
 * @param serverId - Special server id.
 *
 * @param serverName - Special server display name.
 *
 * @returns XML entry block.
 *
 * @example
 * ```ts
 * const entry = buildCavemanUserDefinedEntry({ fileNames, mainEntryBlock, serverId, serverName });
 * ```
 */
export function buildCavemanUserDefinedEntry(
  {
    fileNames,
    mainEntryBlock,
    serverId,
    serverName,
  }: {
    readonly fileNames: readonly string[];
    readonly mainEntryBlock: string;
    readonly serverId: string;
    readonly serverName: string;
  },
): string {
  const copiedLines = [
    'commandLine',
    'installAlreadyDone',
    'installerConfigurationContent',
    'serverUrl',
    'templateId',
    'workingDir',
    'workspaceFolderStrategyConfiguration',
  ]
    .map(function copyOption(optionName,): string | undefined {
      return copiedOptionLine({ block: mainEntryBlock, optionName, },);
    },)
    .filter(function keepCopiedLine(line,): line is string {
      return line !== undefined;
    },);
  return [
    `        <entry key="${escapeXmlAttribute({ value: serverId, },)}">`,
    '          <value>',
    '            <UserDefinedLanguageServerItemSettings>',
    ...copiedLines,
    xmlOptionLine({ indent: '              ', name: 'serverId', value: serverId, },),
    xmlOptionLine({ indent: '              ', name: 'serverName', value: serverName, },),
    cavemanMappingLines({ fileNames, },),
    '            </UserDefinedLanguageServerItemSettings>',
    '          </value>',
    '        </entry>',
  ].join('\n',);
}

//endregion XML builders
