import {
  readFile,
} from 'node:fs/promises';
import {
  dirname,
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import {
  type Plugin,
} from 'vite';

//region CSS Mixin Plugin -- Text-based @mixin/@apply expansion before LightningCSS

/**
 * Regex to match @mixin definitions.
 * Captures: name (group 1), body content (group 2)
 * Matches: @mixin --name { ... }
 */
const MIXIN_DEFINITION_REGEX = /@mixin\s+(--[\w-]+)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;

/**
 * Regex to match @apply rules.
 * Captures: mixin name (group 1)
 * Matches: @apply --name; or @apply --name
 */
const APPLY_RULE_REGEX = /@apply\s+(--[\w-]+)\s*;?/g;

/**
 * Regex to match CSS @import statements for resolving mixin files.
 * Captures: the path (group 1 or 2 depending on quote style)
 */
const IMPORT_REGEX = /@import\s+(?:url\()?['"]([^'"]+)['"](?:\))?[^;]*;/g;

/** Storage for mixin definitions keyed by mixin name */
const globalMixins = new Map<string, string>();

/**
 * Extracts mixin definitions from CSS content.
 * @param css - CSS source content
 * @returns Map of mixin names to their body content
 */
function extractMixins(css: string,): Map<string, string> {
  const mixins = new Map<string, string>();
  let match: RegExpExecArray | null;

  MIXIN_DEFINITION_REGEX.lastIndex = 0;
  while ((match = MIXIN_DEFINITION_REGEX.exec(css,)) !== null) {
    const mixinName = match[1];
    const mixinBody = match[2];
    if (mixinName && mixinBody !== undefined) {
      mixins.set(mixinName, mixinBody.trim(),);
    }
  }

  return mixins;
}

/**
 * Removes @mixin definitions from CSS content.
 * @param css - CSS source content
 * @returns CSS with @mixin definitions removed
 */
function removeMixinDefinitions(css: string,): string {
  return css.replaceAll(MIXIN_DEFINITION_REGEX, '',);
}

/**
 * Expands @apply rules with mixin content.
 * @param css - CSS source content
 * @param mixins - Map of mixin names to their body content
 * @returns CSS with @apply rules replaced by mixin content
 */
function expandApplyRules(css: string, mixins: Map<string, string>,): string {
  return css.replaceAll(APPLY_RULE_REGEX, (match, mixinName: string,) => {
    const mixinBody = mixins.get(mixinName,) ?? globalMixins.get(mixinName,);
    if (mixinBody) {
      return mixinBody;
    }
    console.warn(`[css-mixin-plugin] Unknown mixin: ${mixinName}`,);
    return `/* Unknown mixin: ${mixinName} */`;
  },);
}

/**
 * Resolves an import path relative to the importing file.
 * @param importPath - The import path from the CSS @import
 * @param importerPath - The absolute path of the importing file
 * @param aliases - Vite alias configuration
 * @returns Resolved absolute path
 */
function resolveImportPath(
  importPath: string,
  importerPath: string,
  aliases: Map<string, string>,
): string {
  // Check aliases first
  for (const [alias, replacement,] of aliases) {
    if (importPath.startsWith(alias,)) {
      return importPath.replace(alias, replacement,);
    }
  }

  // Relative path
  if (importPath.startsWith('.',)) {
    return resolve(dirname(importerPath,), importPath,);
  }

  // Absolute path
  if (isAbsolute(importPath,)) {
    return importPath;
  }

  // Node module - try to resolve from importer's directory
  return join(dirname(importerPath,), 'node_modules', importPath,);
}

/**
 * Loads and extracts mixins from imported CSS files recursively.
 * @param css - CSS content to scan for imports
 * @param filePath - Path of the current CSS file
 * @param aliases - Vite alias configuration
 * @param visited - Set of already visited files to prevent infinite loops
 */
async function loadImportedMixins(
  css: string,
  filePath: string,
  aliases: Map<string, string>,
  visited: Set<string> = new Set(),
): Promise<void> {
  if (visited.has(filePath,)) {
    return;
  }
  visited.add(filePath,);

  let match: RegExpExecArray | null;
  IMPORT_REGEX.lastIndex = 0;

  while ((match = IMPORT_REGEX.exec(css,)) !== null) {
    const importPath = match[1];
    if (!importPath) {
      continue;
    }

    const resolvedPath = resolveImportPath(importPath, filePath, aliases,);

    try {
      const importedCss = await readFile(resolvedPath, 'utf8',);

      // Extract mixins from imported file
      const importedMixins = extractMixins(importedCss,);
      for (const [name, body,] of importedMixins) {
        globalMixins.set(name, body,);
      }

      // Recursively process imports in the imported file
      await loadImportedMixins(importedCss, resolvedPath, aliases, visited,);
    } catch {
      // File not found or unreadable - skip silently
      // The actual CSS processor will handle missing imports
    }
  }
}

/**
 * Creates a Vite plugin that performs text-based mixin expansion.
 * This plugin runs before LightningCSS processes the CSS, avoiding
 * the customAtRules bug that breaks with var() functions.
 * @see https://github.com/parcel-bundler/lightningcss/issues/1081
 * @param mixinFiles - Paths to CSS files containing mixin definitions to preload
 * @returns Vite plugin for CSS mixin expansion
 */
function cssMixinPlugin(mixinFiles: string[] = [],): Plugin {
  let aliases = new Map<string, string>();
  let mixinsLoaded = false;

  return {
    name: 'css-mixin-plugin',
    enforce: 'pre',

    configResolved(config,) {
      // Extract Vite aliases into a Map for import resolution
      const aliasConfig = config.resolve.alias;
      if (Array.isArray(aliasConfig,)) {
        for (const { find, replacement, } of aliasConfig) {
          if (typeof find === 'string') {
            aliases.set(find, replacement,);
          }
        }
      } else if (aliasConfig && typeof aliasConfig === 'object') {
        for (const [key, value,] of Object.entries(aliasConfig,)) {
          if (typeof value === 'string') {
            aliases.set(key, value,);
          }
        }
      }
    },

    async buildStart() {
      // Preload mixins from specified files
      for (const filePath of mixinFiles) {
        let resolvedPath = filePath;

        // Resolve aliases in mixin file paths
        for (const [alias, replacement,] of aliases) {
          if (filePath.startsWith(alias,)) {
            resolvedPath = filePath.replace(alias, replacement,);
            break;
          }
        }

        try {
          const css = await readFile(resolvedPath, 'utf8',);
          const mixins = extractMixins(css,);
          for (const [name, body,] of mixins) {
            globalMixins.set(name, body,);
          }
          console.log(`[css-mixin-plugin] Loaded ${mixins.size} mixins from ${resolvedPath}`,);
        } catch (error) {
          console.warn(`[css-mixin-plugin] Failed to load mixins from ${resolvedPath}:`, error,);
        }
      }
      mixinsLoaded = true;
    },

    async load(id,) {
      // Only process CSS files (not Astro style blocks - those go through transform)
      if (!id.endsWith('.css',)) {
        return null;
      }

      try {
        const code = await readFile(id, 'utf8',);

        // Extract mixins from current file and add to global store
        const localMixins = extractMixins(code,);
        for (const [name, body,] of localMixins) {
          globalMixins.set(name, body,);
        }

        // Remove @mixin definitions from output
        let result = removeMixinDefinitions(code,);

        // Expand @apply rules with mixin content
        result = expandApplyRules(result, localMixins,);

        return {
          code: result,
          map: null,
        };
      } catch {
        return null;
      }
    },

    async transform(code, id,) {
      // Process Astro style blocks (have ?astro&type=style in query)
      // CSS files are handled by load hook
      const isAstroStyle = id.includes('type=style',);
      if (!isAstroStyle) {
        return null;
      }

      // Extract mixins from current code and add to global store
      const localMixins = extractMixins(code,);
      for (const [name, body,] of localMixins) {
        globalMixins.set(name, body,);
      }

      // Remove @mixin definitions from output
      let result = removeMixinDefinitions(code,);

      // Expand @apply rules with mixin content
      result = expandApplyRules(result, localMixins,);

      return {
        code: result,
        map: null,
      };
    },
  };
}

//endregion CSS Mixin Plugin

export { cssMixinPlugin, };
