import {
  describe,
  expect,
  test,
} from 'bun:test';
import { evaluatePredicate, } from './evaluate-predicate.ts';

//region Predicates

describe('evaluatePredicate', () => {
  test('returns true for a command that exits 0', async () => {
    /** `true` binary always exits 0 */
    const result = await evaluatePredicate(['true',],);
    expect(result,).toBe(true,);
  });

  test('returns false for a command that exits non-zero', async () => {
    /** `false` binary always exits 1 */
    const result = await evaluatePredicate(['false',],);
    expect(result,).toBe(false,);
  });

  test('passes arguments to the command', async () => {
    /** `ls` with a known path exits 0 */
    const result = await evaluatePredicate(['ls', '/dev/null',],);
    expect(result,).toBe(true,);
  });

  test('returns false for a nonexistent command', async () => {
    /** A command that does not exist should fail gracefully */
    const result = await evaluatePredicate(['nonexistent-command-abc123',],);
    expect(result,).toBe(false,);
  });
});

//endregion Predicates
