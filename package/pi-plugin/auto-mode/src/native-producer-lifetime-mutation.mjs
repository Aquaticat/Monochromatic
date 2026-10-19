/**
 Rebuilt fault controls preserving original failure causes and reuse tombstones. @module
 */
import assert from 'node:assert/strict';
import {
  RequestProducerError
} from '../dist/native/contract/collector/request-producer-judgment-consumers/owner.mjs';
import {
  createFixture,
  createResultStream,
  observe,
  verify
} from './native-producer-lifetime-fixture.mjs';

//region Fault controls retain their original assertions and exact names.

/**
 Run the rebuilt fault controls in their original order.

 @returns completion of every fault control
 */
export async function runProducerMutationControls() {
  await verify({
    name: 'failed construction retains its exact latest cause until superseded',
    async run() {
    const failure = new Error('original fixture construction failure');
    const fixture = createFixture({ construct({ response }) {
      if (response.name === 'failed') throw failure;
      return Object.freeze({ name: response.name });
    } });
    const failed = await observe({
      fixture,
      name: 'failed'
    });
    assert.throws(
      function beginFailedConstruction() {
        return fixture.owner
          .beginJudgment(failed);
      },
      function isOriginalFailure(error) {
        return error === failure;
      }
    );
    fixture.owner
      .completeJudgment(failed);
    assert.throws(
      function readFailedCause() {
        return fixture.owner
          .judgmentFor(failed);
      },
      function isWrappedOriginalFailure(error) {
        return (error instanceof RequestProducerError) && (error.cause === failure);
      }
    );
    const next = await observe({
      fixture,
      name: 'next'
    });
    fixture.owner
      .beginJudgment(next);
    assert.throws(
      function readSupersededFailed() {
        return fixture.owner
          .judgmentFor(failed);
      },
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed tokens with one wildcard gap, no nested quantifiers.
      /completed.*superseded/u
    );
    fixture.owner
      .completeJudgment(next);
  }
  });

  await verify({
    name: 'completion cannot reenter construction or invalidate the current reservation',
    async run() {
    const fixture = createFixture({ construct(input) {
      assert.throws(
        function reenterCompletion() {
          fixture.owner
            .completeJudgment(input);
        },
        // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed literal tokens, no quantifiers.
        /reenter/u
      );
      return Object.freeze({ name: input.response
        .name });
    } });
    const input = await observe({
      fixture,
      name: 'reentrant'
    });
    const value = fixture.owner
      .beginJudgment(input);
    assert.equal(
      fixture.owner
        .judgmentFor(input),
      value
    );
    fixture.owner
      .completeJudgment(input);
  }
  });

  await verify({
    name: 'retirement preserves historical response reuse detection',
    async run() {
    const fixture = createFixture();
    const first = await observe({
      fixture,
      name: 'first'
    });
    fixture.owner
      .beginJudgment(first);
    fixture.owner
      .completeJudgment(first);
    const next = await observe({
      fixture,
      name: 'next'
    });
    fixture.owner
      .beginJudgment(next);
    await assert.rejects(
      observe({
        fixture,
        response: first.response
      }),
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed literal tokens, no quantifiers.
      /identity was reused/u
    );
    assert.throws(
      function describeReusedResponse() {
        return fixture.owner
          .describeResponse(first);
      },
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed literal tokens, no quantifiers.
      /identity was reused/u
    );
    fixture.owner
      .completeJudgment(next);
  }
  });

  await verify({
    name: 'late response ambiguity does not replace the primary operation failure during cleanup',
    async run() {
    const fixture = createFixture();
    const input = await observe({
      fixture,
      name: 'active'
    });
    fixture.owner
      .beginJudgment(input);
    await assert.rejects(
      observe({
        fixture,
        response: input.response
      }),
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed literal tokens, no quantifiers.
      /identity was reused/u
    );
    const failure = new Error('original operation failure after response reuse');
    assert.throws(
      function disposeFailedOperation() {
      using completion = { [Symbol.dispose]() {
        fixture.owner
          .completeJudgment(input);
      } };
      throw failure;
    },
      function isOriginalFailure(error) {
        return error === failure;
      }
    );
    assert.throws(
      function describeReusedResponse() {
        return fixture.owner
          .describeResponse(input);
      },
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed literal tokens, no quantifiers.
      /identity was reused/u
    );
  }
  });

  await verify({
    name: 'retirement preserves historical stream reuse detection',
    async run() {
    const response = { name: 'original' };
    const reused = createResultStream({ context: { response } });
    const fixture = createFixture({ handle(input) {
      return input.context
        .response
        === response ? reused : createResultStream(input);
    } });
    const first = await observe({
      fixture,
      response
    });
    fixture.owner
      .beginJudgment(first);
    fixture.owner
      .completeJudgment(first);
    const next = await observe({
      fixture,
      name: 'next'
    });
    fixture.owner
      .beginJudgment(next);
    fixture.owner
      .completeJudgment(next);
    await assert.rejects(
      observe({
        fixture,
        response
      }),
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed literal tokens, no quantifiers.
      /identity was reused/u
    );
    assert.throws(
      function describeReusedStream() {
        return fixture.owner
          .describeResponse(first);
      },
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed literal tokens, no quantifiers.
      /identity was reused/u
    );
  }
  });
}

//endregion Fault controls retain their original assertions and exact names.
