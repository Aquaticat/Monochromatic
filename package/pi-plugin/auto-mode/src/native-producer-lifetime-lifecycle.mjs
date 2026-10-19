/**
 Producer lifetime cases preserving active consumers and current diagnostics. @module
 */
import assert from 'node:assert/strict';
import {
  createFixture,
  observe,
  verify
} from './native-producer-lifetime-fixture.mjs';

//region Lifetime cases retain their original assertions and exact names.

/**
 Run the producer lifetime cases in their original order.

 @returns completion of every lifetime case
 */
export async function runProducerLifetimeCases() {
  await verify({
    name: 'latest completed diagnostic survives until the next original judgment',
    async run() {
    const fixture = createFixture();
    const first = await observe({
      fixture,
      name: 'first'
    });
    const firstValue = fixture.owner
      .beginJudgment(first);
    fixture.owner
      .completeJudgment(first);
    assert.equal(
      fixture.owner
        .judgmentFor(first),
      firstValue
    );
    const second = await observe({
      fixture,
      name: 'second'
    });
    const secondValue = fixture.owner
      .beginJudgment(second);
    assert.throws(
      function readSupersededFirst() {
        return fixture.owner
          .judgmentFor(first);
      },
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed tokens with one wildcard gap, no nested quantifiers.
      /completed.*superseded/u
    );
    assert.equal(
      fixture.owner
        .judgmentFor(second),
      secondValue
    );
    assert.equal(
      fixture.owner
        .describeResponse(first)
        .kind,
      'main-agent'
    );
    assert.throws(
      function reserveCompletedFirst() {
        return fixture.owner
          .beginJudgment(first);
      },
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed literal tokens, no quantifiers.
      /already reserved/u
    );
    fixture.owner
      .completeJudgment(second);
    assert.throws(
      function completeSecondAgain() {
        fixture.owner
          .completeJudgment(second);
      },
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed literal tokens, no quantifiers.
      /already completed/u
    );
  }
  });

  await verify({
    name: 'newer construction preserves an active earlier operation until its own completion',
    async run() {
    const fixture = createFixture();
    const first = await observe({
      fixture,
      name: 'first'
    });
    const firstValue = fixture.owner
      .beginJudgment(first);
    const second = await observe({
      fixture,
      name: 'second'
    });
    const secondValue = fixture.owner
      .beginJudgment(second);
    assert.equal(
      fixture.owner
        .judgmentFor(first),
      firstValue
    );
    assert.equal(
      fixture.owner
        .judgmentFor(second),
      secondValue
    );
    fixture.owner
      .completeJudgment(second);
    fixture.owner
      .completeJudgment(first);
    assert.throws(
      function readSupersededFirst() {
        return fixture.owner
          .judgmentFor(first);
      },
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed tokens with one wildcard gap, no nested quantifiers.
      /completed.*superseded/u
    );
    assert.equal(
      fixture.owner
        .judgmentFor(second),
      secondValue
    );
  }
  });

  await verify({
    name: 'independent consumers preserve their own latest completed diagnostic',
    async run() {
    const left = createFixture();
    const right = createFixture({ owner: left.owner });
    const a = await observe({
      fixture: left,
      name: 'left'
    });
    const b = await observe({
      fixture: right,
      name: 'right'
    });
    const first = left.owner
      .beginJudgment(a);
    const second = right.owner
      .beginJudgment(b);
    left.owner
      .completeJudgment(a);
    right.owner
      .completeJudgment(b);
    assert.equal(
      left.owner
        .judgmentFor(a),
      first
    );
    assert.equal(
      right.owner
        .judgmentFor(b),
      second
    );
    assert.throws(
      function completeForeignConsumer() {
        left.owner
          .completeJudgment({
            response: b.response,
            stream: left.stream
          });
      },
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed literal tokens, no quantifiers.
      /exact consumer/u
    );
  }
  });

  await verify({
    name: 'auxiliary and unjudged main responses do not retire an active primary operation',
    async run() {
    const fixture = createFixture();
    const main = await observe({
      fixture,
      name: 'main'
    });
    const value = fixture.owner
      .beginJudgment(main);
    const auxiliary = await observe({
      fixture,
      name: 'auxiliary',
      auxiliary: true
    });
    assert.throws(
      function beginAuxiliaryJudgment() {
        return fixture.owner
          .beginJudgment(auxiliary);
      },
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed literal tokens, no quantifiers.
      /Auxiliary/u
    );
    assert.throws(
      function completeAuxiliaryJudgment() {
        fixture.owner
          .completeJudgment(auxiliary);
      },
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- error-message shape check in this preserved assertion; input is one captured Error message; fixed literal tokens, no quantifiers.
      /Auxiliary/u
    );
    const unjudged = await observe({
      fixture,
      name: 'unjudged'
    });
    fixture.owner
      .completeJudgment(unjudged);
    assert.equal(
      fixture.owner
        .judgmentFor(main),
      value
    );
    fixture.owner
      .completeJudgment(main);
  }
  });
}

//endregion Lifetime cases retain their original assertions and exact names.
