import {
  createServer,
  type Server,
} from 'node:http';
import type { AddressInfo, } from 'node:net';
import { writeFile, } from 'node:fs/promises';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  EMPTY_CORSAIR_FIELDS,
  fieldText,
  parseCorsairFields,
  readCorsairFields,
  recordsOf,
} from './corsair.ts';
import {
  makeHost,
  recordingLogger,
} from './test-fixture.ts';

/**
 A CoolerControl status body with one Corsair controller and one unrelated device.
 */
const STATUS_BODY = {
  devices: [
    { type: 'CPU', status_history: [{ temps: [{ name: 'temp1', temp: 70, },], channels: [], },], },
    {
      type: 'Liquidctl',
      status_history: [{
        temps: [{ name: 'temp1', temp: 25.5, },],
        channels: [
          { name: 'fan1', rpm: 1_271, },
          { name: 'fan2', rpm: 1_473, },
          { name: 'fan3', rpm: 0, },
          { name: 'fan4', rpm: 1_286, },
          { name: 'fan5', },
          { name: 'fan6', rpm: 900, },
        ],
      },],
    },
  ],
};

/**
 A running status server that closes itself when its `await using` scope ends.
 */
type StatusServer = Readonly<{
  /**
   Status URL of the server.
   */
  url: string;
  /**
   Closes the server.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 Starts a server answering every request with a status code and JSON body.

 @param status - HTTP status for requests with the accepted token
 @param body - JSON body
 @param token - bearer token the server accepts; any other token gets 401

 @returns the server URL and its disposer
 */
async function serve({ status, body, token, }: Readonly<{
  status: number;
  body: unknown;
  token: string;
}>,): Promise<StatusServer> {
  /**
   Server answering with the given status and body.
   */
  const server = createServer(function respond(request, response,): void {
    response.writeHead(request.headers.authorization === `Bearer ${token}` ? status : 401, { 'content-type': 'application/json', },);
    response.end(JSON.stringify(body,),);
  },);
  await new Promise<void>(function listen(resolve,): void {
    server.listen(0, '127.0.0.1', resolve,);
  },);
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/status`,
    [Symbol.asyncDispose]: async function close(): Promise<void> {
      await new Promise<void>(function closeServer(resolve,): void {
        server.close(function closed(): void {
          resolve();
        },);
      },);
    },
  };
}

await describe({
  name: 'corsair',
  children: [
    describe({
      name: parseCorsairFields.name,
      children: [
        it({
          name: 'returns six fan speeds then the probe temperature, empty for a channel without rpm',
          fn: async function parsesBody() {
            expect(parseCorsairFields(STATUS_BODY,),).toEqual(['1271', '1473', '0', '1286', '', '900', '25.5',],);
          },
        },),
        it({
          name: 'throws when no Liquidctl device has a fan1 channel',
          fn: async function throwsWithoutFan() {
            expect(function noDevices(): void {
              parseCorsairFields({ devices: [], },);
            },).toThrow('no Corsair fan channels',);
            expect(function wrongShape(): void {
              parseCorsairFields('not an object',);
            },).toThrow('no Corsair fan channels',);
          },
        },),
      ],
    },),
    describe({
      name: 'json helpers',
      children: [
        it({
          name: 'recordsOf keeps only objects of an array and fieldText only numbers and strings',
          fn: async function helpers() {
            expect(recordsOf([{ a: 1, }, 2, null, [1,], 'x',],),).toEqual([{ a: 1, },],);
            expect(recordsOf({ a: 1, },),).toEqual([],);
            expect(fieldText(12,),).toBe('12',);
            expect(fieldText('x',),).toBe('x',);
            expect(fieldText({},),).toBe('',);
            expect(fieldText(undefined,),).toBe('',);
          },
        },),
      ],
    },),
    describe({
      name: readCorsairFields.name,
      children: [
        it({
          name: 'reads fields from the status endpoint with the bearer token',
          fn: async function readsFields() {
            /**
             Host whose token file holds a token.
             */
            const { paths, } = await makeHost({ threads: '28', cpuPressure: 0, },);
            await writeFile(paths.tokenFile, 'secret\n',);
            await using served = await serve({ status: 200, body: STATUS_BODY, token: 'secret', },);
            expect(await readCorsairFields({ tokenFile: paths.tokenFile, statusUrl: served.url, failing: false, l: recordingLogger(), },),)
              .toEqual({ fields: ['1271', '1473', '0', '1286', '', '900', '25.5',], failing: false, },);
          },
        },),
        it({
          name: 'answers empty fields without logging when the token file does not exist',
          fn: async function missingToken() {
            /**
             Host without a token file.
             */
            const { paths, } = await makeHost({ threads: '28', cpuPressure: 0, },);
            /**
             Recorder for the logged lines.
             */
            const l = recordingLogger();
            expect(await readCorsairFields({ tokenFile: paths.tokenFile, statusUrl: paths.statusUrl, failing: false, l, },),)
              .toEqual({ fields: EMPTY_CORSAIR_FIELDS, failing: false, },);
            expect(l.messages.warn,).toEqual([],);
          },
        },),
        it({
          name: 'logs FAN-READ-FAILED once on a rejected token',
          fn: async function failsOnce() {
            /**
             Host whose token file holds a token the server does not accept.
             */
            const { paths, } = await makeHost({ threads: '28', cpuPressure: 0, },);
            await writeFile(paths.tokenFile, 'rotated\n',);
            await using served = await serve({ status: 200, body: STATUS_BODY, token: 'something-else', },);
            /**
             Recorder for the logged lines.
             */
            const l = recordingLogger();
            /**
             First rejected read.
             */
            const first = await readCorsairFields({ tokenFile: paths.tokenFile, statusUrl: served.url, failing: false, l, },);
            /**
             Second rejected read, with the failure already known.
             */
            const second = await readCorsairFields({ tokenFile: paths.tokenFile, statusUrl: served.url, failing: first.failing, l, },);
            expect([first.failing, second.failing,],).toEqual([true, true,],);
            expect(first.fields,).toEqual(EMPTY_CORSAIR_FIELDS,);
            expect(l.messages.warn,).toHaveLength(1,);
            expect(l.messages.warn[0],).toContain('FAN-READ-FAILED',);
          },
        },),
        it({
          name: 'logs FAN-READ-RECOVERED when a read works after a failure',
          fn: async function recovers() {
            /**
             Host whose token file holds an accepted token.
             */
            const { paths, } = await makeHost({ threads: '28', cpuPressure: 0, },);
            await writeFile(paths.tokenFile, 'rotated\n',);
            await using served = await serve({ status: 200, body: STATUS_BODY, token: 'rotated', },);
            /**
             Recorder for the logged lines.
             */
            const l = recordingLogger();
            /**
             Read after the token works again.
             */
            const recovered = await readCorsairFields({ tokenFile: paths.tokenFile, statusUrl: served.url, failing: true, l, },);
            expect(recovered.failing,).toBe(false,);
            expect(l.messages.info[0],).toContain('FAN-READ-RECOVERED',);
          },
        },),
      ],
    },),
  ],
},);
