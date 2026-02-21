import { join, } from 'node:path';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
  mkdir,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { reads, reset, writeTimestamps, writes, } from './tracker.ts';

//region integration tests with real config files

describe('integration: config execution', () => {
  /** Temporary directory created fresh for each test */
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'file-enforcer-integ-'));
    reset();
    writeTimestamps.clear();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true, });
  });

  test('config file that copies one file to another', async () => {
    expect.assertions(2);
    /** Source file with known content */
    await writeFile(join(tempDir, 'source.md'), '# Source Content');

    /** Config that imports from the package and runs a simple copy */
    const configContent = `
      import { cat, overwrite } from '${join(import.meta.dirname, 'mod.ts')}';
      await overwrite('${join(tempDir, 'dest.md')}', await cat(['${join(tempDir, 'source.md')}']));
    `;
    /** Write config to temp dir so it can be imported */
    const configPath = join(tempDir, 'test.config.ts');
    await writeFile(configPath, configContent);

    // Execute the config by importing it
    await import(configPath);

    /** Destination should have the source content */
    expect(await readFile(join(tempDir, 'dest.md'), 'utf8')).toBe('# Source Content');
    /** Tracker should have recorded the read */
    expect(reads.size).toBeGreaterThan(0);
  });

  test('config file that concatenates multiple sources', async () => {
    expect.assertions(1);
    await writeFile(join(tempDir, 'a.txt'), 'aaa');
    await writeFile(join(tempDir, 'b.txt'), 'bbb');

    /** Config concatenating two files */
    const configContent = `
      import { cat, overwrite } from '${join(import.meta.dirname, 'mod.ts')}';
      await overwrite(
        '${join(tempDir, 'combined.txt')}',
        await cat(['${join(tempDir, 'a.txt')}', '${join(tempDir, 'b.txt')}'])
      );
    `;
    const configPath = join(tempDir, 'concat.config.ts');
    await writeFile(configPath, configContent);

    await import(configPath);

    expect(await readFile(join(tempDir, 'combined.txt'), 'utf8')).toBe('aaa\nbbb');
  });

  test('config file using dedup transform', async () => {
    expect.assertions(1);
    await writeFile(join(tempDir, 'dupes.txt'), 'line1\nline2\nline1\nline3');

    /** Config that reads, deduplicates, and writes */
    const configContent = `
      import { cat, dedup, overwrite } from '${join(import.meta.dirname, 'mod.ts')}';
      await overwrite(
        '${join(tempDir, 'unique.txt')}',
        dedup(await cat(['${join(tempDir, 'dupes.txt')}']))
      );
    `;
    const configPath = join(tempDir, 'dedup.config.ts');
    await writeFile(configPath, configContent);

    await import(configPath);

    expect(await readFile(join(tempDir, 'unique.txt'), 'utf8')).toBe('line1\nline2\nline3');
  });

  test('config file using getProperty transform', async () => {
    expect.assertions(1);
    /** JSON source file */
    const jsonContent = JSON.stringify({ config: { name: 'test-project', }, });
    await writeFile(join(tempDir, 'data.json'), jsonContent);

    /** Config that extracts a property from JSON */
    const configContent = `
      import { cat, getProperty, overwrite } from '${join(import.meta.dirname, 'mod.ts')}';
      await overwrite(
        '${join(tempDir, 'name.txt')}',
        getProperty('.config.name', await cat(['${join(tempDir, 'data.json')}']))
      );
    `;
    const configPath = join(tempDir, 'prop.config.ts');
    await writeFile(configPath, configContent);

    await import(configPath);

    expect(await readFile(join(tempDir, 'name.txt'), 'utf8')).toBe('test-project');
  });

  test('config file tracks both reads and writes', async () => {
    expect.assertions(2);
    await writeFile(join(tempDir, 'input.md'), 'tracked');

    /** Config with a simple copy to verify tracker state */
    const configContent = `
      import { cat, overwrite } from '${join(import.meta.dirname, 'mod.ts')}';
      await overwrite('${join(tempDir, 'output.md')}', await cat(['${join(tempDir, 'input.md')}']));
    `;
    const configPath = join(tempDir, 'tracked.config.ts');
    await writeFile(configPath, configContent);

    await import(configPath);

    /** Both sets should be populated */
    expect(reads.size).toBeGreaterThan(0);
    expect(writes.size).toBeGreaterThan(0);
  });

  test('config using addWatchedPaths for exec dependencies', async () => {
    expect.assertions(1);
    await writeFile(join(tempDir, 'dep.json'), '{"version":"1.0"}');

    /** Config that registers a manual dependency via addWatchedPaths */
    const configContent = `
      import { addWatchedPaths, exec, overwrite } from '${join(import.meta.dirname, 'mod.ts')}';
      addWatchedPaths(['${join(tempDir, 'dep.json')}']);
      const result = await exec('echo', ['from-exec']);
      await overwrite('${join(tempDir, 'exec-out.txt')}', result.trim());
    `;
    const configPath = join(tempDir, 'escape.config.ts');
    await writeFile(configPath, configContent);

    await import(configPath);

    /** The manually added dependency should appear in reads */
    const depPath = join(tempDir, 'dep.json');
    /** resolve is applied inside addWatchedPaths */
    const hasDepTracked = [...reads].some((readPath) => readPath.endsWith('dep.json'));
    expect(hasDepTracked).toBe(true);
  });

  test('config with overwriteIfNotExists skips existing files', async () => {
    expect.assertions(1);
    /** Pre-existing file that should not be overwritten */
    await writeFile(join(tempDir, 'keep.txt'), 'original');
    await writeFile(join(tempDir, 'src.txt'), 'replacement');

    /** Config using overwriteIfNotExists */
    const configContent = `
      import { cat, overwriteIfNotExists } from '${join(import.meta.dirname, 'mod.ts')}';
      await overwriteIfNotExists(
        '${join(tempDir, 'keep.txt')}',
        await cat(['${join(tempDir, 'src.txt')}'])
      );
    `;
    const configPath = join(tempDir, 'skip.config.ts');
    await writeFile(configPath, configContent);

    await import(configPath);

    /** Original content should be preserved */
    expect(await readFile(join(tempDir, 'keep.txt'), 'utf8')).toBe('original');
  });

  test('config with glob-based overwriteEach mirrors files', async () => {
    expect.assertions(2);
    /** Source directory with files to mirror */
    const srcDir = join(tempDir, 'src');
    await mkdir(srcDir, { recursive: true, });
    await writeFile(join(srcDir, 'a.ts'), 'alpha');
    await writeFile(join(srcDir, 'b.ts'), 'beta');

    /** Config using cat(glob) -> overwriteEach */
    const configContent = `
      import { cat, overwriteEach } from '${join(import.meta.dirname, 'mod.ts')}';
      const files = await cat('${join(srcDir, '*.ts')}');
      await overwriteEach('${join(tempDir, 'out', '*.ts')}', '${join(srcDir, '*.ts')}', files);
    `;
    const configPath = join(tempDir, 'mirror.config.ts');
    await writeFile(configPath, configContent);

    await import(configPath);

    expect(await readFile(join(tempDir, 'out', 'a.ts'), 'utf8')).toBe('alpha');
    expect(await readFile(join(tempDir, 'out', 'b.ts'), 'utf8')).toBe('beta');
  });
});

//endregion integration tests with real config files
