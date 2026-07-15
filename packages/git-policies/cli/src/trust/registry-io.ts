/**
 * Private registry filesystem and protection primitives.
 *
 * @module
 */
import {
  chmod,
  constants,
  lstat,
  mkdir,
  open,
  realpath,
} from 'node:fs/promises';
import {
  join,
  relative,
  resolve,
} from 'node:path';
import nanoSpawn from 'nano-spawn';

/**
 * Private directory mode.
 */
export const DIRECTORY_MODE = 0o700;
/**
 * Private file mode.
 */
export const FILE_MODE = 0o600;
/**
 * Group and other permission mask.
 */
const NON_OWNER_PERMISSION_MASK = 0o077;
/**
 * Windows ACL script using account and built-in administrators SIDs.
 */
const WINDOWS_ACL_SCRIPT = String.raw`
$target = $env:CLI_GIT_ACL_TARGET
$isDirectory = $env:CLI_GIT_ACL_DIRECTORY -eq 'true'
$acl = if ($isDirectory) { [System.IO.Directory]::GetAccessControl($target) } else { [System.IO.File]::GetAccessControl($target) }
$acl.SetAccessRuleProtection($true, $false)
foreach ($existingRule in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($existingRule) }
$userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$adminsSid = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-32-544')
$inheritance = if ($isDirectory) { [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' } else { [System.Security.AccessControl.InheritanceFlags]::None }
$propagation = [System.Security.AccessControl.PropagationFlags]::None
$type = [System.Security.AccessControl.AccessControlType]::Allow
$userRule = New-Object System.Security.AccessControl.FileSystemAccessRule($userSid, 'FullControl', $inheritance, $propagation, $type)
$adminsRule = New-Object System.Security.AccessControl.FileSystemAccessRule($adminsSid, 'FullControl', $inheritance, $propagation, $type)
$acl.AddAccessRule($userRule)
$acl.AddAccessRule($adminsRule)
if ($isDirectory) { [System.IO.Directory]::SetAccessControl($target, $acl) } else { [System.IO.File]::SetAccessControl($target, $acl) }
`;
/**
 * Windows ACL verification without modifying target.
 */
const WINDOWS_ACL_VERIFY_SCRIPT = String.raw`
$target = $env:CLI_GIT_ACL_TARGET
$isDirectory = $env:CLI_GIT_ACL_DIRECTORY -eq 'true'
$acl = if ($isDirectory) { [System.IO.Directory]::GetAccessControl($target) } else { [System.IO.File]::GetAccessControl($target) }
if (-not $acl.AreAccessRulesProtected) { throw 'Registry ACL inheritance is not protected.' }
$userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$adminsSid = 'S-1-5-32-544'
$seenUser = $false
$seenAdmins = $false
foreach ($rule in @($acl.Access)) {
  $sid = $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
  if ($rule.AccessControlType -ne 'Allow' -or ($sid -ne $userSid -and $sid -ne $adminsSid) -or (($rule.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::FullControl) -ne [System.Security.AccessControl.FileSystemRights]::FullControl)) { throw 'Registry ACL contains unsafe access.' }
  if ($sid -eq $userSid) { $seenUser = $true }
  if ($sid -eq $adminsSid) { $seenAdmins = $true }
}
if (-not $seenUser -or -not $seenAdmins) { throw 'Registry ACL lacks required account protections.' }
`;

/**
 * Registry storage failure.
 */
export class TrustStorageError extends Error {
  /**
   * Creates storage failure.
   *
   * @param message - safe failure explanation
   *
   * @param options - optional underlying cause
   *
   * @mutates options through global Error options cause access
   */
  public constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(
      message,
      options,
    );
    this.name = 'TrustStorageError';
  }
}

/**
 * Reports whether filesystem error means path absence.
 *
 * @param error - arbitrary filesystem error
 *
 * @returns whether code is ENOENT
 *
 * @example
 * ```ts
 * isMissingPath(Object.assign(new Error('missing'), { code: 'ENOENT' }));
 * ```
 */
export function isMissingPath(error: unknown,): boolean {
  return Error.isError(error,)
    && ('code' in error)
    && (error.code === 'ENOENT');
}

/**
 * Verifies platform-native ACL protection before trusting stored content.
 *
 * @param path - registry directory or private file
 *
 * @param directory - whether target is a directory
 *
 * @example
 * ```ts
 * await assertPrivatePathProtection({ path: 'C:\\private\\record.json', directory: false });
 * ```
 */
export async function assertPrivatePathProtection({
  path,
  directory,
}: Readonly<{
  path: string;
  directory: boolean;
}>,): Promise<void> {
  if (process.platform !== 'win32')
    return;
  try {
    await nanoSpawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        WINDOWS_ACL_VERIFY_SCRIPT,
      ],
      {
        windowsHide: true,
        env: {
          CLI_GIT_ACL_TARGET: path,
          CLI_GIT_ACL_DIRECTORY: String(directory,),
        },
      },
    );
  }
  catch (error: unknown) {
    throw new TrustStorageError(
      `Unsafe Windows trust ACL: ${path}`,
      { cause: error, },
    );
  }
}

/**
 * Applies private permissions and Windows ACL protection.
 *
 * @param path - registry root or created entry
 *
 * @param directory - whether target is a directory
 *
 * @example
 * ```ts
 * await protectPath({ path: '/private/registry', directory: true });
 * ```
 */
export async function protectPath({
  path,
  directory,
}: Readonly<{
  path: string;
  directory: boolean;
}>,): Promise<void> {
  if (process.platform === 'win32') {
    await nanoSpawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        WINDOWS_ACL_SCRIPT,
      ],
      {
        windowsHide: true,
        env: {
          CLI_GIT_ACL_TARGET: path,
          CLI_GIT_ACL_DIRECTORY: String(directory,),
        },
      },
    );
    await assertPrivatePathProtection({
      path,
      directory,
    },);
    return;
  }
  await chmod(
    path,
    directory ? DIRECTORY_MODE : FILE_MODE,
  );
}

/**
 * Verifies registry root spelling contains no followed symlink or junction.
 *
 * @param registryRoot - complete registry root
 */
async function assertCanonicalRegistryRoot(registryRoot: string,): Promise<void> {
  /**
   * Native canonical registry location.
   */
  const canonicalRoot = await realpath(registryRoot,);
  /**
   * Lexically resolved requested location.
   */
  const requestedRoot = resolve(registryRoot,);
  /**
   * Case-normalized paths on case-insensitive Windows.
   */
  const pathsAgree = process.platform === 'win32'
    ? canonicalRoot.toLowerCase() === requestedRoot.toLowerCase()
    : canonicalRoot === requestedRoot;
  if (!pathsAgree)
    throw new TrustStorageError('Trust registry path contains a symbolic link or junction.',);
}

/**
 * Ensures private registry root and verifies it is not a symbolic link.
 *
 * @param registryRoot - complete account-derived or injected root
 *
 * @example
 * ```ts
 * await ensureRegistryRoot('/private/registry');
 * ```
 */
export async function ensureRegistryRoot(registryRoot: string,): Promise<void> {
  await mkdir(
    registryRoot,
    {
      recursive: true,
      mode: DIRECTORY_MODE,
    },
  );
  /**
   * Root metadata checked before any trust write.
   */
  await assertCanonicalRegistryRoot(registryRoot,);
  /**
   * Root metadata after canonical ancestor verification.
   */
  const metadata = await lstat(registryRoot,);
  if ((!metadata.isDirectory()) || metadata.isSymbolicLink())
    throw new TrustStorageError('Trust registry root is not a safe directory.',);
  if ((process.platform !== 'win32') && (process.getuid?.() !== metadata.uid))
    throw new TrustStorageError('Trust registry root is not owned by current account.',);
  await protectPath({
    path: registryRoot,
    directory: true,
  },);
}

/**
 * Verifies every registry-owned component from root to target is a real directory.
 *
 * @param registryRoot - complete registry root
 *
 * @param targetDirectory - descendant directory
 *
 * @example
 * ```ts
 * await assertSafeRegistryDirectory({ registryRoot: '/r', targetDirectory: '/r/records' });
 * ```
 */
export async function assertSafeRegistryDirectory({
  registryRoot,
  targetDirectory,
}: Readonly<{
  registryRoot: string;
  targetDirectory: string;
}>,): Promise<void> {
  await assertCanonicalRegistryRoot(registryRoot,);
  /**
   * Relative path proven to remain below registry root.
   */
  const relativeTarget = relative(
    registryRoot,
    targetDirectory,
  );
  if (relativeTarget.startsWith('..',) || (resolve(
    registryRoot,
    relativeTarget,
  ) !== resolve(targetDirectory,)))
    throw new TrustStorageError('Trust registry path escapes registry root.',);
  /**
   * Platform-native registry path components.
   */
  const segments = relativeTarget === ''
    ? []
    : relativeTarget.split(process.platform === 'win32' ? '\\' : '/',);
  /**
   * Every ancestor path from root toward target.
   */
  const paths = [
    registryRoot,
    ...segments.map(function ancestorPath(
      _segment,
      index,
    ) {
      return join(
        registryRoot,
        ...segments.slice(
          0,
          index + 1,
        ),
      );
    },),
  ];
  /**
   * Metadata for each registry-owned ancestor.
   */
  const metadataEntries = await Promise.all(paths.map(function readMetadata(path,) {
    return lstat(path,);
  },),);
  metadataEntries.forEach(function validateMetadata(
    metadata,
    index,
  ) {
    /**
     * Path corresponding to current metadata entry.
     */
    const path = paths[index] ?? targetDirectory;
    if ((!metadata.isDirectory()) || metadata.isSymbolicLink())
      throw new TrustStorageError(`Unsafe trust registry component: ${path}`,);
    if ((process.platform !== 'win32') && ((metadata.mode & NON_OWNER_PERMISSION_MASK) !== 0))
      throw new TrustStorageError(`Unsafe trust registry permissions: ${path}`,);
    if ((process.platform !== 'win32') && (process.getuid?.() !== metadata.uid))
      throw new TrustStorageError(`Trust registry component is not owned by current account: ${path}`,);
  },);
  await Promise.all(paths.map(function verifyPathProtection(path,) {
    return assertPrivatePathProtection({
      path,
      directory: true,
    },);
  },),);
}

/**
 * Writes one private file with exclusive no-follow semantics and fsync.
 *
 * @param path - destination path
 *
 * @param bytes - exact file bytes
 *
 * @example
 * ```ts
 * await writePrivateFile({ path: '/private/file', bytes: new Uint8Array() });
 * ```
 */
export async function writePrivateFile({
  path,
  bytes,
}: Readonly<{
  path: string;
  bytes: Uint8Array;
}>,): Promise<void> {
  /**
   * Exclusive no-follow destination handle.
   */
  const handle = await open(
    path,
    constants.O_CREAT | constants.O_EXCL
      | constants.O_WRONLY
      | constants.O_NOFOLLOW,
    FILE_MODE,
  );
  /**
   * Automatically closed handle after bytes and metadata are durable.
   */
  await using disposableHandle = handle;
  await handle.writeFile(bytes,);
  await handle.sync();
  await protectPath({
    path,
    directory: false,
  },);
}

/**
 * Flushes directory metadata where host supports directory handles.
 *
 * @param path - directory to flush
 *
 * @example
 * ```ts
 * await syncDirectory('/private/registry');
 * ```
 */
export async function syncDirectory(path: string,): Promise<void> {
  if (process.platform === 'win32')
    return;
  /**
   * Directory handle used only for fsync.
   */
  const handle = await open(
    path,
    constants.O_RDONLY,
  );
  /**
   * Automatically closed directory handle.
   */
  await using disposableHandle = handle;
  await handle.sync();
}
