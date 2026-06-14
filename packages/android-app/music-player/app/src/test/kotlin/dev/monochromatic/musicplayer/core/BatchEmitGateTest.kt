// What:     `package dev.monochromatic.musicplayer.core` names the namespace this test file's
//           declarations live under. It is the SAME package as the code under test
//           (`BatchEmitGate.kt`), so this file constructs `BatchEmitGate` by its short name with
//           no import. In Kotlin/Java the package must mirror the directory path, so this file
//           lives at `.../test/kotlin/.../core/`.
// Why:      Sharing the package is how the test reaches the class without importing it; test and
//           main source sets merge into one package at compile time.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path IS the module; here it shares a namespace with the SUT.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import org.junit.Assert.assertEquals` pulls the STATIC FUNCTION `assertEquals` (from
//           JUnit 4's `org.junit.Assert` class) into scope by its short name.
// Why:      The value-equality assertions below (`assertEquals(expected, actual)`) need it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertEquals } from "@junit/assert";
// ```
import org.junit.Assert.assertEquals

// What:     `import org.junit.Assert.assertNull` imports the static `assertNull` function (asserts
//           a value IS null) from `org.junit.Assert`.
// Why:      The "no batch yet" assertions below (`assertNull(...)`) need it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertNull } from "@junit/assert";
// ```
import org.junit.Assert.assertNull

// What:     `import org.junit.Assert.assertNotNull` imports the static `assertNotNull` function
//           (asserts a value is NOT null) from `org.junit.Assert`.
// Why:      The "a batch fired" assertions below (`assertNotNull(...)`) need it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertNotNull } from "@junit/assert";
// ```
import org.junit.Assert.assertNotNull

// What:     `import org.junit.Test` imports the `Test` ANNOTATION class from JUnit 4 (a type, not
//           a function). It is used as the marker `@Test` on each test method; the runner runs
//           every method tagged with it.
// Why:      Without it we could not write `@Test`, and the runner would find no tests here.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "vitest"; // each @Test method becomes a test("...", () => {...})
// ```
import org.junit.Test

// =============================================================================
// File summary (for a TypeScript-only reader)
// =============================================================================
//
// Host-JVM unit tests for `BatchEmitGate`, the pure rule the streaming library
// sources use to decide WHEN to emit a partial batch and WHAT it contains. The
// real sources cannot run here (they need a device's content provider), but the
// gate is deliberately free of Android, so it can be tested directly on a plain
// JVM. These tests pin the three properties the streaming behaviour relies on:
//   - it emits only once the threshold of new items is crossed, not on every call;
//   - it tracks the last emitted size, so a second emit needs another full
//     threshold of new items, not just one more;
//   - each emitted batch is sorted-so-far by the gate's comparator.
//
// The tests use `Int` as the element type with natural-order comparison, which
// exercises the same code path the `Track`/display-path comparator uses, without
// dragging in the `Track` type.

// What:     `class BatchEmitGateTest { ... }` declares a JUnit 4 test class: an ordinary class
//           the runner instantiates to invoke each `@Test`-marked method. No constructor, no
//           state, no inheritance; just a bag of test methods.
// Why:      Groups every test for `BatchEmitGate`.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("BatchEmitGate", () => { /* ...each @Test below... */ });
// ```
class BatchEmitGateTest {
    // What:     `@Test` is an ANNOTATION (metadata, no code) telling the JUnit runner the method
    //           below is a test to run and report.
    // Why:      Marks `emitsAtTheThresholdNotBefore` as a runnable test.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("emits at the threshold, not before", () => {
    // ```
    @Test
    // What:     `fun emitsAtTheThresholdNotBefore() { ... }` declares a no-parameter test method
    //           returning `Unit` (Kotlin's "void"), block body. The descriptive name IS the
    //           test's report label.
    // Why:      Pins that the gate returns null while fewer than `threshold` new items have piled
    //           up, and a non-null batch exactly when the threshold is crossed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun emitsAtTheThresholdNotBefore() {
        // What:     `val gate = BatchEmitGate<Int>(3) { left, right -> left.compareTo(right) }`
        //           constructs a gate over `Int` with threshold 3. The trailing lambda
        //           `{ left, right -> left.compareTo(right) }` is SAM-converted to the
        //           `Comparator<Int>` it expects; `left.compareTo(right)` returns the standard
        //           negative/zero/positive `Int` (natural ascending order).
        // Why:      A small threshold makes the emit cadence easy to assert.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const gate = new BatchEmitGate<number>(3, (left, right) => left - right);
        // ```
        val gate = BatchEmitGate<Int>(3) { left, right -> left.compareTo(right) }
        // What:     `val acc = mutableListOf<Int>()` declares a read-only binding `acc` to a
        //           growable `MutableList<Int>` (the editable cousin of read-only `List<Int>`),
        //           starting empty. `mutableListOf<Int>()` is the factory.
        // Why:      It mimics a source's accumulator: we append one item at a time and ask the
        //           gate after each append, exactly as the real scan loop does.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const acc: number[] = [];
        // ```
        val acc = mutableListOf<Int>()
        // What:     `acc.add(5)` appends `5`; `assertNull("one item is below the threshold of 3", gate.nextBatch(acc))`
        //           is the message-first `assertNull(message, value)`, asserting the gate returns
        //           null at size 1.
        // Why:      One item is below the threshold, so nothing should emit.
        // Gotcha:   `assertNull(message, value)` puts the failure MESSAGE first, backwards from
        //           an `expect(value)` call.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // acc.push(5); expect(gate.nextBatch(acc)).toBeNull();
        // ```
        acc.add(5)
        assertNull("one item is below the threshold of 3", gate.nextBatch(acc))
        // What:     `acc.add(3)` appends `3`; `assertNull(...)` asserts still null at size 2.
        // Why:      Two items is still below the threshold of 3.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // acc.push(3); expect(gate.nextBatch(acc)).toBeNull();
        // ```
        acc.add(3)
        assertNull("two items is still below the threshold of 3", gate.nextBatch(acc))
        // What:     `acc.add(9)` appends `9` (size 3); `assertNotNull("three new items reaches the threshold", gate.nextBatch(acc))`
        //           is `assertNotNull(message, value)`, asserting a batch IS returned.
        // Why:      Three new items reaches the threshold, so the gate must emit.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // acc.push(9); expect(gate.nextBatch(acc)).not.toBeNull();
        // ```
        acc.add(9)
        assertNotNull("three new items reaches the threshold", gate.nextBatch(acc))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `tracksLastEmittedSizeSoItDoesNotReEmitEveryCall` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("tracks last emitted size so it does not re-emit every call", () => {
    // ```
    @Test
    // What:     `fun tracksLastEmittedSizeSoItDoesNotReEmitEveryCall() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that after an emit, the gate needs ANOTHER full threshold of new items before
    //           it emits again, instead of firing on every subsequent call.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun tracksLastEmittedSizeSoItDoesNotReEmitEveryCall() {
        // What:     `val gate = BatchEmitGate<Int>(3) { left, right -> left.compareTo(right) }`
        //           constructs the same threshold-3 ascending gate.
        // Why:      Reuse the simple gate to test the second-emit cadence.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const gate = new BatchEmitGate<number>(3, (left, right) => left - right);
        // ```
        val gate = BatchEmitGate<Int>(3) { left, right -> left.compareTo(right) }
        // What:     `val acc = mutableListOf(1, 2, 3)` declares a growable `MutableList<Int>` seeded
        //           with three items (the element type `Int` is inferred from the seed values).
        // Why:      Start already at the threshold so the first `nextBatch` emits, setting the
        //           "last emitted" mark to 3.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const acc = [1, 2, 3];
        // ```
        val acc = mutableListOf(1, 2, 3)
        // What:     `assertNotNull("the first three items emit", gate.nextBatch(acc))` asserts the
        //           first call emits (size 3, threshold 3).
        // Why:      Establish the baseline: the gate has now emitted and recorded size 3.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(gate.nextBatch(acc)).not.toBeNull();
        // ```
        assertNotNull("the first three items emit", gate.nextBatch(acc))
        // What:     `acc.add(4)` appends a fourth item; `assertNull(...)` asserts no emit (only ONE
        //           new item since the last emit at size 3).
        // Why:      One new item is below the threshold, so the gate must not re-emit.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // acc.push(4); expect(gate.nextBatch(acc)).toBeNull();
        // ```
        acc.add(4)
        assertNull("one new item since the last emit is below the threshold", gate.nextBatch(acc))
        // What:     `acc.add(5)` appends a fifth item; `assertNull(...)` asserts still no emit (TWO
        //           new since the last emit).
        // Why:      Two new items is still below the threshold of 3.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // acc.push(5); expect(gate.nextBatch(acc)).toBeNull();
        // ```
        acc.add(5)
        assertNull("two new items since the last emit is still below the threshold", gate.nextBatch(acc))
        // What:     `acc.add(6)` appends a sixth item; `assertNotNull(...)` asserts the gate emits
        //           again (THREE new since the last emit).
        // Why:      A second full threshold of new items has accumulated, so the gate emits again.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // acc.push(6); expect(gate.nextBatch(acc)).not.toBeNull();
        // ```
        acc.add(6)
        assertNotNull("a second full threshold of new items emits again", gate.nextBatch(acc))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `emitsTheAccumulatedItemsSortedSoFar` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("emits the accumulated items sorted so far", () => {
    // ```
    @Test
    // What:     `fun emitsTheAccumulatedItemsSortedSoFar() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that an emitted batch is the accumulated items SORTED by the comparator, even
    //           when they were appended out of order (pagination keeps each page's rows in arrival
    //           order, so the stream must already be sorted).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertion below... *\/ }
    // ```
    fun emitsTheAccumulatedItemsSortedSoFar() {
        // What:     `val gate = BatchEmitGate<Int>(3) { left, right -> left.compareTo(right) }`
        //           constructs the ascending threshold-3 gate.
        // Why:      Reuse it to check the sorted-snapshot output.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const gate = new BatchEmitGate<number>(3, (left, right) => left - right);
        // ```
        val gate = BatchEmitGate<Int>(3) { left, right -> left.compareTo(right) }
        // What:     `val acc = mutableListOf(9, 1, 5)` seeds the accumulator OUT of order.
        // Why:      Appending out of order is the realistic case (discovery order is arbitrary);
        //           the emitted batch must come out ascending.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const acc = [9, 1, 5];
        // ```
        val acc = mutableListOf(9, 1, 5)
        // What:     `val batch: List<Int>? = gate.nextBatch(acc)` declares a read-only NULLABLE
        //           `List<Int>?` local holding the gate's output (a sorted batch, or null).
        // Why:      Capture the one emitted batch so the assertion can inspect its order.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const batch: readonly number[] | null = gate.nextBatch(acc);
        // ```
        val batch: List<Int>? = gate.nextBatch(acc)
        // What:     `assertEquals(listOf(1, 5, 9), batch)` is `assertEquals(expected, actual)`.
        //           `listOf(1, 5, 9)` builds a read-only `List<Int>` in ascending order (the
        //           EXPECTED); `batch` is the ACTUAL emitted snapshot. Two `List`s are value-equal
        //           when their elements match in order.
        // Why:      Prove the emitted batch is sorted-so-far, not in arrival order (`9, 1, 5`).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(batch).toEqual([1, 5, 9]);
        // ```
        assertEquals(listOf(1, 5, 9), batch)
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `aJumpPastTheThresholdStillEmitsOnce` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("a jump past the threshold still emits once", () => {
    // ```
    @Test
    // What:     `fun aJumpPastTheThresholdStillEmitsOnce() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that when the accumulated size jumps well past the threshold between calls
    //           (more than `threshold` new items at once), the gate still emits, and the snapshot
    //           contains all items sorted.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertion below... *\/ }
    // ```
    fun aJumpPastTheThresholdStillEmitsOnce() {
        // What:     `val gate = BatchEmitGate<Int>(3) { left, right -> left.compareTo(right) }`
        //           constructs the ascending threshold-3 gate.
        // Why:      Reuse it to check the over-threshold jump.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const gate = new BatchEmitGate<number>(3, (left, right) => left - right);
        // ```
        val gate = BatchEmitGate<Int>(3) { left, right -> left.compareTo(right) }
        // What:     `val acc = mutableListOf(4, 2, 8, 6, 0)` seeds FIVE items at once (more than the
        //           threshold of 3), out of order.
        // Why:      Model a caller that appended several items before asking the gate; the gate's
        //           "new since last emit" is 5, which exceeds the threshold.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const acc = [4, 2, 8, 6, 0];
        // ```
        val acc = mutableListOf(4, 2, 8, 6, 0)
        // What:     `assertEquals(listOf(0, 2, 4, 6, 8), gate.nextBatch(acc))` asserts the single
        //           emitted batch contains ALL five items sorted ascending.
        // Why:      Prove a jump past the threshold emits once and includes everything sorted-so-far.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(gate.nextBatch(acc)).toEqual([0, 2, 4, 6, 8]);
        // ```
        assertEquals(listOf(0, 2, 4, 6, 8), gate.nextBatch(acc))
    }
}
