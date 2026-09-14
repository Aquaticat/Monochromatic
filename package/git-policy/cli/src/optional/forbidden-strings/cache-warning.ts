// Generated from `package/git-policy/forbidden-strings/src/cache-warning.ts` by file-enforcer; edit canonical source owner.
import { ForbiddenStringsPluginError, } from './errors.ts';

/**
 Exact schema-version-1 cache-warning JSON lines emitted by scanner.
 
 A byte-exact allow-list rejects duplicate keys,
 unknown fields,
 alternate reason/recovery pairings,
 whitespace variants,
 and arbitrary JSON while keeping every accepted line valid compact JSON.
 */
const VALID_CACHE_WARNING_LINES: ReadonlySet<string> = new Set([
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"missing","recovery":"compile-from-text"}',
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"cache-root-unavailable","recovery":"compile-from-text"}',
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"unreadable","recovery":"compile-from-text"}',
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"source-mismatch","recovery":"compile-from-text"}',
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"incompatible","recovery":"compile-from-text"}',
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"invalid","recovery":"compile-from-text"}',
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"write-failed","recovery":"continue-with-compiled-rules"}',
],);

/**
 Throws fail-closed malformed-output diagnostic.
 
 @param line - Complete scanner stderr line.
 
 @throws Always, because unknown scanner output cannot be ignored.
 */
function malformedWarning(line: string,): never {
  throw new ForbiddenStringsPluginError(`Malformed forbidden-strings scanner output: ${line}`,);
}

/**
 Parses one complete JSON cache warning or reports that line is plain finding syntax.
 
 A scanner finding always ends in ` rule=<token>`, so only a line beginning and
 ending with JSON object delimiters enters the allow-list. Every complete JSON
 object must be one exact canonical warning line or fail closed.
 
 @param line - Complete nonempty scanner stderr line.
 
 @returns Whether line is valid cache warning and should not become a finding.
 
 @throws {@link ForbiddenStringsPluginError} for malformed or unknown JSON records.
 
 @example
 ```ts
 parseCacheWarning('{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"missing","recovery":"compile-from-text"}');
 ```
 */
export function parseCacheWarning(line: string,): boolean {
  if ((!line.startsWith('{',)) || (!line.endsWith('}',)))
    return false;
  if (!VALID_CACHE_WARNING_LINES.has(line,))
    malformedWarning(line,);
  return true;
}
