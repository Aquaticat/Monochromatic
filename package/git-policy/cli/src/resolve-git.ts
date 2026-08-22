import { constants, } from 'node:fs';
import {
  access,
  open,
} from 'node:fs/promises';
import {
  delimiter,
  join,
  win32,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'cli-git', },);

/**
 * Package name used to detect shims that delegate to this wrapper.
 * Any candidate whose file content contains this string is a shim for us,
 * whether it's a pnpm shell wrapper, a Bun symlink target, or anything else.
 * Real git binaries are ELF executables that will never contain this string.
 */
const PACKAGE_NAME = '@monochromatic-dev/git-policy-cli';

/**
 * Bundle entry path used by pnpm command shims when they point at this wrapper.
 * pnpm's generated `node_modules/.bin/git` script can reference this built file
 * without naming the package, so package-name detection alone misses it.
 */
const BUNDLED_ENTRY_MARKER = 'package/git-policy/cli/dist/final/node/index.mjs';

/**
 * Windows path spelling emitted when command shims separate package scope with backslash.
 */
const WINDOWS_PACKAGE_PATH_MARKER = String.raw`@monochromatic-dev\git-policy-cli`;

/**
 * Header byte count covering supported native executable signatures.
 */
const NATIVE_EXECUTABLE_HEADER_BYTES = 4;

/**
 * Hex prefixes for ELF, PE, Mach-O, and universal Mach-O executables.
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
 * Text markers that identify scripts delegating back into this wrapper.
 * Native executables are classified from headers before text inspection.
 */
const SELF_SHIM_MARKERS: ReadonlySet<string> = new Set([
  PACKAGE_NAME,
  BUNDLED_ENTRY_MARKER,
  WINDOWS_PACKAGE_PATH_MARKER,
],);

/**
 * Common Unix Git locations prioritized within PATH to avoid probing every
 * shim-heavy package-manager directory first.
 */
const COMMON_UNIX_GIT_PATHS: readonly string[] = [
  '/usr/bin/git',
  '/usr/local/bin/git',
];

/**
 * Additional common macOS Git locations after standard Unix locations.
 */
const COMMON_MACOS_GIT_PATHS: readonly string[] = [
  ...COMMON_UNIX_GIT_PATHS,
  '/opt/homebrew/bin/git',
  '/opt/local/bin/git',
];

/**
 * Fallback Program Files root when Windows omits environment metadata.
 */
const DEFAULT_WINDOWS_PROGRAM_FILES = String.raw`C:\Program Files`;

/**
 * Returns common absolute Git paths for runtime platform.
 *
 * @param platform - Runtime platform used to select conventional install locations.
 *
 * @param environment - Environment containing Windows installation roots.
 *
 * @returns Common Git executable paths in preferred lookup order.
 *
 * @example
 * ```ts
 * commonGitPathsForPlatform({ platform: 'linux' });
 * // => ['/usr/bin/git', '/usr/local/bin/git']
 * ```
 */
function commonGitPathsForPlatform({
  platform,
  environment = process.env,
}: {
  /**
   * Runtime platform used to select conventional install locations.
   */
  readonly platform: NodeJS.Platform;
  /**
   * Environment containing Windows installation roots.
   */
  readonly environment?: ForeignBorrowed<NodeJS.ProcessEnv>;
},): readonly string[] {
  if (platform === 'win32') {
    /**
     * Program Files roots that can contain system-wide Git installations.
     */
    const programFilesRoots = new Set([
      environment.ProgramFiles,
      environment.ProgramW6432,
      environment['ProgramFiles(x86)'],
      DEFAULT_WINDOWS_PROGRAM_FILES,
    ].filter(function definedRoot(root,): root is string {
      return root !== undefined;
    },),);
    /**
     * Local application root that can contain per-user Git installation.
     */
    const localGitRoot = environment.LOCALAPPDATA === undefined
      ? []
      : [win32.join(
          environment.LOCALAPPDATA,
          'Programs',
        ),];

    return [
      ...programFilesRoots,
      ...localGitRoot,
    ].flatMap(function commonWindowsGitPaths(root,) {
      return [
        win32.join(
          root,
          'Git',
          'cmd',
          'git.exe',
        ),
        win32.join(
          root,
          'Git',
          'bin',
          'git.exe',
        ),
      ];
    },);
  }

  if (platform === 'darwin')
    return COMMON_MACOS_GIT_PATHS;

  return COMMON_UNIX_GIT_PATHS;
}

/**
 * Options for resolving the real git binary.
 */
type ResolveGitOptions = {
  /**
   * PATH-like string to scan. Defaults to current process PATH so production
   * calls follow shell lookup order, while tests can inject isolated paths.
   */
  readonly pathEnv?: string;
  /**
   * Runtime platform used for executable naming.
   */
  readonly platform?: NodeJS.Platform;
  /**
   * Windows executable extensions in shell lookup order.
   */
  readonly pathExtensions?: string;
  /**
   * Absolute Git paths prioritized when present among PATH candidates. Defaults
   * to common platform locations; tests can inject disposable candidates.
   */
  readonly commonGitPaths?: readonly string[];
};

/**
 * Reports whether captured bytes identify a supported native executable format.
 *
 * @param header - Candidate file prefix.
 *
 * @returns Whether prefix is ELF, PE, Mach-O, or universal Mach-O.
 *
 * @example
 * ```ts
 * isNativeExecutableHeader(Buffer.from('7f454c46', 'hex'));
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

/**
 * Checks whether a candidate script is a package manager shim that delegates
 * to this wrapper package. Native executables return after one header read;
 * only scripts and unknown formats undergo complete text inspection.
 *
 * @param candidatePath - Absolute path to the candidate binary.
 *
 * @returns `true` if the candidate is a shim for this package.
 */
async function isShimForSelf(candidatePath: string,): Promise<boolean> {
  /**
   * Tagged logger for candidate self-shim detection.
   */
  const rl = tagged({
    tag: isShimForSelf.name,
    l,
  },);

  try {
    /**
     * Same opened candidate supplies native header and any text fallback.
     */
    await using candidate = await open(candidatePath, 'r',);
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
    if (isNativeExecutableHeader(header.subarray(0, bytesRead,),))
      return false;
    /**
     * Complete non-native candidate text inspected for self-shim markers.
     */
    const content = await candidate.readFile('utf8',);
    return [...SELF_SHIM_MARKERS,].some(function hasSelfShimMarker(marker,) {
      return content.includes(marker,);
    },);
  }
  catch (error: unknown) {
    rl.debug(`could not read ${candidatePath} as a self-shim candidate: ${String(error,)}`,);
    return false;
  }
}

/**
 * Locates real Git by prioritizing common platform paths present in PATH,
 * skipping candidates that delegate back into this package as detected by
 * {@link isShimForSelf}.
 *
 * Sequential scanning is intentional: we need first preferred match and can
 * stop immediately, so parallelizing would waste work.
 *
 * @returns Absolute path to the real git binary.
 *
 * @throws When no real Git binary is found on PATH.
 *
 * @example
 * ```ts
 * const gitPath = await resolveGit();
 * // => '/usr/bin/git'
 * ```
 */
export async function resolveGit({
  pathEnv = process.env
    .PATH
    ?? '',
  platform = process.platform,
  pathExtensions = process.env
    .PATHEXT
    ?? '.COM;.EXE;.BAT;.CMD',
  commonGitPaths = commonGitPathsForPlatform({ platform, },),
}: ResolveGitOptions = {},): Promise<string> {
  /**
   * Tagged logger for git binary resolution.
   */
  const rl = tagged({
    tag: resolveGit.name,
    l,
  },);

  /**
   * Individual PATH entries, scanned in order so the first executable git wins.
   */
  const pathDirs = pathEnv.split(delimiter,);
  /**
   * Platform-specific executable names in native lookup order.
   */
  const executableNames = platform === 'win32'
    ? pathExtensions
      .split(';',)
      .filter(function nonemptyExtension(extension,) {
        return extension.length > 0;
      },)
      .map(function gitExecutableName(extension,) {
        return `git${extension.startsWith('.') ? extension : `.${extension}`}`;
      },)
    : ['git',];
  /**
   * Executable candidates derived from PATH directories and Windows extensions.
   */
  const pathCandidates = pathDirs.flatMap(function candidatesInDirectory(dir,) {
    return executableNames.map(function executableInDirectory(name,) {
      return join(
        dir,
        name,
      );
    },);
  },);
  /**
   * PATH candidates keyed by platform-appropriate path comparison identity.
   */
  const pathCandidateByIdentity = new Map(pathCandidates.map(function indexPathCandidate(
    pathCandidate,
  ) {
    return [
      platform === 'win32'
        ? pathCandidate.toLowerCase()
        : pathCandidate,
      pathCandidate,
    ];
  },),);
  /**
   * Exposed common paths resolved back to exact PATH candidate spelling.
   */
  const exposedCommonGitPaths = commonGitPaths.flatMap(function findExposedCommonPath(
    commonGitPath,
  ) {
    /**
     * Platform-comparable identity for common candidate.
     */
    const identity = platform === 'win32'
      ? commonGitPath.toLowerCase()
      : commonGitPath;
    /**
     * Exact candidate spelling produced from PATH.
     */
    const exposedPath = pathCandidateByIdentity.get(identity,);
    return exposedPath === undefined
      ? []
      : [exposedPath,];
  },);
  /**
   * Exposed common paths followed by all PATH candidates, deduplicated without
   * disturbing preference order.
   */
  const candidates = new Set([
    ...exposedCommonGitPaths,
    ...pathCandidates,
  ],);

  for (const candidate of candidates) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- sequential PATH scan; we need the first match and stop
      await access(
        candidate,
        constants.X_OK,
      );

      // oxlint-disable-next-line no-await-in-loop -- sequential PATH scan; we need the first match and stop
      if (await isShimForSelf(candidate,)) {
        rl.debug(`skipping self at ${candidate}`,);
        continue;
      }

      rl.debug(`resolved real git at ${candidate}`,);
      return candidate;
    }
    catch (error: unknown) {
      rl.debug(`candidate ${candidate} is not usable as real git: ${String(error,)}`,);
      continue;
    }
  }

  throw new Error(
    'cli-git: could not find real git binary on PATH. '
      + 'Ensure Git is installed and PATH/PATHEXT expose its executable.',
  );
}
