/**
 Per-request native HTTP capture decodes wire payloads without shared fetch interception. @module
 */
import { promisify, } from 'node:util';
import { zstdDecompress, } from 'node:zlib';
import type {
  FetchFunction,
  Model,
} from '@earendil-works/pi-ai';
import type {
  ForeignBorrowed,
  ForeignHostCapability,
} from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  createStreamFixtureResponse,
  StreamFixtureStopError,
} from './stream-fixture.ts';

/**
 One serialized native request records the complete transport boundary.
 */
export type StreamFixtureHttpCall = {
  readonly url: string;
  readonly method?: string;
  readonly headers: Headers;
  readonly payload: unknown;
};

/**
 Independent bounded interceptor exposes captured requests without any real network capability.
 */
export type StreamFixtureHttp = {
  readonly fetch: FetchFunction;
  readonly requests: readonly StreamFixtureHttpCall[];
};

/**
 Await native asynchronous decompression without blocking the fixture test process.
 */
const decompress = promisify(zstdDecompress,);

//region Native inputs: distinguish supported URL representations explicitly.

/**
 Extract native fetch URL without invoking default object stringification.

 @param input - upstream fetch string, URL, or Request representation

 @returns explicitly narrowed request URL

 @internal
 */
export function streamFixtureRequestUrl(input: ForeignBorrowed<Parameters<FetchFunction>[0]>,): string {
  if (input instanceof Request)
    return input.url;
  if ((typeof input) === 'string')
    return input;
  if (input instanceof URL)
    return input.href;
  throw new Error('Expected native fetch input to be a Request, string, or URL',);
}

/**
 Fail locally if a stop-before-network test accidentally reaches transport.

 @throws {@link StreamFixtureStopError} when native request reaches transport

 @internal
 */
export async function stopStreamFixtureTransport(): Promise<never> {
  return await Promise.reject(new StreamFixtureStopError(),);
}

//endregion Native inputs

//region Wire capture: inspect real native compression and serve one local response.

/**
 Create finite per-request interceptor accepting only the original model endpoint.

 @param model - live native model supplies the expected original endpoint

 @param serviceTier - optional native server-reported tier

 @returns independently owned request capture and local response capability

 @internal
 */
export function createStreamFixtureHttp({
  model,
  serviceTier,
}: {
  readonly model: ForeignBorrowed<Model<'openai-codex-responses'>>;
  readonly serviceTier?: 'default';
},): StreamFixtureHttp {
  /**
   Owned request records cap dispatch at one response and expose final serialized data.
   */
  const requests: StreamFixtureHttpCall[] = [];

  return {
    requests,
    /**
     Capture native fetch callback while consuming only its synthetic request body.

     @param input - original native fetch URL representation

     @param init - native request capabilities whose body is consumed locally

     @returns independent completed SSE response

     @mutates init - native Response consumes the request body capability supplied by fetch

     @throws {@link StreamFixtureStopError} when more than one dispatch is attempted
     */
    fetch: async function captureFetch(
      input: ForeignBorrowed<Parameters<FetchFunction>[0]>,
      init?: ForeignHostCapability<Parameters<FetchFunction>[1]>,
    ): Promise<Response> {
      /**
       Narrowed URL prevents accidental object stringification from hiding endpoint changes.
       */
      const url = streamFixtureRequestUrl(input,);
      if (url !== `${model.baseUrl}/codex/responses`)
        throw new Error(`Native stream attempted unexpected fixture URL: ${url}`,);
      if (requests.length > 0)
        throw new StreamFixtureStopError();
      /**
       Native headers control compression and preserve original auth and caller configuration.
       */
      const headers = new Headers(init?.headers,);
      /**
       Actual serialized request may use zstd without altering native transport logic.
       */
      const bytes = new Uint8Array(await new Response(init?.body,).arrayBuffer(),);
      /**
       Decompressed request bytes retain the exact native JSON serialization boundary.
       */
      const decoded = headers.get('content-encoding',) === 'zstd' ? await decompress(bytes,) : bytes;
      /**
       Parsed wire object is deliberately unknown until assertions inspect its fields.
       */
      const payload: unknown = JSON.parse(new TextDecoder().decode(decoded,),);
      requests.push({
        url,
        ...(init?.method === undefined ? {} : { method: init.method, }),
        headers,
        payload,
      },);
      return createStreamFixtureResponse(serviceTier === undefined ? {} : { serviceTier, },);
    },
  };
}

//endregion Wire capture
