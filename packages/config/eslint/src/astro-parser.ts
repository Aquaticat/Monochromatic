import * as tsParser from '@typescript-eslint/parser';
import { analyze, } from '@typescript-eslint/scope-manager';
import {
  AST_NODE_TYPES,
  type TSESTree,
} from '@typescript-eslint/types';

/** Type of result returned by TypeScript ESLint parser */
type ParseForESLintResult = ReturnType<typeof tsParser.parseForESLint>;

/** Delimiter for Astro frontmatter sections */
const FRONTMATTER_DELIMITER = '---';

/** Script opening tag without closing \> to handle attributes like <script lang="ts"> */
const SCRIPT_TAG_OPEN = '<script';

/** Script closing tag */
const SCRIPT_TAG_CLOSE = '</script>';

/** Represents a segment of code extracted from the Astro file */
type CodeSegment = {
  /** Extracted code content */
  content: string;
  /** Line number where this segment starts in the original file */
  startLine: number;
};

/**
 * Custom ESLint parser for Astro files.
 * Extracts and parses only the frontmatter and script content.
 *
 * How this works:
 * 1. Extract TypeScript/JavaScript code from Astro frontmatter (---...---)
 * 2. Extract code from all <script> tags
 * 3. Combine all extracted code while maintaining line numbers
 * 4. Parse the combined code using TypeScript ESLint parser
 * 5. Return the AST for ESLint to analyze
 *
 * @param code - Source code of the Astro file to parse.
 * @param options - Parser options from ESLint configuration.
 * @returns Parser result containing AST, scope manager, services, and visitor keys.
 */
export function parseForESLint(
  code: string,
  options: any = {},
): ParseForESLintResult {
  // Extract all TypeScript/JavaScript segments from the Astro file
  const segments: CodeSegment[] = [
    ...extractFrontmatter(code,),
    ...extractScriptTags(code,),
  ];

  // Combine segments into a single string with proper line number preservation
  const extractedTypeScriptCode = combineSegments(segments,);

  // If no TypeScript/JavaScript content found, return empty AST to prevent ESLint errors
  if (extractedTypeScriptCode.trim().length === 0)
    return createEmptyResult(options,);

  /** Parse the extracted TypeScript code using TypeScript ESLint parser */
  try {
    /** Pass the extracted TypeScript code to TypeScript ESLint parser
     *  Options are already configured in the main ESLint config */
    const result = tsParser.parseForESLint(extractedTypeScriptCode, options,);

    // Return the parser result directly (includes: ast, services, scopeManager, visitorKeys)
    return result;
  }
  catch (error) {
    /** If parsing fails, return a valid empty AST so ESLint doesn't crash */
    console.error('Error parsing Astro file:', error,);
    return createErrorResult(extractedTypeScriptCode,);
  }
}

/**
 * Extracts frontmatter content from Astro file.
 * @param code - Source code of Astro file.
 * @returns Array containing frontmatter segment or empty if none found.
 */
function extractFrontmatter(code: string,): CodeSegment[] {
  // Frontmatter must start with --- on the first line
  if (!code.startsWith(FRONTMATTER_DELIMITER + '\n',))
    return [];

  // Find the closing delimiter
  const startIndex = FRONTMATTER_DELIMITER.length + 1;
  let currentIndex = startIndex;

  while (currentIndex < code.length - FRONTMATTER_DELIMITER.length) {
    if (
      code[currentIndex] === '\n'
      && code.slice(currentIndex + 1, currentIndex + 1 + FRONTMATTER_DELIMITER.length,)
        === FRONTMATTER_DELIMITER
    ) {
      // Found closing delimiter
      /** Extract content between opening and closing --- */
      const content = code.slice(startIndex, currentIndex,);
      return [{
        content,
        // Frontmatter content starts on line 2 (after ---)\n
        startLine: 2,
      },];
    }
    currentIndex++;
  }

  // No closing delimiter found
  return [];
}

/**
 * Extracts all script tag contents from Astro file.
 * @param code - Source code of Astro file.
 * @returns Array of code segments from script tags.
 */
function extractScriptTags(code: string,): CodeSegment[] {
  const segments: CodeSegment[] = [];
  /** Current position in source code */
  let currentIndex = 0;

  /**
   * Gets line number for given character index.
   * @param targetIndex - Character index in source code.
   * @returns Line number (1-based).
   */
  const getLineNumber = (targetIndex: number,): number => {
    // Count newlines in substring from start to targetIndex
    return code.slice(0, targetIndex,).split('\n',).length;
  };

  /** Scan through the entire source code looking for script tags */
  while (currentIndex < code.length - SCRIPT_TAG_OPEN.length) {
    if (
      code.slice(currentIndex, currentIndex + SCRIPT_TAG_OPEN.length,)
        === SCRIPT_TAG_OPEN
    ) {
      // Found opening tag, find closing >
      /** Position to search for closing bracket */
      let tagEndIndex = currentIndex + SCRIPT_TAG_OPEN.length;
      while (tagEndIndex < code.length && code[tagEndIndex] !== '>')
        tagEndIndex++;

      if (tagEndIndex < code.length) {
        // Found >, now find closing tag
        /** Index where script content starts */
        const contentStartIndex = tagEndIndex + 1;
        /** Line number where script content starts */
        const contentStartLine = getLineNumber(contentStartIndex,);

        // Search for closing tag
        /** Mutable index to scan for closing script tag */
        let contentEndIndex = contentStartIndex;
        while (contentEndIndex < code.length - SCRIPT_TAG_CLOSE.length) {
          if (
            code.slice(contentEndIndex, contentEndIndex + SCRIPT_TAG_CLOSE.length,)
              === SCRIPT_TAG_CLOSE
          ) {
            // Found closing tag
            /** Extract script content */
            const content = code.slice(contentStartIndex, contentEndIndex,);
            segments.push({
              content,
              startLine: contentStartLine,
            },);
            currentIndex = contentEndIndex + SCRIPT_TAG_CLOSE.length;
            break;
          }
          contentEndIndex++;
        }

        if (contentEndIndex >= code.length - SCRIPT_TAG_CLOSE.length) {
          // No closing tag found, skip this opening tag
          currentIndex++;
        }
      }
      else {
        // No closing > found, skip
        currentIndex++;
      }
    }
    else {
      currentIndex++;
    }
  }

  return segments;
}

/**
 * Combines code segments with proper line number padding.
 * @param segments - Array of code segments to combine.
 * @returns Combined code with newlines to preserve line numbers.
 */
function combineSegments(segments: CodeSegment[],): string {
  if (segments.length === 0)
    return '';

  /** Segments sorted by start line number to ensure correct ordering when combining */
  const sortedSegments = [...segments,].sort((a, b,) => a.startLine - b.startLine);

  /** Mutable string accumulator for building padded output incrementally */
  let result = '';
  /** Mutable line tracker to calculate how many newlines to insert for each segment */
  let currentLine = 1;

  for (const segment of sortedSegments) {
    // Add newlines to reach the correct line
    while (currentLine < segment.startLine) {
      result += '\n';
      currentLine++;
    }

    // Add the content
    result += segment.content;
    currentLine += segment.content.split('\n',).length - 1;
  }

  return result;
}

/**
 * Creates empty AST result for files with no TypeScript content.
 * @param options - Parser options from ESLint config.
 * @returns Valid parser result with empty AST.
 */
function createEmptyResult(options: any,): ParseForESLintResult {
  // Create a valid but empty AST structure
  /** Empty AST structure for files with no TypeScript content */
  const emptyAst: TSESTree.Program = {
    // Root node type for ESLint AST
    type: AST_NODE_TYPES.Program,
    // No statements in the program
    body: [],
    // ES modules (not script)
    sourceType: 'module',
    // Position in source: start to end
    range: [0, 0,],
    // Line/column location info
    loc: {
      start: { line: 1, column: 0, },
      end: { line: 1, column: 0, },
    },
    // No tokens to parse
    tokens: [],
    // No comments
    comments: [],
  };

  /** Create a scope manager for the empty AST (required by ESLint for variable scoping analysis) */
  const scopeManager = analyze(emptyAst, {
    sourceType: 'module',
    // Not in Node.js global scope
    globalReturn: false,
    // Available global variables (ES features)
    lib: ['esnext',],
  },);

  /** Parse empty string to match TypeScript ESLint parser return structure */
  const result = tsParser.parseForESLint('', options,);
  // Return empty result but preserve our scope manager
  return {
    ...result,
    // Use our scope manager for the empty AST
    scopeManager,
  };
}

/**
 * Creates error AST result for parse failures.
 * @param extractedCode - Extracted TypeScript code that failed to parse.
 * @returns Valid parser result for error recovery.
 */
function createErrorResult(extractedCode: string,): ParseForESLintResult {
  /** Create an error AST that spans the whole file */
  const errorAst: TSESTree.Program = {
    type: AST_NODE_TYPES.Program,
    body: [],
    sourceType: 'module',
    // Full file range
    range: [0, extractedCode.length,],
    loc: {
      start: { line: 1, column: 0, },
      end: { line: extractedCode.split('\n',).length, column: 0, },
    },
    tokens: [],
    comments: [],
  };

  /** Create scope manager for the error AST */
  const scopeManager = analyze(errorAst, {
    sourceType: 'module',
    globalReturn: false,
    lib: ['esnext',],
  },);

  /** Parse empty string to get valid services structure for error recovery */
  const emptyResult = tsParser.parseForESLint('', {},);
  // Return error result with custom scope manager
  return {
    ...emptyResult,
    // Use our scope manager for the error AST
    scopeManager,
  };
}

/**
 * Parses Astro file and returns AST.
 * Some tools expect a simple parse function that returns just the AST.
 * @param code - Source code to parse.
 * @param options - Parser options.
 * @returns AST Program node.
 */
export const parse = (code: string, options?: any,): TSESTree.Program =>
  parseForESLint(code, options,).ast;

/** Parser metadata used by ESLint for cache and debugging */
export const meta = {
  name: 'astro-parser',
  version: '1.0.0',
};
