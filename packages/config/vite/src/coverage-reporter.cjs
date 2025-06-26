// Modified from https://github.com/istanbuljs/istanbuljs/blob/main/packages/istanbul-reports/lib/json/index.js

/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
'use strict';
const { ReportBase } = require('istanbul-lib-report');
const { parse } = require('node:path');
const { minimatch } = require('minimatch');
const vitestExcludeCommonConfig = require('./vitest-exclude-common.json');

const FORMAT_COORDINATE_PAD_LENGTH = 3;
const FORMAT_ENTRY_PAD_LENGTH = 2;
const INDENT_LENGTH = 4;
const NUMBER_FILL_STRING = '0';
const DEBUG = false;

/**
 * Custom text coverage reporter that provides a more compact and readable format than Vitest's built-in text reporter.
 *
 * This reporter improves upon the default by:
 * - Padding all numbers for consistent alignment
 * - Using 'inf' for Infinity and 'und' for undefined values
 * - Providing a cleaner, more scannable output format
 * - Removing duplicate information (like redundant 'line' entries)
 *
 * Example output:
 * ```
 * module/es numeric.type.intsTo10.index.ts
 * st  00:00: 001:000 030:inf
 *     01:00: 002:002 024:inf
 *     02:00: 004:004 023:inf
 *     03:00: 004:027 004:051
 * fn  00:00: name: intsTo ; decl: 001:010 001:017 ; loc: 001:052 025:inf
 *     01:00: name: (anonymous_1) ; decl: 016:021 016:022 ; loc: 017:018 017:inf
 * br  00:00,00: loc: 005:006 007:inf ; type: if ; locations: 005:006 007:inf,
 *     01:00,00: loc: 010:010 010:inf ; type: cond-expr ; locations: 010:026 010:060, 010:060 010:inf
 * ```
 *
 * Format explanation:
 * - stmt: [index]:[count]: [startLine]:[startCol] [endLine]:[endCol]
 * - fn: [index]:[count]: name: [functionName] ; decl: [declStart] [declEnd] ; loc: [locStart] [locEnd]
 * - br: [index]:[count1,count2]: loc: [location] ; type: [branchType] ; locations: [branches]
 */
class MyTextReport extends ReportBase {
  constructor(opts) {
    super();
  }

  onStart(root, context) {
    console.log('custom text coverage report');
  }

  onDetail(node) {
    const { path: cPath, statementMap, fnMap, branchMap, s, f, b } = node
      .getFileCoverage();
    const { base, ext, dir } = parse(cPath);

    // Ignore js files based on shared configuration
    if (
      vitestExcludeCommonConfig.ignoredExtensions.some(function match(ignoredExt) {
        return ignoredExt === ext;
      })
    ) {
      return;
    }

    // Ignore files matching glob patterns from shared configuration

    if (
      [
        ...(vitestExcludeCommonConfig.patterns),
        ...(vitestExcludeCommonConfig.coverageAdditionalPatterns),
      ]
        .some(
          function matchPattern(pattern) {
            const matches = minimatch(cPath, pattern);
            if (DEBUG) {
              console.log(`Pattern: ${pattern} | Matches: ${matches} | Path: ${cPath}`);
            }
            return matches;
          },
        )
    ) {
      return;
    }

    /** Simplified directory path with common prefixes and suffixes removed for cleaner output */
    const dirWoCommon = vitestExcludeCommonConfig
      .pathReplacements
      .reduce(function applyReplacement(currentDir, { pattern, replacement }) {
        // Handle dynamic ${cwd} pattern
        // oxlint-disable-next-line no-template-curly-in-string -- An actual placeholder.
        const actualPattern = pattern.replace('${cwd}', process.cwd());
        return currentDir.replace(actualPattern, replacement);
      }, dir)
      .trim();

    if (
      [statementMap, fnMap, branchMap].some(function nonEmpty(coverageMap) {
        return Object.keys(coverageMap).length > 0;
      })
    ) {
      console.log();
      console.log(
        dirWoCommon,
        base,
      );

      // Process each coverage type
      [
        ['st'.padEnd(INDENT_LENGTH), [statementMap, s]],
        ['fn'.padEnd(INDENT_LENGTH), [fnMap, f]],
        ['br'.padEnd(INDENT_LENGTH), [branchMap, b]],
      ]
        .forEach(function log([name, [coverageMap, countsObj]]) {
          if (Object.keys(coverageMap).length === 0) {
            return;
          }

          const counts = Object.values(countsObj);
          const formattedEntries = Object
            .entries(coverageMap)
            .map(([keyNumber, value]) => formatCoverageEntry(keyNumber, value, counts))
            .join(`\n${''.padEnd(INDENT_LENGTH)}`);

          console.log(`${name}${formattedEntries}`);
        });
    }
  }
}

/**
 * Formats a single coverage entry with padded numbers for alignment.
 * @param {string} keyNumber - Index of the coverage entry
 * @param {object} value - Coverage data for this entry
 * @param {Array} counts - Array of execution counts
 * @returns {string} Formatted coverage entry line
 */
function formatCoverageEntry(keyNumber, value, counts) {
  const paddedKey = String(keyNumber).padStart(FORMAT_ENTRY_PAD_LENGTH,
    NUMBER_FILL_STRING);
  const count = counts.at(keyNumber);

  // Handle comma-separated counts for branches
  const formattedCount = String(count).includes(',')
    ? String(count).split(',').map((num) => num.padStart(2, '0')).join(',')
    : String(count).padStart(FORMAT_ENTRY_PAD_LENGTH, NUMBER_FILL_STRING);

  return `${paddedKey}:${formattedCount}: ${formatValue(value)}`;
}

/**
 * Formats a coverage value based on its type and structure.
 * Handles primitives, location objects, and nested structures.
 * @param {*} value - Coverage value to format
 * @returns {string} Formatted value string
 */
function formatValue(value) {
  if (typeof value !== 'object') {
    return value;
  }

  // Handle objects with start/end properties
  if (value.start) {
    return formatLocation(value);
  }

  // Handle objects without start property (nested structures)
  return Object
    .entries(value)
    .map(([key, val]) => {
      // Skip 'line' key to avoid duplication
      if (key === 'line') return null;
      return `${key}: ${formatNestedValue(val)}`;
    })
    .filter(Boolean)
    .join(' ; ');
}

/**
 * Formats nested values within coverage data.
 * Recursively handles objects, arrays, and location data.
 * @param {*} value - Nested value to format
 * @returns {string} Formatted value string
 */
function formatNestedValue(value) {
  if (typeof value !== 'object') {
    return value;
  }

  if (value.start) {
    return formatLocation(value);
  }

  if (Array.isArray(value)) {
    return value.map(formatArrayItem).join(', ');
  }

  return JSON.stringify(value);
}

/**
 * Formats array items in coverage data.
 * Handles location objects and other array elements.
 * @param {*} item - Array item to format
 * @returns {string} Formatted item string
 */
function formatArrayItem(item) {
  if (typeof item !== 'object') {
    return item;
  }

  if (!item.start) {
    return JSON.stringify(item);
  }

  // Check if start has properties and has line property
  if (Object.keys(item.start).length === 0 || !item.start.line) {
    return '';
  }

  return formatLocation(item);
}

/**
 * Formats a location object with start and end properties.
 * Pads line/column numbers to 3 digits for alignment.
 * Returns empty string if all coordinates are undefined.
 * @param {{start: {line?: number, column?: number}, end: {line?: number, column?: number}}} location - Location object
 * @returns {string} Formatted location string (e.g., "001:000 030:inf")
 */
function formatLocation({ start, end }) {
  // Return empty string if all line/column properties are undefined
  if (
    start.line === undefined && start.column === undefined && end
        .line === undefined && end
        .column === undefined
  ) {
    return '';
  }

  // Format with 'und' for undefined, 'inf' for Infinity, otherwise pad numbers to 2 digits
  const formatCoordinate = (value) => {
    if (value === undefined) return 'und';
    if (value === Infinity) return 'inf';
    return String(value).padStart(FORMAT_COORDINATE_PAD_LENGTH, NUMBER_FILL_STRING);
  };

  const startLine = formatCoordinate(start.line);
  const startColumn = formatCoordinate(start.column);
  const endLine = formatCoordinate(end.line);
  const endColumn = formatCoordinate(end.column);

  return `${startLine}:${startColumn} ${endLine}:${endColumn}`;
}

module.exports = MyTextReport;
