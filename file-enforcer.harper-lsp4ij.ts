import { join, } from 'node:path';

import {
  l,
  MISSING,
  overwrite,
  readExisting,
  tagged,
  trackRead,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';

import {
  LANGUAGE_SERVERS_SETTINGS_XML,
  latestIdeaOptionsDirectory,
  USER_DEFINED_LANGUAGE_SERVER_SETTINGS_XML,
} from './file-enforcer.harper-lsp4ij-idea.ts';

import {
  buildCavemanUserDefinedEntry,
  buildLanguageSettingsEntry,
  findXmlEntryByKey,
  getXmlOptionValue,
  listXmlEntries,
  replaceOrInsertXmlEntry,
} from './file-enforcer.harper-lsp4ij-xml.ts';

import type { XmlEntry, } from './file-enforcer.harper-lsp4ij-xml.ts';

//region Constants and shapes: describe local LSP4IJ Harper policy

/**
 * Stable id for special Harper server limited to caveman-style agent docs.
 */
const HARPER_CAVEMAN_SERVER_ID = 'harper-ls-agents-claude-md';

/**
 * Display name for special Harper server limited to caveman-style agent docs.
 */
const HARPER_CAVEMAN_SERVER_NAME = 'Harper Language Server (AGENTS.md and CLAUDE.md)';

/**
 * Harper rules disabled for every file handled by main Harper LSP4IJ server.
 */
const HARPER_GLOBAL_DISABLED_RULES = [
  'UseTitleCase',
  'SplitWords',
  'PhrasalVerbAsCompoundNoun',
] as const;

/**
 * Harper rules disabled only for caveman-style agent docs.
 */
const HARPER_CAVEMAN_DISABLED_RULES = [
  'MissingTo',
  'LongSentences',
  'OxfordComma',
] as const;

/**
 * File names handled by special caveman-style Harper server.
 */
const HARPER_CAVEMAN_FILE_NAMES = [
  'AGENTS.md',
  'CLAUDE.md',
] as const;

/**
 * Schema property LSP4IJ's bundled Harper template omits for Harper 2.4.0.
 */
const USE_TITLE_CASE_SCHEMA_PROPERTY = {
  type: 'boolean',
  default: true,
  description: 'Prompts you to use title case in relevant headings.',
} as const;

//endregion Constants and shapes

//region JSON settings: parse and update flat Harper configuration

/**
 * Checks whether a value is a mutable JSON object shape.
 *
 * @param value - Value to test.
 *
 * @returns Whether value is a non-array object.
 *
 * @example
 * ```ts
 * isJsonObject({});
 * ```
 */
function isJsonObject(value: unknown,): value is JsonObject {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value,);
}

/**
 * Parses JSON object content from an XML option.
 *
 * @param content - JSON text.
 *
 * @param optionName - Option name used in error messages.
 *
 * @returns Parsed JSON object.
 *
 * @example
 * ```ts
 * const config = parseJsonObjectOption({ content: '{}', optionName: 'configurationContent' });
 * ```
 */
function parseJsonObjectOption(
  { content, optionName, }: { readonly content: string; readonly optionName: string; },
): JsonObject {
  const parsed: unknown = JSON.parse(content,);
  if (!isJsonObject(parsed,)) throw new Error(`Option '${optionName}' must be a JSON object`,);
  return parsed;
}

/**
 * Formats JSON the same way LSP4IJ template settings are stored.
 *
 * @param value - JSON object to format.
 *
 * @returns Indented JSON with no trailing newline.
 *
 * @example
 * ```ts
 * const text = formatJson({ value: {} });
 * ```
 */
function formatJson({ value, }: { readonly value: JsonObject; },): string {
  return JSON.stringify(value, null, 2,);
}

/**
 * Adds or updates Harper linter keys in a flat LSP4IJ settings object.
 *
 * @param config - Flat LSP4IJ settings object.
 *
 * @param disabledRules - Harper rule names to disable.
 *
 * @param excludePatterns - Optional Harper exclude globs to merge.
 *
 * @returns Updated settings object.
 *
 * @example
 * ```ts
 * const updated = updateHarperConfig({ config, disabledRules: ['SplitWords'] });
 * ```
 */
function updateHarperConfig(
  {
    config,
    disabledRules,
    excludePatterns,
  }: {
    readonly config: JsonObject;
    readonly disabledRules: readonly string[];
    readonly excludePatterns?: readonly string[];
  },
): JsonObject {
  const updated = { ...config, };
  disabledRules.forEach(function disableRule(rule,): void {
    updated[`harper-ls.linters.${rule}`] = false;
  },);
  if (excludePatterns !== undefined) {
    const existing = updated['harper-ls.excludePatterns'];
    const existingPatterns = Array.isArray(existing,)
      ? existing.filter(function keepString(pattern,): pattern is string {
        return typeof pattern === 'string';
      },)
      : [];
    updated['harper-ls.excludePatterns'] = [...new Set([
      ...existingPatterns,
      ...excludePatterns,
    ],),];
  }
  return updated;
}

/**
 * Adds schema support for Harper UseTitleCase when LSP4IJ template predates it.
 *
 * @param schema - LSP4IJ JSON schema object.
 *
 * @returns Updated schema object.
 *
 * @example
 * ```ts
 * const schema = addUseTitleCaseSchema({ schema: {} });
 * ```
 */
function addUseTitleCaseSchema({ schema, }: { readonly schema: JsonObject; },): JsonObject {
  const updated = { ...schema, };
  const properties = isJsonObject(updated.properties,) ? { ...updated.properties, } : {};
  properties['harper-ls.linters.UseTitleCase'] ??= USE_TITLE_CASE_SCHEMA_PROPERTY;
  updated.properties = properties;
  return updated;
}

/**
 * Removes one flat config key without relying on unsafe Object.fromEntries inference.
 *
 * @param config - Source config object.
 *
 * @param keyToOmit - Key to exclude from result.
 *
 * @returns Copy without key.
 *
 * @example
 * ```ts
 * const config = omitConfigKey({ config: {}, keyToOmit: 'x' });
 * ```
 */
function omitConfigKey(
  { config, keyToOmit, }: { readonly config: JsonObject; readonly keyToOmit: string; },
): JsonObject {
  const updated: JsonObject = {};
  Object.entries(config,)
    .forEach(function copyEntry(entry,): void {
      const [key, value,] = entry;
      if (key !== keyToOmit) updated[key] = value;
    },);
  return updated;
}

//endregion JSON settings

//region LSP4IJ Harper editing: find main server and render desired state

/**
 * Reads a tracked local file when it exists.
 *
 * @param filePath - File path to read and track.
 *
 * @returns File content or undefined when absent.
 *
 * @example
 * ```ts
 * const xml = await readTrackedExisting({ filePath });
 * ```
 */
async function readTrackedExisting({ filePath, }: { readonly filePath: string; },): Promise<string | undefined> {
  trackRead(filePath,);
  const existing = await readExisting(filePath,);
  return existing === MISSING ? undefined : existing;
}

/**
 * Finds user-defined LSP4IJ Harper server entry.
 *
 * @param userDefinedXml - User-defined language-server XML content.
 *
 * @returns Harper server entry, or undefined when absent.
 *
 * @example
 * ```ts
 * const entry = findHarperUserDefinedEntry({ userDefinedXml });
 * ```
 */
function findHarperUserDefinedEntry({ userDefinedXml, }: { readonly userDefinedXml: string; },): XmlEntry | undefined {
  return listXmlEntries({ xml: userDefinedXml, },)
    .find(function isHarperEntry(entry,): boolean {
      if (entry.key === HARPER_CAVEMAN_SERVER_ID) return false;
      return getXmlOptionValue({ block: entry.block, optionName: 'templateId', }) === 'harper-ls'
        || getXmlOptionValue({ block: entry.block, optionName: 'serverName', }) === 'Harper Language Server'
        || (getXmlOptionValue({ block: entry.block, optionName: 'commandLine', }) ?? '').includes('harper-ls',);
    },);
}

/**
 * Returns main server exclude patterns for files delegated to special Harper server.
 *
 * @returns Glob and absolute-path excludes for caveman-style files.
 *
 * @example
 * ```ts
 * const patterns = harperCavemanExcludePatterns();
 * ```
 */
function harperCavemanExcludePatterns(): readonly string[] {
  return [
    '**/AGENTS.md',
    '**/CLAUDE.md',
    join(process.cwd(), 'AGENTS.md',),
    join(process.cwd(), 'CLAUDE.md',),
  ];
}

/**
 * Builds updated language-server settings XML for main and special Harper servers.
 *
 * @param languageXml - Current global settings XML.
 *
 * @param mainUserEntry - Main user-defined Harper server entry.
 *
 * @returns Updated global settings XML.
 *
 * @example
 * ```ts
 * const xml = updatedLanguageSettingsXml({ languageXml, mainUserEntry });
 * ```
 */
function updatedLanguageSettingsXml(
  { languageXml, mainUserEntry, }: { readonly languageXml: string; readonly mainUserEntry: XmlEntry; },
): string {
  const mainLanguageEntry = findXmlEntryByKey({ xml: languageXml, key: mainUserEntry.key, },);
  if (mainLanguageEntry === undefined) throw new Error(`Missing Harper settings entry '${mainUserEntry.key}'`,);
  const mainConfig = updateHarperConfig({
    config: parseJsonObjectOption({
      content: getXmlOptionValue({ block: mainLanguageEntry.block, optionName: 'configurationContent', }) ?? '{}',
      optionName: 'configurationContent',
    },),
    disabledRules: HARPER_GLOBAL_DISABLED_RULES,
    excludePatterns: harperCavemanExcludePatterns(),
  },);
  const schema = addUseTitleCaseSchema({
    schema: parseJsonObjectOption({
      content: getXmlOptionValue({ block: mainLanguageEntry.block, optionName: 'configurationSchemaContent', })
        ?? '{"properties":{}}',
      optionName: 'configurationSchemaContent',
    },),
  },);
  const cavemanConfig = updateHarperConfig({
    config: omitConfigKey({ config: mainConfig, keyToOmit: 'harper-ls.excludePatterns', },),
    disabledRules: HARPER_CAVEMAN_DISABLED_RULES,
  },);
  const withMain = replaceOrInsertXmlEntry({
    xml: languageXml,
    key: mainUserEntry.key,
    block: buildLanguageSettingsEntry({
      serverId: mainUserEntry.key,
      configContent: formatJson({ value: mainConfig, },),
      schemaContent: formatJson({ value: schema, },),
    },),
  },);
  return replaceOrInsertXmlEntry({
    xml: withMain,
    key: HARPER_CAVEMAN_SERVER_ID,
    block: buildLanguageSettingsEntry({
      serverId: HARPER_CAVEMAN_SERVER_ID,
      configContent: formatJson({ value: cavemanConfig, },),
      schemaContent: formatJson({ value: schema, },),
    },),
  },);
}

/**
 * Builds updated user-defined server XML with special Harper caveman server.
 *
 * @param userDefinedXml - Current user-defined language-server XML.
 *
 * @param mainUserEntry - Main user-defined Harper server entry.
 *
 * @returns Updated user-defined language-server XML.
 *
 * @example
 * ```ts
 * const xml = updatedUserDefinedSettingsXml({ userDefinedXml, mainUserEntry });
 * ```
 */
function updatedUserDefinedSettingsXml(
  { userDefinedXml, mainUserEntry, }: { readonly mainUserEntry: XmlEntry; readonly userDefinedXml: string; },
): string {
  return replaceOrInsertXmlEntry({
    xml: userDefinedXml,
    key: HARPER_CAVEMAN_SERVER_ID,
    block: buildCavemanUserDefinedEntry({
      fileNames: HARPER_CAVEMAN_FILE_NAMES,
      mainEntryBlock: mainUserEntry.block,
      serverId: HARPER_CAVEMAN_SERVER_ID,
      serverName: HARPER_CAVEMAN_SERVER_NAME,
    },),
  },);
}

/**
 * Returns friendly text for unknown caught errors.
 *
 * @param error - Caught value.
 *
 * @returns Human-readable error message.
 *
 * @example
 * ```ts
 * const message = friendlyErrorMessage({ error });
 * ```
 */
function friendlyErrorMessage({ error, }: { readonly error: unknown; },): string {
  if (error instanceof Error) return error.message;
  return String(error,);
}

//endregion LSP4IJ Harper editing

//region Public task: non-blocking editor-local sync

/**
 * Manages local LSP4IJ Harper settings for this repo's writing style.
 * Missing IDEA or Harper LSP4IJ config is intentionally non-blocking because
 * not every developer uses this editor integration.
 *
 * @example
 * ```ts
 * await manageHarperLsp4ijSettings();
 * ```
 */
export async function manageHarperLsp4ijSettings(): Promise<void> {
  const hl = tagged({ tag: manageHarperLsp4ijSettings.name, l, },);
  try {
    const latestOptions = await latestIdeaOptionsDirectory();
    if (latestOptions === undefined) {
      hl.warn('Harper LSP4IJ settings not found: no latest IntelliJ IDEA config with LSP4IJ files exists. Skipping editor-local Harper rule sync.',);
      return;
    }
    const languageSettingsPath = join(latestOptions.optionsDirectory, LANGUAGE_SERVERS_SETTINGS_XML,);
    const userDefinedPath = join(latestOptions.optionsDirectory, USER_DEFINED_LANGUAGE_SERVER_SETTINGS_XML,);
    const [languageXml, userDefinedXml,] = await Promise.all([
      readTrackedExisting({ filePath: languageSettingsPath, },),
      readTrackedExisting({ filePath: userDefinedPath, },),
    ],);
    if (languageXml === undefined || userDefinedXml === undefined) {
      hl.warn(`Harper LSP4IJ settings not found in latest IDEA config (${latestOptions.productDirectory}). Skipping editor-local Harper rule sync.`,);
      return;
    }
    const mainUserEntry = findHarperUserDefinedEntry({ userDefinedXml, },);
    if (mainUserEntry === undefined) {
      hl.warn(`Harper LSP4IJ server not found in latest IDEA config (${latestOptions.productDirectory}). Skipping editor-local Harper rule sync.`,);
      return;
    }
    await Promise.all([
      overwrite({
        dest: languageSettingsPath,
        content: updatedLanguageSettingsXml({ languageXml, mainUserEntry, },),
      },),
      overwrite({
        dest: userDefinedPath,
        content: updatedUserDefinedSettingsXml({ userDefinedXml, mainUserEntry, },),
      },),
    ],);
  }
  catch (error) {
    hl.warn(`Harper LSP4IJ settings were not updated: ${friendlyErrorMessage({ error, })}. Skipping editor-local Harper rule sync.`,);
  }
}

//endregion Public task
