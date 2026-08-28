import { open, } from 'node:fs/promises';

//region Native executable recognition

/**
 * Header byte count covering supported native executable signatures.
 */
const NATIVE_EXECUTABLE_HEADER_BYTES = 4;

/**
 * Hex prefixes for ELF,
 * PE,
 * Mach-O,
 * and universal Mach-O executables.
 */
const NATIVE_EXECUTABLE_HEX_PREFIXES: ReadonlySet<string> = new Set([
  '7f454c46',
  '4d5a',
  'feedface',
  'feedfacf',
  'cefaedfe',
  'cffaedfe',
  'cafebabe',
  'bebafeca',
  'cafebabf',
  'bfbafeca',
],);

/**
 * Reports whether captured bytes identify a supported native executable format.
 *
 * @param header - Candidate file prefix.
 *
 * @returns Whether prefix is ELF,
 * PE,
 * Mach-O,
 * or universal Mach-O.
 *
 * @example
 * ```ts
 * isNativeExecutableHeader(Buffer.from('7f454c46', 'hex'));
 * // => true
 * ```
 */
function isNativeExecutableHeader(header: Uint8Array,): boolean {
  /**
   * Hexadecimal prefix compared without platform-endian conversion.
   */
  const hex = Buffer.from(header,)
    .toString('hex');
  return [...NATIVE_EXECUTABLE_HEX_PREFIXES,].some(function matchesNativePrefix(prefix,) {
    return hex.startsWith(prefix,);
  },);
}

//endregion Native executable recognition

//region Git policy wrapper markers

/**
 * Package name used by scripts that delegate to Git policy wrapper.
 */
const GIT_POLICY_CLI_PACKAGE_NAME = '@monochromatic-dev/git-policy-cli';

/**
 * Bundle entry path used by pnpm command shims for Git policy wrapper.
 */
const GIT_POLICY_CLI_BUNDLED_ENTRY = 'package/git-policy/cli/dist/final/node/index.mjs';

/**
 * Windows package path emitted when command shims spell package scope with backslash.
 */
const WINDOWS_GIT_POLICY_CLI_PACKAGE_PATH = String.raw`@monochromatic-dev\git-policy-cli`;

/**
 * Windows bundle path emitted by command shims without package metadata.
 */
const WINDOWS_GIT_POLICY_CLI_BUNDLED_ENTRY = String.raw`package\git-policy\cli\dist\final\node\index.mjs`;

/**
 * Text markers that identify scripts delegating to Git policy wrapper.
 */
const SELF_SHIM_MARKERS: ReadonlySet<string> = new Set([
  GIT_POLICY_CLI_PACKAGE_NAME,
  GIT_POLICY_CLI_BUNDLED_ENTRY,
  WINDOWS_GIT_POLICY_CLI_PACKAGE_PATH,
  WINDOWS_GIT_POLICY_CLI_BUNDLED_ENTRY,
],);

/**
 * Checks whether candidate script delegates to Git policy wrapper.
 *
 * Native executables return after one header read.
 * Only scripts and unknown formats undergo complete text inspection.
 *
 * @param candidatePath - Absolute candidate executable path.
 *
 * @returns Whether candidate delegates to Git policy wrapper.
 *
 * @throws When candidate cannot be opened or read.
 *
 * @example
 * ```ts
 * await isGitPolicySelfShim('/workspace/node_modules/.bin/git');
 * ```
 */
export async function isGitPolicySelfShim(candidatePath: string,): Promise<boolean> {
  /**
   * Open candidate shared by native header and text fallback inspection.
   */
  await using candidate = await open(
    candidatePath,
    'r',
  );
  /**
   * Fixed native-signature prefix.
   */
  const header = Buffer.alloc(NATIVE_EXECUTABLE_HEADER_BYTES,);
  /**
   * Captured prefix length for files shorter than native headers.
   */
  const { bytesRead, } = await candidate.read(
    header,
    0,
    header.length,
    0,
  );
  if (isNativeExecutableHeader(
    header.subarray(
      0,
      bytesRead,
    ),
  ))
    return false;
  /**
   * Complete non-native candidate text inspected for self-shim markers.
   */
  const content = await candidate.readFile('utf8',);
  return [...SELF_SHIM_MARKERS,].some(function hasSelfShimMarker(marker,) {
    return content.includes(marker,);
  },);
}

//endregion Git policy wrapper markers
