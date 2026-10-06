/**
 Tests for rendering what a model exchange threw: the marked class keeps its
 sentence, a provider status failure keeps its status and drops its body, and
 anything else is named by class. Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  exchangeFailureLogText,
  exchangeFailureText,
  NoProviderForModelError,
  SyntheticHttpError,
  SyntheticRequestTooLargeError,
} from '../dist/final/node/index.mjs';
import {
  quotingFailure,
  WHISKER_KEY,
} from './quoting-failure.test-fixture.ts';

await describe({
  name: exchangeFailureText.name,
  children: [
    it({
      name: 'REPEATS A MARKED CLASS\'S OWN SENTENCE, which is authored from names and counts',
      fn: async () => {
        expect(
          exchangeFailureText({
            error: new NoProviderForModelError({
              modelId: 'hf:zai-org/GLM-5.3-Flash',
              reason: 'every provider reads dry',
            },),
          },),
        ).toBe('no provider can take hf:zai-org/GLM-5.3-Flash: every provider reads dry',);
      },
    },),

    it({
      name: 'NAMES THE CLASS AND THE HTTP STATUS OF A PROVIDER FAILURE and drops the body excerpt its message carries',
      fn: async () => {
        /**
         Failure whose message carries the provider's body excerpt.
         */
        const failure = new SyntheticHttpError({
          status: 429,
          bodyText: `the cat key ${WHISKER_KEY} is over its weekly credit`,
        },);

        expect(failure.message.includes(WHISKER_KEY,),).toBe(true,);
        expect(exchangeFailureText({ error: failure, },),).toBe('refused by SyntheticHttpError with HTTP 429',);
      },
    },),

    it({
      name: 'NAMES THE CLASS ALONE OF AN UNMARKED RUNTIME FAILURE whose message quotes a header value',
      fn: async () => {
        expect(quotingFailure().message.includes(WHISKER_KEY,),).toBe(true,);
        expect(exchangeFailureText({ error: quotingFailure(), },),).toBe('refused by TypeError',);
      },
    },),

    it({
      name: 'LOG TEXT ADDS THE PROVIDER\'S WORDS labelled as its own, quoted so a line break or a quote cannot end '
        + 'the line or the quotation early',
      fn: async () => {
        /**
         The words as one quoted line, every control character and line separator written as an escape.
         */
        const quoted = String.raw`"the cat\nsaid \"no\"\u2028and\u2029left\u0085\u001b[0m"`;
        expect(exchangeFailureLogText({
          error: new SyntheticHttpError({
            status: 400,
            bodyText: 'the cat\nsaid "no"\u2028and\u2029left\u0085\u001B[0m',
          },),
        },),).toBe(
          `refused by SyntheticHttpError with HTTP 400 (the provider said: ${quoted})`,
        );
      },
    },),

    it({
      name: 'LOG TEXT ADDS THE PROVIDER\'S WORDS TO A MARKED SUBCLASS\'S OWN SENTENCE, the words its message withholds',
      fn: async () => {
        /**
         Refusal whose message withholds the gateway's words and whose excerpt keeps them.
         */
        const failure = new SyntheticRequestTooLargeError({
          status: 400,
          bodyText: 'cat gateway: could not parse the body',
          bodyBytes: 5_000_000,
        },);
        expect(exchangeFailureLogText({ error: failure, },),).toBe(
          `${exchangeFailureText({ error: failure, },)} (the provider said: "cat gateway: could not parse the body")`,
        );
      },
    },),

    it({
      name: 'LOG TEXT IS THE PLAIN TEXT where the provider said nothing: a blank excerpt, another class, or a thrown value',
      fn: async () => {
        /**
         Failure whose body held only whitespace.
         */
        const blank = new SyntheticHttpError({ status: 502, bodyText: ' \n ', },);
        /**
         Failure whose body held only a zero-width space, which shows a reader nothing.
         */
        const invisible = new SyntheticHttpError({ status: 502, bodyText: '\u200B', },);
        expect(exchangeFailureLogText({ error: blank, },),).toBe(exchangeFailureText({ error: blank, },),);
        expect(exchangeFailureLogText({ error: invisible, },),).toBe(exchangeFailureText({ error: invisible, },),);
        expect(exchangeFailureLogText({ error: quotingFailure(), },),).toBe('refused by TypeError',);
        expect(exchangeFailureLogText({ error: 'a bare string', },),).toBe('refused by a thrown value that is not an Error',);
      },
    },),

    it({
      name: 'NAMES A THROWN VALUE THAT IS NOT AN ERROR by the stand-in phrase',
      fn: async () => {
        expect(exchangeFailureText({ error: `the cat key ${WHISKER_KEY}`, },),).toBe(
          'refused by a thrown value that is not an Error',
        );
      },
    },),
  ],
},);
