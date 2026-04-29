/**
 * Verification script for the Figma Kiwi parser.
 *
 * Tests parsing of all three Figma export file types (.fig, .deck, .jam)
 * from the sample files in the Nextcloud reference directory.
 *
 * Run with: bun packages/figma-parsers/kiwi/scripts/verify.ts
 */

import { parseFigmaFile, resolveTypeName, type KiwiSchema } from "../src/index.ts";

const SOURCE_DIR = "/home/user/Nextcloud/Text/Reference/Figma export";

const TEST_FILES = [
  { name: "Color palette - base.fig", type: "fig" as const },
  { name: "MTM6162-040 participation 2 cover.deck", type: "deck" as const },
  { name: "Todo app - Brainstorming.jam", type: "jam" as const },
];

async function main(): Promise<void> {
  let passed = 0;
  let failed = 0;

  for (const test of TEST_FILES) {
    const path = `${SOURCE_DIR}/${test.name}`;
    console.log(`\n=== Testing: ${test.name} ===`);

    try {
      const file = await parseFigmaFile(path);

      // Verify file type
      if (file.fileType !== test.type) {
        console.error(`  FAIL: expected type "${test.type}", got "${file.fileType}"`);
        failed++;
        continue;
      }
      console.log(`  Type: ${file.fileType}`);

      // Verify schema
      const totalDefs = file.schema.definitions.length;
      const enums = file.schema.definitions.filter((d) => d.kind === "ENUM").length;
      const structs = file.schema.definitions.filter((d) => d.kind === "STRUCT").length;
      const messages = file.schema.definitions.filter((d) => d.kind === "MESSAGE").length;
      console.log(`  Schema: ${totalDefs} definitions (${enums} enums, ${structs} structs, ${messages} messages)`);

      // Verify key schema definitions exist
      const nodeType = file.schema.enumByName.get("NodeType");
      if (!nodeType) {
        console.error("  FAIL: NodeType enum not found");
        failed++;
        continue;
      }
      const docField = nodeType.fields.find((f) => f.name === "DOCUMENT");
      if (!docField || docField.value !== 1) {
        console.error(`  FAIL: NodeType.DOCUMENT not found or wrong value: ${docField?.value}`);
        failed++;
        continue;
      }

      // Verify document
      if (!file.document) {
        console.error("  FAIL: document is null");
        failed++;
        continue;
      }

      const msgType = file.document.type as string | undefined;
      if (msgType !== "MessageType.NODE_CHANGES") {
        console.error(`  FAIL: expected MessageType.NODE_CHANGES, got ${msgType}`);
        failed++;
        continue;
      }

      const nodeChanges = file.document.nodeChanges as Record<string, unknown>[] | undefined;
      if (!nodeChanges || !Array.isArray(nodeChanges)) {
        console.error("  FAIL: nodeChanges not found or not an array");
        failed++;
        continue;
      }
      console.log(`  Document: ${nodeChanges.length} node changes`);

      // Print first few nodes
      for (let i = 0; i < Math.min(3, nodeChanges.length); i++) {
        const nc = nodeChanges[i]!;
        const name = nc.name as string ?? "?";
        const type = nc.type as string ?? "?";
        console.log(`    Node ${i + 1}: type=${type} name="${name}"`);
      }

      // Verify images
      console.log(`  Images: ${file.images.size}`);
      console.log(`  Meta: fileName="${file.meta.fileName}"`);

      passed++;
    } catch (err) {
      console.error(`  FAIL: ${err}`);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
