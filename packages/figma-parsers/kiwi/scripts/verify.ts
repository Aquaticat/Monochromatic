/**
 * Verification script for the Figma Kiwi parser.
 *
 * Tests parsing of all three Figma export file types (.fig, .deck, .jam)
 * from the sample files in the Nextcloud reference directory.
 *
 * Run with: bun packages/figma-parsers/kiwi/scripts/verify.ts
 */

import {
  type KiwiSchema,
  parseFigmaFile,
  resolveTypeName,
} from '../src/index.ts';

/**
 * Reference directory holding hand-curated Figma exports used as integration fixtures.
 */
const SOURCE_DIR = '/home/user/Nextcloud/Text/Reference/Figma export';

/**
 * Fixture catalogue covering every Figma file extension the parser must decode.
 */
const TEST_FILES = [
  {
    name: 'Color palette - base.fig',
    type: 'fig' as const,
  },
  {
    name: 'MTM6162-040 participation 2 cover.deck',
    type: 'deck' as const,
  },
  {
    name: 'Todo app - Brainstorming.jam',
    type: 'jam' as const,
  },
];

/**
 * Runs every fixture through the parser and prints a per-file pass/fail summary.
 */
async function main(): Promise<void> {
  /**
   * Running count of fixtures whose checks all succeeded.
   */
  let passed = 0;
  /**
   * Running count of fixtures that hit any failure path (parse, schema, document).
   */
  let failed = 0;

  for (const test of TEST_FILES) {
    /**
     * Absolute fixture path so the parser can read the file directly without resolving the cwd.
     */
    const path = `${SOURCE_DIR}/${test.name}`;
    console.log(`\n=== Testing: ${test.name} ===`,);

    try {
      /**
       * Parsed fixture; later assertions inspect its schema, document, and metadata.
       */
      const file = await parseFigmaFile(path,);

      // Verify file type
      if (file.fileType
        !== test
        .type) {
        console.error(`  FAIL: expected type "${test.type}", got "${file.fileType}"`,);
        failed++;
        continue;
      }
      console.log(`  Type: ${file.fileType}`,);

      // Verify schema
      /**
       * Total number of schema definitions; used in the summary line and as a sanity floor.
       */
      const totalDefs = file.schema
        .definitions
        .length;
      /**
       * Count of ENUM-kind definitions for the summary line.
       */
      const enums = file.schema
        .definitions
        .filter(d => d.kind
          === 'ENUM')
        .length;
      /**
       * Count of STRUCT-kind definitions for the summary line.
       */
      const structs = file.schema
        .definitions
        .filter(d => d.kind
          === 'STRUCT')
        .length;
      /**
       * Count of MESSAGE-kind definitions for the summary line.
       */
      const messages = file.schema
        .definitions
        .filter(d => d.kind
          === 'MESSAGE')
        .length;
      console.log(
        `  Schema: ${totalDefs} definitions (${enums} enums, ${structs} structs, ${messages} messages)`,
      );

      // Verify key schema definitions exist
      /**
       * NodeType enum lookup; required because the DOCUMENT field is the canary the rest of the test relies on.
       */
      const nodeType = file.schema
        .enumByName
        .get('NodeType',);
      if (!nodeType) {
        console.error('  FAIL: NodeType enum not found',);
        failed++;
        continue;
      }
      /**
       * DOCUMENT entry of NodeType; its value must equal 1 to confirm enum decoding is correct.
       */
      const docField = nodeType.fields
        .find(f => f.name
          === 'DOCUMENT');
      if ((!docField) || (docField.value
        !== 1)) {
        console.error(
          `  FAIL: NodeType.DOCUMENT not found or wrong value: ${docField?.value}`,
        );
        failed++;
        continue;
      }

      // Verify document
      if (!file.document) {
        console.error('  FAIL: document is null',);
        failed++;
        continue;
      }

      /**
       * Top-level message discriminator; every fixture is expected to be a NODE_CHANGES payload.
       */
      const msgType = file.document
        .type as string | undefined;
      if (msgType !== 'MessageType.NODE_CHANGES') {
        console.error(`  FAIL: expected MessageType.NODE_CHANGES, got ${msgType}`,);
        failed++;
        continue;
      }

      /**
       * Array of node-change records; presence and array shape are asserted before iterating.
       */
      const nodeChanges = file.document
        .nodeChanges as
        | Record<string, unknown>[]
        | undefined;
      if ((!nodeChanges) || (!Array.isArray(nodeChanges,))) {
        console.error('  FAIL: nodeChanges not found or not an array',);
        failed++;
        continue;
      }
      console.log(`  Document: ${nodeChanges.length} node changes`,);

      // Print first few nodes
      for (let i = 0; i < Math
        .min(
        3,
        nodeChanges.length,
      ); i++) {
        /**
         * Current node-change record from the preview loop; cast through `any` upstream is unavoidable.
         */
        const nc = nodeChanges[i]!;
        /**
         * Display name pulled from the node; falls back to `?` so missing names do not break the log.
         */
        const name = nc.name as string
          ?? '?';
        /**
         * Display type pulled from the node; falls back to `?` for the same reason as `name`.
         */
        const type = nc.type as string
          ?? '?';
        console.log(`    Node ${i + 1}: type=${type} name="${name}"`,);
      }

      // Verify images
      console.log(`  Images: ${file.images
        .size}`,);
      console.log(`  Meta: fileName="${file.meta
        .fileName}"`,);

      passed++;
    }
    catch (err) {
      console.error(`  FAIL: ${err}`,);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`,);
  if (failed > 0)
    process.exitCode = 1;
}

main()
  .catch(err => {
  console.error(err,);
  process.exitCode = 1;
},);
