import { existsSync, readFileSync, } from 'node:fs';
import { dirname, } from 'node:path';
import { ResolverFactory, } from 'oxc-resolver';
import { globSync, } from 'tinyglobby';
import {
  type Plugin,
  type ResolvedConfig,
} from 'vite';

//region CSS Mixin Plugin -- Text-based @mixin/@apply expansion before LightningCSS

/** Storage for mixin definitions keyed by mixin name */
const globalMixins = new Map<string, string>();

/**
 * Finds the matching closing brace for an opening brace, handling nested braces.
 * @param css - CSS content
 * @param startIndex - Index of the opening brace
 * @returns Index of the matching closing brace, or -1 if not found
 */
function findMatchingBrace(css: string, startIndex: number,): number {
  let depth = 1;
  let index = startIndex + 1;

  while (index < css.length && depth > 0) {
    const char = css[index];
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
    }
    index++;
  }

  return depth === 0 ? index - 1 : -1;
}

/**
 * Extracts mixin definitions from CSS content using string operations.
 * @param css - CSS source content
 * @returns Map of mixin names to their body content
 */
function extractMixins(css: string,): Map<string, string> {
  const mixins = new Map<string, string>();
  const marker = '@mixin ';
  let searchStart = 0;

  while (true) {
    const mixinStart = css.indexOf(marker, searchStart,);
    if (mixinStart === -1) {
      break;
    }

    const nameStart = mixinStart + marker.length;
    const braceStart = css.indexOf('{', nameStart,);
    if (braceStart === -1) {
      break;
    }

    const mixinName = css.substring(nameStart, braceStart,).trim();
    const braceEnd = findMatchingBrace(css, braceStart,);
    if (braceEnd === -1) {
      searchStart = braceStart + 1;
      continue;
    }

    const mixinBody = css.substring(braceStart + 1, braceEnd,).trim();
    mixins.set(mixinName, mixinBody,);

    searchStart = braceEnd + 1;
  }

  return mixins;
}

/**
 * Extracts @import paths from CSS content using string operations.
 * Handles both `@import 'path';` and `@import "path";` syntax.
 * @param css - CSS source content
 * @returns Array of import paths
 */
function extractImports(css: string,): string[] {
  const imports: string[] = [];
  const marker = '@import ';
  let searchStart = 0;

  while (true) {
    const importStart = css.indexOf(marker, searchStart,);
    if (importStart === -1) {
      break;
    }

    const afterMarker = importStart + marker.length;
    const quoteChar = css[afterMarker];

    if (quoteChar !== '"' && quoteChar !== "'") {
      searchStart = afterMarker;
      continue;
    }

    const pathStart = afterMarker + 1;
    const pathEnd = css.indexOf(quoteChar, pathStart,);

    if (pathEnd === -1) {
      searchStart = pathStart;
      continue;
    }

    const importPath = css.substring(pathStart, pathEnd,);
    imports.push(importPath,);

    searchStart = pathEnd + 1;
  }

  return imports;
}

/**
 * Recursively scans a CSS file and its imports for mixin definitions.
 * @param filePath - Absolute path to the CSS file
 * @param resolver - oxc-resolver instance for resolving imports
 * @param visited - Set of already visited files to prevent cycles
 */
function scanFileForMixins(
  filePath: string,
  resolver: ResolverFactory,
  visited: Set<string>,
): void {
  if (visited.has(filePath,)) {
    return;
  }
  visited.add(filePath,);

  if (!existsSync(filePath,)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8',);
  const mixins = extractMixins(content,);

  for (const [name, body,] of mixins) {
    globalMixins.set(name, body,);
  }

  const imports = extractImports(content,);
  const fileDir = dirname(filePath,);

  for (const importPath of imports) {
    const resolved = resolver.sync(fileDir, importPath,);

    if (resolved.path) {
      scanFileForMixins(resolved.path, resolver, visited,);
    }
  }
}

/**
 * Converts Vite's alias configuration to oxc-resolver alias format.
 * oxc-resolver expects: Record<string, Array<string | undefined | null>>
 * @param config - Resolved Vite config
 * @returns Alias object for oxc-resolver
 */
function convertAliasesToOxcFormat(
  config: ResolvedConfig,
): Record<string, string[]> {
  const aliases = config.resolve.alias;
  const result: Record<string, string[]> = {};

  if (Array.isArray(aliases,)) {
    for (const alias of aliases) {
      if (typeof alias.find === 'string') {
        result[alias.find] = [alias.replacement,];
      }
    }
  }

  return result;
}

/**
 * Removes @mixin definitions from CSS content using string operations.
 * @param css - CSS source content
 * @returns CSS with @mixin definitions removed
 */
function removeMixinDefinitions(css: string,): string {
  const marker = '@mixin ';
  let result = css;
  let searchStart = 0;

  while (true) {
    const mixinStart = result.indexOf(marker, searchStart,);
    if (mixinStart === -1) {
      break;
    }

    const braceStart = result.indexOf('{', mixinStart,);
    if (braceStart === -1) {
      break;
    }

    const braceEnd = findMatchingBrace(result, braceStart,);
    if (braceEnd === -1) {
      searchStart = braceStart + 1;
      continue;
    }

    result = result.substring(0, mixinStart,) + result.substring(braceEnd + 1,);
  }

  return result;
}

/**
 * Expands @apply rules with mixin content using string operations.
 * @param css - CSS source content
 * @param localMixins - Map of locally defined mixin names to their body content
 * @returns CSS with @apply rules replaced by mixin content
 */
function expandApplyRules(css: string, localMixins: Map<string, string>,): string {
  const marker = '@apply ';
  let result = css;
  let searchStart = 0;

  while (true) {
    const applyStart = result.indexOf(marker, searchStart,);
    if (applyStart === -1) {
      break;
    }

    const nameStart = applyStart + marker.length;
    let nameEnd = nameStart;

    while (nameEnd < result.length) {
      const char = result[nameEnd];
      if (char === ';' || char === '\n' || char === '\r' || char === '}') {
        break;
      }
      nameEnd++;
    }

    const mixinName = result.substring(nameStart, nameEnd,).trim();
    const mixinBody = localMixins.get(mixinName,) ?? globalMixins.get(mixinName,);

    let applyEnd = nameEnd;
    if (result[nameEnd] === ';') {
      applyEnd = nameEnd + 1;
    }

    if (mixinBody !== undefined) {
      result = result.substring(0, applyStart,) + mixinBody + result.substring(applyEnd,);
      searchStart = applyStart + mixinBody.length;
    } else {
      const comment = `/* Unknown mixin: ${mixinName} */`;
      result = result.substring(0, applyStart,) + comment + result.substring(applyEnd,);
      searchStart = applyStart + comment.length;
    }
  }

  return result;
}

/**
 * Processes CSS content: extracts mixins, removes definitions, expands @apply rules.
 * @param css - CSS source content
 * @returns Processed CSS
 */
function processCss(css: string,): string {
  const localMixins = extractMixins(css,);

  for (const [name, body,] of localMixins) {
    globalMixins.set(name, body,);
  }

  let result = removeMixinDefinitions(css,);
  result = expandApplyRules(result, localMixins,);

  return result;
}

/**
 * Scans all CSS files in the project for mixin definitions.
 * Follows @import statements to discover mixins in external packages.
 * @param config - Resolved Vite config
 */
function discoverMixins(config: ResolvedConfig,): void {
  const aliases = convertAliasesToOxcFormat(config,);

  const resolver = new ResolverFactory({
    extensions: ['.css',],
    mainFields: ['style',],
    conditionNames: ['style',],
    alias: aliases,
  },);

  const cssFiles = globSync(['**/*.css',], {
    cwd: config.root,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.vite/**',],
  },);

  const visited = new Set<string>();

  for (const file of cssFiles) {
    scanFileForMixins(file, resolver, visited,);
  }
}

/**
 * Creates Vite plugins that perform text-based mixin expansion.
 * Uses the transform.filter API (Vite 6+) to intercept CSS before internal processing.
 * Automatically discovers all @mixin definitions from CSS files in the project and their imports.
 * @see https://github.com/parcel-bundler/lightningcss/issues/1081
 * @returns Array of Vite plugins for CSS mixin expansion
 */
function cssMixinPlugin(): Plugin[] {
  return [
    {
      name: 'css-mixin-plugin:serve',
      apply: 'serve',
      enforce: 'pre',

      configResolved(config,) {
        discoverMixins(config,);
      },

      transform: {
        filter: {
          id: {
            exclude: [/\/\.vite\//,],
            include: [/\.css(?:\?.*)?$/, /&lang\.css/, /[?&]index=\d+\.css$/,],
          },
        },
        handler(src, _id,) {
          return processCss(src,);
        },
      },
    },
    {
      name: 'css-mixin-plugin:build',
      apply: 'build',
      enforce: 'pre',

      configResolved(config,) {
        discoverMixins(config,);
      },

      transform: {
        filter: {
          id: {
            exclude: [/\/\.vite\//,],
            include: [/\.css(?:\?.*)?$/, /&lang\.css/, /[?&]index=\d+\.css$/,],
          },
        },
        handler(src, _id,) {
          return processCss(src,);
        },
      },
    },
  ];
}

//endregion CSS Mixin Plugin

export { cssMixinPlugin, };
