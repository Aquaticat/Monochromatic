/**
 Tests for masking the credentials a request carried out of a reply body, and
 for listing which header values count as credentials.
 Fixtures are cat-themed invention; the key is the stand-in the quoting-failure
 fixture holds.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  CREDENTIAL_MARKER,
  credentialsOfHeaders,
  maskCredentials,
  MINIMUM_CREDENTIAL_UNITS,
} from '../dist/final/node/index.mjs';
import { WHISKER_KEY, } from './quoting-failure.test-fixture.ts';

/**
 Header value carrying the stand-in key behind its scheme word.
 */
const BEARER = `Bearer ${WHISKER_KEY}`;

await describe({
  name: 'credential mask',
  children: [
    it({
      name: 'WRITES THE MARKER A READER FINDS, free of every character a JSON string escapes',
      fn: async () => {
        expect(CREDENTIAL_MARKER,).toBe('[masked: credential sent with this request]',);
        expect(MINIMUM_CREDENTIAL_UNITS,).toBe(12,);
        expect(JSON.stringify(CREDENTIAL_MARKER,),).toBe(`"${CREDENTIAL_MARKER}"`,);
      },
    },),
    it({
      name: 'MASKS THE WHOLE HEADER VALUE as one marker, the token inside it not leaving a second',
      fn: async () => {
        expect(maskCredentials({
          text: `rejected ${BEARER} today`,
          credentials: [BEARER, WHISKER_KEY,],
        },),).toBe(`rejected ${CREDENTIAL_MARKER} today`,);
      },
    },),
    it({
      name: 'MASKS THE TOKEN WITHOUT ITS SCHEME WORD and leaves the scheme word standing',
      fn: async () => {
        expect(maskCredentials({
          text: `rejected Bearer ${WHISKER_KEY}`,
          credentials: [WHISKER_KEY,],
        },),).toBe(`rejected Bearer ${CREDENTIAL_MARKER}`,);
      },
    },),
    it({
      name: 'MASKS EVERY OCCURRENCE, overlapping and touching ones included',
      fn: async () => {
        expect(maskCredentials({
          text: `${WHISKER_KEY} and ${WHISKER_KEY}${WHISKER_KEY}!`,
          credentials: [WHISKER_KEY,],
        },),).toBe(`${CREDENTIAL_MARKER} and ${CREDENTIAL_MARKER}!`,);
        expect(maskCredentials({
          text: 'aaaaaaaaaaaaaaaa',
          credentials: ['aaaaaaaaaaaa',],
        },),).toBe(CREDENTIAL_MARKER,);
      },
    },),
    it({
      name: 'RETURNS THE VERY SAME TEXT when no credential occurs in it',
      fn: async () => {
        /**
         Reply that never mentions the key.
         */
        const text = 'the cat napped on the mat';
        expect(maskCredentials({
          text,
          credentials: [WHISKER_KEY,],
        },),).toBe(text,);
        expect(maskCredentials({
          text,
          credentials: [],
        },),).toBe(text,);
      },
    },),
    it({
      name: 'LEAVES A VALUE UNDER THE MINIMUM ALONE and masks one at the minimum',
      fn: async () => {
        /**
         Value one unit under the minimum.
         */
        const short = 'a'.repeat(MINIMUM_CREDENTIAL_UNITS - 1,);
        /**
         Value exactly at the minimum.
         */
        const exact = 'b'.repeat(MINIMUM_CREDENTIAL_UNITS,);
        expect(maskCredentials({
          text: `${short} ${exact}`,
          credentials: [short, exact,],
        },),).toBe(`${short} ${CREDENTIAL_MARKER}`,);
      },
    },),
    it({
      name: 'LEAVES THE TEXT ALONE FOR AN EMPTY CREDENTIAL, which would otherwise match at every position',
      fn: async () => {
        expect(maskCredentials({
          text: 'the cat napped',
          credentials: ['',],
        },),).toBe('the cat napped',);
      },
    },),
    it({
      name: 'KEEPS A JSON STRING VALID where the credential stands against its delimiters and escapes',
      fn: async () => {
        /**
         Key holding a quote, a backslash and a slash, as a header may.
         */
        const odd = String.raw`cat/key"with\odd-7421`;
        /**
         Reply writing the key as a JSON string does, and with the slash escaped.
         */
        const text = `{"a":"${JSON.stringify(odd,).slice(1, -1,)}","b":"${
          JSON.stringify(odd,).slice(1, -1,)
            .split('/',)
            .join(String.raw`\/`,)
        }","c":"${WHISKER_KEY}"}`;
        /**
         What the reply parses to once masked.
         */
        const parsed: unknown = JSON.parse(maskCredentials({
          text,
          credentials: [odd, WHISKER_KEY,],
        },),);
        expect(parsed,).toEqual({
          a: CREDENTIAL_MARKER,
          b: CREDENTIAL_MARKER,
          c: CREDENTIAL_MARKER,
        },);
      },
    },),
    it({
      name: 'MASKS IN A BODY THAT IS NOT JSON, an event frame or a line of prose',
      fn: async () => {
        expect(maskCredentials({
          text: `data: bad key ${WHISKER_KEY}\n\nplain ${WHISKER_KEY}`,
          credentials: [WHISKER_KEY,],
        },),).toBe(`data: bad key ${CREDENTIAL_MARKER}\n\nplain ${CREDENTIAL_MARKER}`,);
      },
    },),
    it({
      name: 'MASKS BETWEEN ASTRAL CHARACTERS without splitting a surrogate pair',
      fn: async () => {
        expect(maskCredentials({
          text: `\u{1F431}${WHISKER_KEY}\u{1F431}\u{1F431}${WHISKER_KEY}`,
          credentials: [WHISKER_KEY,],
        },),).toBe(`\u{1F431}${CREDENTIAL_MARKER}\u{1F431}\u{1F431}${CREDENTIAL_MARKER}`,);
      },
    },),
    it({
      name: 'NEVER SEARCHES THE MARKER it wrote, whatever a credential spells',
      fn: async () => {
        expect(maskCredentials({
          text: `${WHISKER_KEY} masked`,
          credentials: [WHISKER_KEY, 'credential sent',],
        },),).toBe(`${CREDENTIAL_MARKER} masked`,);
      },
    },),
    it({
      name: 'LISTS THE WHOLE VALUE AND THE TOKEN of an authorization header, whatever the name\'s case',
      fn: async () => {
        expect(credentialsOfHeaders({ headers: { authorization: BEARER, }, },),).toEqual([BEARER, WHISKER_KEY,],);
        expect(credentialsOfHeaders({ headers: { Authorization: BEARER, }, },),).toEqual([BEARER, WHISKER_KEY,],);
      },
    },),
    it({
      name: 'LISTS THE VALUE ALONE of an API key header that has no scheme word',
      fn: async () => {
        expect(credentialsOfHeaders({ headers: { 'x-api-key': WHISKER_KEY, }, },),).toEqual([WHISKER_KEY,],);
      },
    },),
    it({
      name: 'LISTS NOTHING for headers no credential travels in, and for a secret under the minimum',
      fn: async () => {
        expect(credentialsOfHeaders({
          headers: {
            'content-type': 'application/json',
            'anthropic-version': '2023-06-01',
            'authorization': 'Bearer ',
            'x-api-key': 'short',
          },
        },),).toEqual([],);
      },
    },),
  ],
},);
