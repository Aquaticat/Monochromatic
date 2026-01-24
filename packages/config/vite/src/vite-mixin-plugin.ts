import type { Plugin } from 'vite';

//region Vite Mixin Plugin -- Transforms @mixin/@apply in CSS during build

/** Global storage for mixin definitions keyed by name (e.g., "--sr-only") */
const globalMixins = new Map<string, string>();

/**
 * Finds the matching closing brace for an opening brace, handling nested braces.
 * @param css - CSS content
 * @param startIndex - Index of the opening brace
 * @returns Index of the matching closing brace, or -1 if not found
 */
function findMatchingBrace(css: string, startIndex: number): number {
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
 * Extracts mixin definitions from CSS content and stores them globally.
 * @param css - CSS source content
 */
function extractAndStoreMixins(css: string): void {
  const marker = '@mixin ';
  let searchStart = 0;

  while (true) {
    const mixinStart = css.indexOf(marker, searchStart);
    if (mixinStart === -1) {
      break;
    }

    const nameStart = mixinStart + marker.length;
    const braceStart = css.indexOf('{', nameStart);
    if (braceStart === -1) {
      break;
    }

    const mixinName = css.substring(nameStart, braceStart).trim();
    const braceEnd = findMatchingBrace(css, braceStart);
    if (braceEnd === -1) {
      searchStart = braceStart + 1;
      continue;
    }

    const mixinBody = css.substring(braceStart + 1, braceEnd).trim();
    globalMixins.set(mixinName, mixinBody);

    searchStart = braceEnd + 1;
  }
}

/**
 * Removes @mixin definitions from CSS content.
 * @param css - CSS source content
 * @returns CSS with @mixin definitions removed
 */
function removeMixinDefinitions(css: string): string {
  const marker = '@mixin ';
  let result = css;
  let searchStart = 0;

  while (true) {
    const mixinStart = result.indexOf(marker, searchStart);
    if (mixinStart === -1) {
      break;
    }

    const braceStart = result.indexOf('{', mixinStart);
    if (braceStart === -1) {
      break;
    }

    const braceEnd = findMatchingBrace(result, braceStart);
    if (braceEnd === -1) {
      searchStart = braceStart + 1;
      continue;
    }

    result = result.substring(0, mixinStart) + result.substring(braceEnd + 1);
  }

  return result;
}

/**
 * Expands @apply rules with mixin content.
 * @param css - CSS source content
 * @returns CSS with @apply rules replaced by mixin content
 */
function expandApplyRules(css: string): string {
  const marker = '@apply ';
  let result = css;
  let searchStart = 0;

  while (true) {
    const applyStart = result.indexOf(marker, searchStart);
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

    const mixinName = result.substring(nameStart, nameEnd).trim();
    const mixinBody = globalMixins.get(mixinName);

    let applyEnd = nameEnd;
    if (result[nameEnd] === ';') {
      applyEnd = nameEnd + 1;
    }

    if (mixinBody !== undefined) {
      result = result.substring(0, applyStart) + mixinBody + result.substring(applyEnd);
      searchStart = applyStart + mixinBody.length;
    } else {
      const comment = `/* Unknown mixin: ${mixinName} */`;
      result = result.substring(0, applyStart) + comment + result.substring(applyEnd);
      searchStart = applyStart + comment.length;
    }
  }

  return result;
}

/**
 * Processes CSS: extracts mixins, removes definitions, expands @apply rules.
 * @param css - CSS source content
 * @returns Processed CSS
 */
function processCss(css: string): string {
  // First pass: extract all mixin definitions
  extractAndStoreMixins(css);
  // Second pass: remove mixin definitions
  let result = removeMixinDefinitions(css);
  // Third pass: expand @apply rules
  result = expandApplyRules(result);
  return result;
}

/**
 * Creates a Vite plugin that processes @mixin and @apply at-rules in CSS.
 * Uses string-based transformation to work at the Vite level.
 * @returns Vite plugin
 */
function viteMixinPlugin(): Plugin {
  return {
    name: 'vite-mixin-plugin',
    enforce: 'post',

    transform(code, id) {
      // Only process CSS files
      const isCss = id.endsWith('.css') || id.includes('.css?') || id.includes('type=style');
      if (!isCss) {
        return null;
      }

      // Skip node_modules except our style package
      if (id.includes('node_modules') && !id.includes('@monochromatic-dev')) {
        return null;
      }

      // Check if this file has any @mixin or @apply
      if (!code.includes('@mixin ') && !code.includes('@apply ')) {
        return null;
      }

      console.log('[vite-mixin-plugin] Processing:', id);

      const processed = processCss(code);
      if (processed === code) {
        return null;
      }

      console.log('[vite-mixin-plugin] Transformed:', id);

      return {
        code: processed,
        map: null,
      };
    },

    // Process CSS in the generateBundle for bundled CSS assets
    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (fileName.endsWith('.css') && chunk.type === 'asset') {
          const source = typeof chunk.source === 'string' ? chunk.source : chunk.source.toString();
          const processed = processCss(source);
          if (processed !== source) {
            chunk.source = processed;
          }
        }
      }
    },

    // Also hook into renderChunk for CSS that comes through as chunks
    renderChunk(code, chunk) {
      if (chunk.fileName.endsWith('.css')) {
        const processed = processCss(code);
        if (processed !== code) {
          return { code: processed, map: null };
        }
      }
      return null;
    },
  };
}

//endregion Vite Mixin Plugin

export { viteMixinPlugin };
