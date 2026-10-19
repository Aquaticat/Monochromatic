/**
 Rebuilt fault controls preserving original failure causes and reuse tombstones. @module
 */
import assert from 'node:assert/strict';
import {
  RequestProducerError
} from '../dist/native/contract/collector/request-producer-judgment-consumers/owner.mjs';
import {
  createFixture,
  messageIncludes,
  observe,
  verify
} from './native-producer-lifetime-fixture.mjs';
import {
  authoredNameOf,
  contextResponseOf,
  createAuthoredResponse,
  createResultStream,
  resultStreamFor
} from './native-producer-lifetime-values.ts';

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
      if (authoredNameOf({ value: response }) === 'failed') throw failure;
      return Object.freeze({ name: authoredNameOf({ value: response }) });
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
      messageIncludes({ substring: 'completed and was superseded' })
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
        messageIncludes({ substring: 'reenter' })
      );
      return Object.freeze({ name: authoredNameOf({ value: input.response }) });
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
      messageIncludes({ substring: 'identity was reused' })
    );
    assert.throws(
      function describeReusedResponse() {
        return fixture.owner
          .describeResponse(first);
      },
      messageIncludes({ substring: 'identity was reused' })
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
      messageIncludes({ substring: 'identity was reused' })
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
      messageIncludes({ substring: 'identity was reused' })
    );
  }
  });

  await verify({
    name: 'retirement preserves historical stream reuse detection',
    async run() {
    const response = createAuthoredResponse({ name: 'original' });
    const reused = resultStreamFor({ response });
    const fixture = createFixture({ handle(input) {
      return contextResponseOf({ context: input.context })
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
      messageIncludes({ substring: 'identity was reused' })
    );
    assert.throws(
      function describeReusedStream() {
        return fixture.owner
          .describeResponse(first);
      },
      messageIncludes({ substring: 'identity was reused' })
    );
  }
  });
}

//endregion Fault controls retain their original assertions and exact names.
