import { createHash, } from 'node:crypto';
import { readdir, symlink, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { inputCli, inputCliFixture, inputLaunchArguments, } from './producer-input-cli.test-fixture.ts';

/** This text occurs only inside synthetic launch bodies and must not enter CLI refusals. */
const PRIVATE_CANARY = 'q7z9k2-private-launch-text';
/** Public bootstrap refusal code, distinct from an unexpected fault. */
const REFUSED = 6;
/** Fixed metadata ceiling is exercised at its first excluded extent. */
const METADATA_LIMIT = 1_048_576;
/** Byte that cannot begin a valid UTF-8 sequence. */
const INVALID_UTF8 = 0xFF;
/** Fixed digest width is independent from candidate CLI data. */
const SHA256_WIDTH = 64;
/** Canonical digest-shaped value for syntax tests that must not reach file reading. */
const DIGEST = '0'.repeat(SHA256_WIDTH);

await describe({ name: '', concurrency: 1, children: [
  it({ name: 'runs the built standalone help without a launch or application import', fn: async function help() {
    await using fixture = await inputCliFixture();
    const result = inputCli({ fixture, arguments_: ['--help'] });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('without provider calls');
    expect(result.stdout).toContain('not root, phase or writer approval');
    expect(await readdir(fixture.directory)).toEqual(['producer-prepare.mjs']);
  } }),
  ...[
    [],
    ['--unknown', PRIVATE_CANARY],
    [PRIVATE_CANARY],
    ['--help', '--launch', PRIVATE_CANARY],
    ['--sealed-preparation-child', '--help'],
    ['--launch', 'relative.json', '--launch-sha256', DIGEST, '--launch-bytes', '2'],
    ['--launch', '/not-read', '--launch-sha256', DIGEST, '--launch-bytes', '02'],
    ['--launch', '/not-read', '--launch-sha256', DIGEST, '--launch-bytes', '0'],
    ['--launch', '/not-read', '--launch-sha256', DIGEST, '--launch-bytes', '-1'],
    ['--launch', '/not-read', '--launch-sha256', DIGEST, '--launch-bytes', '1.5'],
    ['--launch', '/not-read', '--launch-sha256', DIGEST, '--launch-bytes', '1e2'],
    ['--launch', '/not-read', '--launch-sha256', DIGEST, '--launch-bytes', String(METADATA_LIMIT + 1)],
    ['--launch', '/not-read', '--launch-sha256', 'A'.repeat(SHA256_WIDTH), '--launch-bytes', '2'],
    ['--launch', '/not-read', '--launch-sha256', 'g'.repeat(SHA256_WIDTH), '--launch-bytes', '2'],
  ].map(function invalid(arguments_, index) {
    return it({ name: `refuses unsupported CLI grammar ${String(index)}`, fn: async function grammar() {
      await using fixture = await inputCliFixture();
      const result = inputCli({ fixture, arguments_ });
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(REFUSED);
      expect(result.stderr).toContain('producer-prepare:');
      expect(result.stderr).not.toContain(PRIVATE_CANARY);
      expect(await readdir(fixture.directory)).toEqual(['producer-prepare.mjs']);
    } });
  }),
  it({ name: 'refuses duplicate launch identity options before reading the file', fn: async function duplicate() {
    await using fixture = await inputCliFixture();
    const arguments_ = ['--launch', '/not-read', '--launch-sha256', DIGEST, '--launch-bytes', '2', '--launch-bytes', '2'];
    const result = inputCli({ fixture, arguments_ });
    expect(result.status).toBe(REFUSED);
    expect(result.stderr).toContain('duplicate CLI option');
  } }),
  it({ name: 'refuses the private child sentinel outside its exact inherited context', fn: async function child() {
    await using fixture = await inputCliFixture();
    const result = inputCli({ fixture, arguments_: ['--sealed-preparation-child'] });
    expect(result.status).toBe(REFUSED);
    expect(result.stderr).toContain('child launch identity');
    expect(await readdir(fixture.directory)).toEqual(['producer-prepare.mjs']);
  } }),
  ...['[]', 'null', 'true', '42', `{"unknown":"${PRIVATE_CANARY}"}`, `{"${PRIVATE_CANARY}`].map(function malformed(text, index) {
    return it({ name: `rejects malformed or unregistered launch shape ${String(index)} without excerpts`, fn: async function shape() {
      await using fixture = await inputCliFixture();
      const arguments_ = await inputLaunchArguments({ fixture, bytes: new TextEncoder().encode(text) });
      const result = inputCli({ fixture, arguments_ });
      expect(result.status).toBe(REFUSED);
      expect(result.stderr).not.toContain(PRIVATE_CANARY);
      expect(result.stderr).not.toContain('SyntaxError');
      expect((await readdir(fixture.directory)).toSorted()).toEqual(['launch.json', 'producer-prepare.mjs']);
    } });
  }),
  it({ name: 'rejects invalid UTF-8 even when raw byte identity matches', fn: async function utf8() {
    await using fixture = await inputCliFixture();
    const bytes = Buffer.concat([Buffer.from(PRIVATE_CANARY), Buffer.from([INVALID_UTF8])]);
    const arguments_ = await inputLaunchArguments({ fixture, bytes });
    const result = inputCli({ fixture, arguments_ });
    expect(result.status).toBe(REFUSED);
    expect(result.stderr).not.toContain(PRIVATE_CANARY);
    expect(result.stderr).not.toContain('TypeError');
  } }),
  it({ name: 'refuses changed launch bytes before JSON interpretation', fn: async function digest() {
    await using fixture = await inputCliFixture();
    const original = new TextEncoder().encode(`{"note":"${PRIVATE_CANARY}"}`);
    const arguments_ = await inputLaunchArguments({ fixture, bytes: original });
    await writeFile(join(fixture.directory, 'launch.json'), Buffer.alloc(original.length, 'x'));
    const result = inputCli({ fixture, arguments_ });
    expect(result.status).toBe(REFUSED);
    expect(result.stderr).toContain('launch.json');
    expect(result.stderr).not.toContain(PRIVATE_CANARY);
  } }),
  it({ name: 'refuses a symlink launch leaf even when target bytes match', fn: async function link() {
    await using fixture = await inputCliFixture();
    const bytes = Buffer.from('{}');
    await inputLaunchArguments({ fixture, bytes });
    const alias = join(fixture.directory, 'alias.json');
    await symlink(join(fixture.directory, 'launch.json'), alias);
    const result = inputCli({ fixture, arguments_: ['--launch', alias, '--launch-sha256', createHash('sha256').update(bytes).digest('hex'), '--launch-bytes', String(bytes.length)] });
    expect(result.status).toBe(REFUSED);
    expect(result.stderr).toContain('alias.json');
  } }),
] });
