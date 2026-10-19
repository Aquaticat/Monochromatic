/**
 One-time migration of search-fetch credentials into the encrypted store.
 
 Reads the old plaintext Pi configs, writes the two provider keys with sops
 through the env-local-json write helper, verifies by decrypting in memory,
 then removes the old fields, the legacy file, and the shell exports. Every
 backup is kept under `$HOME/temp/agent` with the original mode.
 
 Invoked by `mise run secrets:migrate`.
 
 @module
 */

import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { homedir, } from 'node:os';
import {
  dirname,
  join,
  resolve,
} from 'node:path';

import {
  readEnvLocalJson,
} from '@monochromatic-dev/module-env-local-json/ts';
import { writeEnvLocalJsonValues, } from '@monochromatic-dev/module-env-local-json/ts/write.ts';

import {
  CONFIG_JSON_INDENT_SPACES,
  EXA_API_KEY_ENV,
  LINKUP_API_KEY_ENV,
} from './config-constants.ts';
import {
  configPathForHome,
  legacyConfigPathForHome,
} from './config-paths.ts';

/**
 Backup root below home, matching the repo's scratch convention.
 */
const BACKUP_ROOT = join('temp', 'agent',);

/**
 One backed-up file and its original path.
 */
type BackupEntry = {
  /**
   File name inside the backup directory.
   */
  readonly name: string;
  /**
   Original absolute path restored on failure.
   */
  readonly source: string;
};

/**
 Error raised when a file cannot be read or parsed for migration.
 */
class MigrationReadError extends Error {
  /**
   Creates a read or parse failure with the affected path.
 
   @param message - value-free failure description
 
   @param path - affected path
 
   @param options - original failure, never carrying credential output
   */
  public constructor(
    message: string,
    path: string,
    options?: ErrorOptions,
  ) {
    super(`${message}: ${path}`, options,);
    this.name = 'MigrationReadError';
  }
}

/**
 Run the one-time credential migration.
 
 @throws when the store is missing, a config cannot be parsed, the write or
 verification fails, or a backup cannot be created
 
 @example
 ```ts
 await runMigration();
 ```
 */
async function runMigration(): Promise<void> {
  /**
   Local value for home.
   */
  const home = process.env.HOME
    ?? homedir();
  /**
   Local value for piConfigPath.
   */
  const piConfigPath = configPathForHome({ home, },);
  /**
   Local value for legacyConfigPath.
   */
  const legacyConfigPath = legacyConfigPathForHome({ home, },);
  /**
   Local value for storePath.
   */
  const storePath = resolve(
    process.cwd(),
    process.env.ENV_LOCAL_JSON_PATH ?? '.env.local.json',
  );
  await requireFile({ path: storePath, description: 'encrypted store', },);
  /**
   Local value for piConfig.
   */
  const piConfig = await readJsonIfPresent({ path: piConfigPath, },);
  /**
   Local value for legacyConfig.
   */
  const legacyConfig = await readJsonIfPresent({ path: legacyConfigPath, },);
  /**
   Environment without provider keys so store verification cannot be skipped by
   an ambient export, as the reader only fills keys absent from the environment.
   */
  const migrationEnv = { ...process.env, };
  delete migrationEnv[EXA_API_KEY_ENV];
  delete migrationEnv[LINKUP_API_KEY_ENV];
  /**
   Local value for values.
   */
  const values: Record<string, string> = {};
  /**
   Local value for exaValue.
   */
  const exaValue = credentialValue({
    record: piConfig,
    key: 'exaApiKey',
    path: piConfigPath,
  },);
  if (exaValue !== undefined)
    values[EXA_API_KEY_ENV] = exaValue;
  /**
   Local value for linkupValue.
   */
  const linkupValue = credentialValue({
    record: piConfig,
    key: 'linkupApiKey',
    path: piConfigPath,
  },) ?? credentialValue({
    record: legacyConfig,
    key: 'apiKey',
    path: legacyConfigPath,
  },);
  if (linkupValue !== undefined)
    values[LINKUP_API_KEY_ENV] = linkupValue;
  /**
   Local value for backupDir.
   */
  const backupDir = join(
    home,
    BACKUP_ROOT,
    `env-local-json-migration-${new Date().toISOString().replaceAll(':', '-',)}`,
  );
  await mkdir(backupDir, { recursive: true, mode: 0o700, },);
  /**
   Local value for bashrcPath.
   */
  const bashrcPath = join(home, '.bashrc',);
  /**
   Local value for backedUp.
   */
  const backedUp = await backupFiles({
    backupDir,
    paths: [
      piConfigPath,
      legacyConfigPath,
      storePath,
      bashrcPath,
    ],
  },);

  try {
    if (Object.keys(values,).length > 0) {
      await writeEnvLocalJsonValues({
        path: storePath,
        values,
        env: migrationEnv,
        home,
      },);
      await verifyStore({
        storePath,
        values,
        home,
        env: migrationEnv,
      },);
    }
    if (piConfig !== undefined) {
      /**
       Local value for piConfigWithoutCredentials.
       */
      const {
        exaApiKey: _exaApiKey,
        linkupApiKey: _linkupApiKey,
        ...piConfigWithoutCredentials
      } = piConfig;
      await writeJsonAtomic({
        path: piConfigPath,
        value: piConfigWithoutCredentials,
        mode: 0o600,
      },);
    }
    if (legacyConfig !== undefined)
      await rm(legacyConfigPath,);
    await cleanBashrc({
      bashrcPath,
      storePath,
    },);
  }
  catch (error: unknown) {
    await restoreBackups({
      backupDir,
      backedUp,
    },);
    throw error;
  }

  console.log(
    `migration: store updated; Pi credentials removed; ${legacyConfig === undefined ? 'no legacy file' : 'legacy file removed'}; `
      + `.bashrc cleaned; backups: ${backupDir}`,
  );
}

/**
 Require an existing regular file.
 
 @param path - candidate path
 
 @param description - human-readable file kind
 
 @throws when the path is absent or not a regular file
 */
async function requireFile(
  {
    path,
    description,
  }: {
    readonly path: string;
    readonly description: string;
  },
): Promise<void> {
  try {
    /**
     Local value for metadata.
     */
    const metadata = await stat(path,);
    if (metadata.isFile())
      return;
  }
  catch (error: unknown) {
    if (!isMissingFile(error,))
      throw error;
  }
  throw new MigrationReadError(`missing ${description}`, path,);
}

/**
 Read and parse a JSON file when it exists.
 
 @param path - JSON file path
 
 @returns parsed record, or undefined when the file is absent
 
 @throws when the file is unreadable or not a JSON object
 */
async function readJsonIfPresent(
  { path, }: { readonly path: string; },
): Promise<Readonly<Record<string, unknown>> | undefined> {
  /**
   Local value for text.
   */
  let text: string;
  try {
    text = await readFile(path, 'utf8',);
  }
  catch (error: unknown) {
    if (isMissingFile(error,))
      return undefined;
    throw new MigrationReadError('cannot read JSON', path, { cause: error, },);
  }
  /**
   Local value for parsed.
   */
  let parsed: unknown;
  try {
    parsed = JSON.parse(text,) as unknown;
  }
  catch {
    throw new MigrationReadError('cannot parse JSON', path,);
  }
  if (!isRecord(parsed,))
    throw new MigrationReadError('JSON root must be an object', path,);
  return parsed;
}

/**
 Read one optional credential string from a config record.
 
 @param record - parsed config record
 
 @param key - top-level key to read
 
 @param path - config path used in diagnostics
 
 @returns trimmed credential, or undefined when absent
 
 @throws when the field is present but not a non-empty string
 */
function credentialValue(
  {
    record,
    key,
    path,
  }: {
    readonly record: Readonly<Record<string, unknown>> | undefined;
    readonly key: string;
    readonly path: string;
  },
): string | undefined {
  if (record === undefined)
    return undefined;
  /**
   Local value for value.
   */
  const value = record[key];
  if (value === undefined)
    return undefined;
  if ((typeof value) !== 'string')
    throw new MigrationReadError(`${key} must be a string`, path,);
  /**
   Local value for trimmed.
   */
  const trimmed = value.trim();
  if (trimmed === '')
    throw new MigrationReadError(`${key} must not be blank`, path,);
  return trimmed;
}

/**
 Verify the migrated values by decrypting the store in memory.
 
 @param storePath - encrypted store path
 
 @param values - values expected in the store
 
 @param home - home directory used by the identity resolver
 
 @throws when the store cannot be read or a migrated value differs
 */
async function verifyStore(
  {
    storePath,
    values,
    home,
    env,
  }: {
    readonly storePath: string;
    readonly values: Readonly<Record<string, string>>;
    readonly home: string;
    readonly env: Readonly<Record<string, string | undefined>>;
  },
): Promise<void> {
  /**
   Local value for verified.
   */
  const verified = await readEnvLocalJson({
    keys: Object.keys(values,),
    path: storePath,
    cwd: dirname(storePath,),
    env,
    home,
  },);
  for (const [key, value] of Object.entries(values,)) {
    if (verified.values[key] !== value)
      throw new Error(`migration verification failed for ${key}`,);
  }
}

/**
 Copy every existing path into the backup directory, preserving its mode.
 
 @param backupDir - backup directory
 
 @param paths - candidate source paths
 
 @returns backup entries in path order
 */
async function backupFiles(
  {
    backupDir,
    paths,
  }: {
    readonly backupDir: string;
    readonly paths: readonly string[];
  },
): Promise<readonly BackupEntry[]> {
  /**
   Local value for entries.
   */
  const entries: BackupEntry[] = [];
  for (const source of paths) {
    /**
     Local value for metadata.
     */
    let metadata: Awaited<ReturnType<typeof stat>>;
    try {
      metadata = await stat(source,);
    }
    catch (error: unknown) {
      if (isMissingFile(error,))
        continue;
      throw error;
    }
    if (!metadata.isFile())
      continue;
    /**
     Local value for name.
     */
    const name = `${String(entries.length,)}-${source.split('/',).at(-1,) ?? 'file'}`;
    await copyFile(source, join(backupDir, name,),);
    await chmod(join(backupDir, name,), metadata.mode & 0o777,);
    entries.push({ name, source, },);
  }
  return entries;
}

/**
 Restore every backup after a failed migration.
 
 @param backupDir - backup directory
 
 @param backedUp - backup entries created earlier
 */
async function restoreBackups(
  {
    backupDir,
    backedUp,
  }: {
    readonly backupDir: string;
    readonly backedUp: readonly BackupEntry[];
  },
): Promise<void> {
  for (const { name, source, } of backedUp) {
    try {
      await copyFile(join(backupDir, name,), source,);
    }
    catch (error: unknown) {
      console.error(`migration: could not restore ${source}: ${String(error,)}`,);
    }
  }
  console.error(
    `migration: failed; original files restored from ${backupDir}`,
  );
}

/**
 Remove key exports from `.bashrc` and pin the store path.
 
 @param bashrcPath - shell profile path
 
 @param storePath - absolute encrypted store path
 */
async function cleanBashrc(
  {
    bashrcPath,
    storePath,
  }: {
    readonly bashrcPath: string;
    readonly storePath: string;
  },
): Promise<void> {
  /**
   Local value for text.
   */
  let text: string;
  /**
   Local value for mode.
   */
  let mode = 0o600;
  try {
    text = await readFile(bashrcPath, 'utf8',);
    mode = (await stat(bashrcPath,)).mode & 0o777;
  }
  catch (error: unknown) {
    if (isMissingFile(error,))
      return;
    throw error;
  }
  /**
   Local value for exportLine.
   */
  const exportLine = `export ENV_LOCAL_JSON_PATH=${shellQuote(storePath,)}`;
  /**
   Local value for lines.
   */
  const lines = text.split('\n',)
    .filter(function isNotKeyExport(line,) {
      return !/^\s*(?:export\s+)?(?:EXA_API_KEY|LINKUP_API_KEY)=/u.test(line,);
    },);
  /**
   Local value for pathLineIndex.
   */
  const pathLineIndex = lines.findIndex(function isPathLine(line,) {
    return /^\s*export\s+ENV_LOCAL_JSON_PATH=/u.test(line,);
  },);
  if (pathLineIndex === (-1))
    lines.push(exportLine,);
  else
    lines[pathLineIndex] = exportLine;
  await writeTextAtomic({
    path: bashrcPath,
    text: lines.join('\n',),
    mode,
  },);
}

/**
 Write JSON atomically with two-space indentation and a trailing newline.
 
 @param path - destination path
 
 @param value - JSON-serializable value
 
 @param mode - file mode
 */
async function writeJsonAtomic(
  {
    path,
    value,
    mode,
  }: {
    readonly path: string;
    readonly value: unknown;
    readonly mode: number;
  },
): Promise<void> {
  await writeTextAtomic({
    path,
    text: `${JSON.stringify(
      value,
      null,
      CONFIG_JSON_INDENT_SPACES,
    )}\n`,
    mode,
  },);
}

/**
 Write text atomically in the destination directory.
 
 @param path - destination path
 
 @param text - text to write
 
 @param mode - file mode
 */
async function writeTextAtomic(
  {
    path,
    text,
    mode,
  }: {
    readonly path: string;
    readonly text: string;
    readonly mode: number;
  },
): Promise<void> {
  /**
   Local value for temporaryPath.
   */
  const temporaryPath = `${path}.migration-${String(process.pid,)}`;
  await writeFile(temporaryPath, text, { mode, },);
  await chmod(temporaryPath, mode,);
  await rename(temporaryPath, path,);
}

/**
 Quote one POSIX shell word.
 
 @param value - raw value
 
 @returns single-quoted shell word
 */
function shellQuote(value: string,): string {
  /**
   Local value for escaped.
   */
  const escaped = value.replaceAll("'", "'\\''",);
  return `'${escaped}'`;
}

/**
 Return whether value is a non-null object record.
 
 @param value - unknown value
 
 @returns whether value is a record
 */
function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return (value !== null)
    && ((typeof value) === 'object')
    && (!Array.isArray(value,));
}

/**
 Return whether a filesystem error is a missing-file error.
 
 @param error - unknown error
 
 @returns whether error has the ENOENT code
 */
function isMissingFile(error: unknown,): boolean {
  return (error instanceof Error)
    && ('code' in error)
    && (error.code === 'ENOENT');
}

await runMigration();
