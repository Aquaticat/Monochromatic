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
$target = $args[0]
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$adminsSid = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-32-544')
$inheritance = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
$propagation = [System.Security.AccessControl.PropagationFlags]::None
$type = [System.Security.AccessControl.AccessControlType]::Allow
$userRule = New-Object System.Security.AccessControl.FileSystemAccessRule($userSid, 'FullControl', $inheritance, $propagation, $type)
$adminsRule = New-Object System.Security.AccessControl.FileSystemAccessRule($adminsSid, 'FullControl', $inheritance, $propagation, $type)
$acl.AddAccessRule($userRule)
$acl.AddAccessRule($adminsRule)
Set-Acl -LiteralPath $target -AclObject $acl
$verified = Get-Acl -LiteralPath $target
$unexpected = @($verified.Access | Where-Object { $_.AccessControlType -ne 'Allow' -or ($_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne $userSid.Value -and $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne $adminsSid.Value) })
if ($unexpected.Count -ne 0) { throw 'Registry ACL contains unexpected principals or deny rules.' }
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
   */
  public constructor(
    message: string,
    options?: Readonly<ErrorOptions>,
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
    if (directory) {
      await nanoSpawn(
        'powershell.exe',
        [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        WINDOWS_ACL_SCRIPT,
        path,
      ],
        { windowsHide: true, },
      );
    }
    return;
  }
  await chmod(
    path,
    directory ? DIRECTORY_MODE : FILE_MODE,
  );
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
  const metadata = await lstat(registryRoot,);
  if ((!metadata.isDirectory()) || metadata.isSymbolicLink())
    throw new TrustStorageError('Trust registry root is not a safe directory.',);
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
  const paths = segments.map(function ancestorPath(
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
  },);
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
  },);
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
