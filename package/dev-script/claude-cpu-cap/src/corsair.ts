import { readFile, } from 'node:fs/promises';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import {
  ABSENT,
  COOLERCONTROL_TIMEOUT_MS,
  CORSAIR_FAN_CHANNELS,
} from './constants.ts';
import { isMissingFile, } from './files.ts';

/**
 Fields written when the Corsair controller cannot be read: six fan speeds and the probe temperature.
 */
export const EMPTY_CORSAIR_FIELDS: readonly string[] = Array.from(
  { length: CORSAIR_FAN_CHANNELS.length + 1, },
  function emptyField(): string {
    return ABSENT;
  },
);

/**
 Result of one CoolerControl read.
 */
export type CorsairRead = Readonly<{
  /**
   Six fan speeds then the probe temperature, as CSV fields.
   */
  fields: readonly string[];
  /**
   Whether the read failed, to log only changes.
   */
  failing: boolean;
}>;

/**
 Whether a value is a plain object.

 @param value - any parsed JSON value

 @returns true for objects that are not arrays or null

 @example
 ```ts
 isRecord({ a: 1, },); // true
 ```
 */
export function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object') && (value !== null)
    && (!Array.isArray(value,));
}

/**
 Keeps the object members of a JSON array, answering an empty array for anything else.

 @param value - any parsed JSON value

 @returns the objects in the array

 @example
 ```ts
 recordsOf([{ a: 1, }, 2,],); // [{ a: 1, }]
 ```
 */
export function recordsOf(value: unknown,): readonly Readonly<Record<string, unknown>>[] {
  return Array.isArray(value,) ? value.filter(isRecord,) : [];
}

/**
 Formats a JSON number or string as a CSV field; anything else becomes an empty field.

 @param value - any parsed JSON value

 @returns the text of a number or string, otherwise {@link ABSENT}

 @example
 ```ts
 fieldText(1271,); // '1271'
 ```
 */
export function fieldText(value: unknown,): string {
  return ((typeof value) === 'number') || ((typeof value) === 'string') ? String(value,) : ABSENT;
}

/**
 Extracts the Corsair fan speeds and probe temperature from a CoolerControl status body.

 @param body - parsed JSON of `/status`

 @returns six fan speeds then the probe temperature, as CSV fields

 @throws when no `Liquidctl` device with a `fan1` channel and a status entry exists

 @example
 ```ts
 parseCorsairFields({ devices: [], },); // throws: no Corsair fan channels in the CoolerControl status
 ```
 */
export function parseCorsairFields(body: unknown,): readonly string[] {
  /**
   Latest status entry of every `Liquidctl` device.
   */
  const latests = recordsOf(isRecord(body,) ? body.devices : [],)
    .filter(function isLiquidctl(device,) {
      return device.type === 'Liquidctl';
    },)
    .map(function latestStatus(device,) {
      return recordsOf(device.status_history,)
        .at(-1,);
    },);
  /**
   The status entry that has a `fan1` channel, which identifies the Corsair controller.
   */
  const latest = latests.find(function hasFan1(status,) {
    return recordsOf(status?.channels,)
      .some(function isFan1(channel,) {
      return channel.name === 'fan1';
    },);
  },);
  if (latest === undefined) throw new Error('no Corsair fan channels in the CoolerControl status',);
  /**
   Channels of that status entry.
   */
  const channels = recordsOf(latest.channels,);
  /**
   Fan speeds in the order of {@link CORSAIR_FAN_CHANNELS}.
   */
  const fans = CORSAIR_FAN_CHANNELS.map(function fanField(name,) {
    return fieldText(channels.find(function named(channel,) {
      return channel.name === name;
    },)
      ?.rpm,);
  },);
  return [
    ...fans,
    fieldText(recordsOf(latest.temps,)
      .at(0,)
      ?.temp,),
  ];
}

/**
 Reads the Corsair controller's fan speeds and probe temperature through the local CoolerControl API.
 Returns empty fields when the token file is absent or rejected (for example after rotation) and reports changes once.

 @param tokenFile - file holding the bearer token
 
 @param statusUrl - CoolerControl status endpoint
 
 @param failing - whether the previous read failed
 
 @param l - parent logger

 @returns the fields and whether this read failed

 @example
 ```ts
 await readCorsairFields({ tokenFile, statusUrl, failing: false, l, },); // { fields: ['1271', ...], failing: false, }
 ```
 */
export async function readCorsairFields({
  tokenFile,
  statusUrl,
  failing,
  l,
}: Readonly<{
  tokenFile: string;
  statusUrl: string;
  failing: boolean;
  l: Logger;
}>,): Promise<CorsairRead> {
  /**
   Logger tagged with this function.
   */
  const rl = tagged({
    tag: readCorsairFields.name,
    l,
  },);
  try {
    /**
     Bearer token without the trailing newline.
     */
    const token = (await readFile(
      tokenFile,
      'utf8',
    )).trim();
    /**
     The CoolerControl status response.
     */
    const response = await fetch(
      statusUrl,
      {
      headers: { Authorization: `Bearer ${token}`, },
      signal: AbortSignal.timeout(COOLERCONTROL_TIMEOUT_MS,),
    },
    );
    if (!response.ok) throw new Error(`CoolerControl status HTTP ${response.status}`,);
    /**
     Parsed JSON body, validated by {@link parseCorsairFields}.
     */
    const body: unknown = await response.json();
    /**
     Fan speeds and probe temperature.
     */
    const fields = parseCorsairFields(body,);
    if (failing) rl.info('FAN-READ-RECOVERED CoolerControl fan speeds are being recorded again',);
    return {
      fields,
      failing: false,
    };
  } catch (error) {
    if (isMissingFile(error,)) {
      rl.debug(`token file ${tokenFile} absent (${String(error,)}); fan columns stay empty`,);
      return {
        fields: EMPTY_CORSAIR_FIELDS,
        failing,
      };
    }
    if (!failing) {
      rl.warn(`FAN-READ-FAILED ${String(error,)}; fan columns stay empty until the token at ${tokenFile} works`,);
    }
    return {
      fields: EMPTY_CORSAIR_FIELDS,
      failing: true,
    };
  }
}
