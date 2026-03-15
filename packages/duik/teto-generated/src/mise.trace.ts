/**
 * Trace binary masks to SVG paths with potrace.
 *
 * Prefers a host-installed potrace. Falls back to the tracer container
 * (podman) only when the host binary is unavailable.
 *
 * Reads PGM masks from tmp/masks/ and produces SVG files in tmp/traced/.
 * Each SVG contains path data in the mask's pixel coordinate space.
 *
 * Input: tmp/masks/*.pgm (from segment step)
 * Output: tmp/traced/*.svg (raw potrace output)
 *
 * @example
 * ```sh
 * mise run //packages/duik/teto-generated:trace
 * ```
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';

import { TMP_DIR, } from './config.ts';

/**
 * Run a shell command and throw on non-zero exit.
 *
 * @param cmd - Command tokens to execute
 * @throws Error when the subprocess exits with non-zero status
 */
async function run(cmd: readonly string[],): Promise<void> {
  console.log(`  $ ${cmd.join(' ',)}`,);
  const proc = Bun.spawn([...cmd,], { stdout: 'inherit', stderr: 'inherit', },);
  const code = await proc.exited;
  if (code !== 0)
    throw new Error(`Command failed (exit ${code}): ${cmd.join(' ',)}`,);
}

/**
 * Check whether potrace is available on the host PATH.
 *
 * @returns True if the host has potrace
 */
async function hasHostPotrace(): Promise<boolean> {
  const proc = Bun.spawn(['which', 'potrace',], {
    stdout: 'pipe',
    stderr: 'pipe',
  },);
  const code = await proc.exited;
  return code === 0;
}

/**
 * Potrace argument list shared between host and container invocations.
 * -i: invert (masks have white=foreground, but potrace traces dark regions)
 */
const POTRACE_FLAGS = ['-i', '-b', 'svg', '--turdsize', '4', '--alphamax', '1.0',
  '--opttolerance', '0.2',] as const;

/**
 * Trace all masks using host-installed potrace.
 *
 * @param masks - PGM file names
 * @param masksDir - Directory containing the masks
 * @param tracedDir - Output directory for SVG files
 */
async function traceOnHost({
  masks,
  masksDir,
  tracedDir,
}: {
  readonly masks: readonly string[];
  readonly masksDir: string;
  readonly tracedDir: string;
},): Promise<void> {
  console.log('  Using host potrace',);
  for (const mask of masks) {
    const name = mask.replace('.pgm', '',);
    await run([
      'potrace',
      ...POTRACE_FLAGS,
      '-o',
      `${tracedDir}/${name}.svg`,
      `${masksDir}/${mask}`,
    ],);
  }
}

/**
 * Trace all masks using potrace in the tracer container.
 * Batches all traces into a single container invocation.
 *
 * @param masks - PGM file names
 * @param masksDir - Directory containing the masks
 * @param tracedDir - Output directory for SVG files
 */
async function traceInContainer({
  masks,
  masksDir,
  tracedDir,
}: {
  readonly masks: readonly string[];
  readonly masksDir: string;
  readonly tracedDir: string;
},): Promise<void> {
  console.log('  Using container potrace (host binary not found)',);

  const traceCommands = masks.map(function buildTraceCmd(mask,) {
    const name = mask.replace('.pgm', '',);
    const flags = POTRACE_FLAGS.join(' ',);
    return `potrace ${flags} -o /work/${tracedDir}/${name}.svg /work/${masksDir}/${mask}`;
  },);

  const script = traceCommands.join(' && ',);
  const cwd = process.cwd();

  await run([
    'podman',
    'run',
    '--rm',
    '-v',
    `${cwd}:/work:Z`,
    'monochromatic-tracer',
    'sh',
    '-c',
    script,
  ],);
}

/** Traces binary masks to SVG paths using potrace. */
async function main(): Promise<void> {
  console.log('Tracing masks to SVG with potrace',);

  const masksDir = `${TMP_DIR}/masks`;
  if (!existsSync(masksDir,)) {
    throw new Error(
      `Masks directory not found: ${masksDir} — run the segment task first`,
    );
  }

  const tracedDir = `${TMP_DIR}/traced`;
  if (!existsSync(tracedDir,))
    mkdirSync(tracedDir, { recursive: true, },);

  const masks = readdirSync(masksDir,).filter(function isPgm(f,) {
    return f.endsWith('.pgm',);
  },);

  if (masks.length === 0)
    throw new Error('No PGM masks found — segmentation may have failed',);

  console.log(`  Found ${masks.length} masks`,);

  const useHost = await hasHostPotrace();

  if (useHost)
    await traceOnHost({ masks, masksDir, tracedDir, },);
  else
    await traceInContainer({ masks, masksDir, tracedDir, },);

  console.log(`Traced ${masks.length} parts to ${tracedDir}/`,);
}

await main();

export {};
