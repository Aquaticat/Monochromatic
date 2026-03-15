/**
 * Generates CSV perf test input and expected output.
 *
 * Produces 2000 rows of RFC 4180 CSV with a mix of:
 * - Simple unquoted fields
 * - Quoted fields with embedded commas
 * - Quoted fields with escaped double quotes
 * - Quoted fields with embedded newlines
 *
 * A correct implementation parses this in well under 2 seconds; naive
 * character-by-character approaches with excessive string concatenation
 * can take 5-10+ seconds.
 */

/** Number of data rows (excluding header) */
const ROW_COUNT = 2_000;

/** CSV header row */
const header = 'id,name,bio,score';

/**
 * Generates one CSV row and its expected parsed object.
 * @param index - zero-based row index
 * @returns tuple of [csvLine, expectedObject]
 */
function generateRow(index: number,): [string, Record<string, string>,] {
  const id = String(index,);
  const variant = index % 4;

  if (variant === 0) {
    // Simple unquoted fields
    const name = `user${id}`;
    const bio = `simple bio ${id}`;
    const score = String(index * 7 % 100,);
    return [`${id},${name},${bio},${score}`, { id, name, bio, score, },];
  }

  if (variant === 1) {
    // Quoted name with embedded comma
    const name = `"Last, First ${id}"`;
    const bio = `works at company ${id}`;
    const score = String((index * 13 + 3) % 100,);
    return [`${id},${name},${bio},${score}`, { id, name: `Last, First ${id}`, bio,
      score, },];
  }

  if (variant === 2) {
    // Quoted bio with escaped double quote
    const name = `person${id}`;
    const bio = `"said ""hello"" to ${id}"`;
    const score = String((index * 11 + 7) % 100,);
    return [`${id},${name},${bio},${score}`, { id, name, bio: `said "hello" to ${id}`,
      score, },];
  }

  // variant === 3: Quoted bio with embedded newline
  const name = `traveler${id}`;
  const bio = `"likes\ntravel ${id}"`;
  const score = String((index * 17 + 1) % 100,);
  return [`${id},${name},${bio},${score}`, { id, name, bio: `likes\ntravel ${id}`,
    score, },];
}

const rows: string[] = [header,];
const expected: Record<string, string>[] = [];

for (const index of Array.from({ length: ROW_COUNT, },).keys()) {
  const [csvLine, obj,] = generateRow(index,);
  rows.push(csvLine,);
  expected.push(obj,);
}

const csvInput = rows.join('\n',) + '\n';
const expectedOutput = JSON.stringify(expected, null, 2,) + '\n';

const { writeFile, } = await import('node:fs/promises');
await writeFile(new URL('csv-perf-input.txt', import.meta.url,).pathname, csvInput,);
await writeFile(new URL('csv-perf-expected.txt', import.meta.url,).pathname,
  expectedOutput,);

console.log(
  `Generated CSV perf test: ${String(ROW_COUNT,)} rows, ${
    String(csvInput.length,)
  } bytes input, ${String(expectedOutput.length,)} bytes expected output`,
);

export {};
