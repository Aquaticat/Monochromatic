/**
 * Test support for session-discovery unit tests.
 *
 * @module
 */

import {
  SESSION_NOT_FOUND,
  type SessionDiscoveryIo,
} from './index.ts';

/**
 * Mapping shape used by shared package tests.
 */
type TestMapping = {
  /**
   * Session id parsed from mapping file.
   */
  readonly sessionId: string;
};

/**
 * Directory path used by fake PID mapping files.
 */
const BY_PID_DIR = '/tmp/session-discovery/.by-pid';

/**
 * Parses test mapping JSON.
 *
 * @param raw - mapping JSON text
 *
 * @returns parsed mapping
 *
 * @example
 * ```ts
 * parseTestMapping('{"sessionId":"s"}');
 * ```
 */
function parseTestMapping(raw: string,): TestMapping {
  /**
   * Parsed fixture value before runtime validation.
   */
  const parsed: unknown = JSON.parse(raw,);
  if (!isTestMapping(parsed,))
    throw new Error(`Invalid test mapping JSON: ${raw}`,);

  return parsed;
}

/**
 * Checks whether a parsed fixture has the test mapping shape.
 *
 * @param value - parsed fixture value
 *
 * @returns whether value is a test mapping
 *
 * @example
 * ```ts
 * isTestMapping({ sessionId: 's' });
 * ```
 */
function isTestMapping(value: unknown,): value is TestMapping {
  if (!isObject(value,))
    return false;
  if (!Object.hasOwn(
    value,
    'sessionId',
  ))
    return false;

  /**
   * Candidate session id property value.
   */
  const sessionId: unknown = Reflect.get(
    value,
    'sessionId',
  );
  return (typeof sessionId) === 'string';
}

/**
 * Checks whether a parsed fixture is an object.
 *
 * @param value - parsed fixture value
 *
 * @returns whether value is a non-null object
 *
 * @example
 * ```ts
 * isObject({});
 * ```
 */
function isObject(value: unknown,): value is object {
  return ((typeof value) === 'object') && (value !== null);
}

/**
 * Builds JSON text for one test mapping.
 *
 * @param sessionId - session id to encode
 *
 * @returns JSON mapping text
 *
 * @example
 * ```ts
 * mappingJson('parent');
 * ```
 */
function mappingJson(sessionId: string,): string {
  return JSON.stringify({ sessionId, },);
}

/**
 * Creates fake filesystem and procfs readers for session-discovery tests.
 *
 * @param files - file contents keyed by absolute path
 *
 * @param mtimes - file modification times keyed by absolute path
 *
 * @param parents - parent PID values keyed by child PID
 *
 * @returns fake IO seam
 *
 * @example
 * ```ts
 * fakeIo({ files: {}, mtimes: {}, parents: new Map() });
 * ```
 */
function fakeIo(
  {
    files,
    mtimes,
    parents,
  }: {
    readonly files: Readonly<Record<string, string>>;
    readonly mtimes: Readonly<Record<string, number>>;
    readonly parents: ReadonlyMap<number, number>;
  },
): SessionDiscoveryIo {
  return {
    readDir: function readDir(path,): Promise<readonly string[]> {
      if (path !== BY_PID_DIR)
        return Promise.reject(new Error(`Unexpected directory ${path}`,),);

      /**
       * Fake directory entries under the mapping directory.
       */
      const entries = Object.keys(files)
        .filter(function isMappingPath(filePath,): boolean {
          return filePath.startsWith(`${BY_PID_DIR}/`,);
        },)
        .map(function basename(filePath,): string {
          return filePath.slice(BY_PID_DIR.length + 1,);
        },);
      return Promise.resolve(entries,);
    },
    readFile: function readFile(path,): Promise<string> {
      /**
       * Fake file contents for requested path.
       */
      const value = files[path];
      if (value === undefined)
        return Promise.reject(new Error(`Missing file ${path}`,),);
      return Promise.resolve(value,);
    },
    readParentPid: function readParent(pid,): Promise<number | typeof SESSION_NOT_FOUND> {
      return Promise.resolve(parents.get(pid,) ?? SESSION_NOT_FOUND,);
    },
    statFile: function statFile(path,): Promise<{ readonly mtimeMs: number; }> {
      /**
       * Fake modification time for requested path.
       */
      const value = mtimes[path];
      if (value === undefined)
        return Promise.reject(new Error(`Missing stat ${path}`,),);
      return Promise.resolve({ mtimeMs: value, },);
    },
  };
}

export {
  BY_PID_DIR,
  fakeIo,
  mappingJson,
  parseTestMapping,
};
export type { TestMapping, };
