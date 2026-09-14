import { readFile, } from 'node:fs/promises';

//region Type

/**
 Connection data transferred privately to detached answer helper.
 */
export type HelperRequest = {
  /**
   Loopback server hostname.
   */
  readonly host: string;
  /**
   Loopback server port.
   */
  readonly port: number;
  /**
   Per-request authentication token.
   */
  readonly token: string;
  /**
   Empty file whose saved content becomes user answer.
   */
  readonly answerPath: string;
  /**
   Effective editor executable and configured arguments.
   */
  readonly editorCommand: readonly string[];
};

//endregion Type

//region Validation

/**
 Reads and validates helper request file created by Pi extension.
 
 @param requestPath - private request path passed through terminal launcher
 
 @returns authenticated channel and answer-file coordinates
 
 @throws when request JSON is missing or malformed
 
 @example
 ```ts
 await readHelperRequest({ requestPath: '/tmp/request.json' });
 ```
 */
export async function readHelperRequest(
  { requestPath, }: { readonly requestPath: string; },
): Promise<HelperRequest> {
  /**
   Decoded coordination value before structural narrowing.
   */
  const value: unknown = JSON.parse(await readFile(
    requestPath,
    'utf8',
  ),);
  if (!isUnknownRecord(value,))
    throw new Error('Answer helper request must be an object.',);
  return {
    host: requireStringField({
      value,
      key: 'host',
    },),
    port: requirePort({ value, },),
    token: requireStringField({
      value,
      key: 'token',
    },),
    answerPath: requireStringField({
      value,
      key: 'answerPath',
    },),
    editorCommand: requireStringArrayField({
      value,
      key: 'editorCommand',
    },),
  };
}

/**
 Narrows unknown JSON object to readonly record.
 
 @param value - decoded JSON candidate
 
 @returns whether string keys are readable
 */
function isUnknownRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (value === null)
    return false;
  return (typeof value) === 'object';
}

/**
 Reads required nonempty string field.
 
 @param value - validated JSON record
 
 @param key - required field name
 
 @returns narrowed string field
 
 @throws when field is absent,
 non-string,
 or empty
 */
function requireStringField(
  {
    value,
    key,
  }: {
    readonly value: Readonly<Record<string, unknown>>;
    readonly key: string;
  },
): string {
  /**
   Field candidate from decoded request.
   */
  const field = value[key];
  if (((typeof field) !== 'string') || (field.length === 0))
    throw new Error(`Answer helper request ${key} must be a nonempty string.`,);
  return field;
}

/**
 Reads required nonempty string-array field.
 
 @param value - validated JSON record
 
 @param key - required array field name
 
 @returns validated string tokens
 
 @throws when field is absent,
 empty,
 or contains non-string or empty tokens
 */
function requireStringArrayField(
  {
    value,
    key,
  }: {
    readonly value: Readonly<Record<string, unknown>>;
    readonly key: string;
  },
): readonly string[] {
  /**
   Array candidate from decoded request.
   */
  const field = value[key];
  if (!Array.isArray(field,))
    throw new Error(`Answer helper request ${key} must be a nonempty string array.`,);
  if (field.length === 0)
    throw new Error(`Answer helper request ${key} must be a nonempty string array.`,);
  /**
   Validated editor command tokens.
   */
  return field.map(function requireCommandToken(token,) {
    if (((typeof token) !== 'string') || (token.length === 0))
      throw new Error(`Answer helper request ${key} must be a nonempty string array.`,);
    return token;
  },);
}

/**
 Reads required positive TCP port.
 
 @param value - validated JSON record
 
 @returns positive integer port
 
 @throws when port is absent,
 nonnumeric,
 fractional,
 or nonpositive
 */
function requirePort(
  { value, }: { readonly value: Readonly<Record<string, unknown>>; },
): number {
  /**
   Port candidate from decoded request.
   */
  const field = value.port;
  if ((typeof field) !== 'number')
    throw new Error('Answer helper request port must be a positive integer.',);
  if (!Number.isInteger(field))
    throw new Error('Answer helper request port must be a positive integer.',);
  if (field <= 0)
    throw new Error('Answer helper request port must be a positive integer.',);
  return field;
}

//endregion Validation
