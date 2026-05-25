/**
 * Instruction dispatch for the Stak interpreter.
 *
 * Each instruction handler mutates the stack and environment in place,
 * returning an {@link ExecutionStep} that tells the main loop whether to
 * jump or emit output.
 */

import { resolveJumpTarget, } from './interpreter-jumps.ts';

/** Result of executing a single Stak instruction */
export type ExecutionStep = {
  /** When set, the instruction pointer jumps to this position instead of incrementing */
  readonly jumpTo?: number;
  /** Text to append to the output buffer (from PRINT / PRINTC) */
  readonly output?: string;
};

/**
 * Removes and returns the top stack value.
 *
 * @param stack - mutable integer stack
 *
 * @returns top value from the stack
 *
 * @throws if the stack is empty
 */
function pop(stack: number[],): number {
  if (stack.length
    === 0)
    throw new Error('stack underflow',);
  /** Popped top-of-stack value; the explicit undefined check is for `noUncheckedIndexedAccess`. */
  const value = stack.pop();
  if (value === undefined)
    throw new Error('stack underflow (unreachable)',);
  return value;
}

/** Binary arithmetic operations that pop two values and push a result */
const BINARY_OPS: Record<string, (
  a: number,
  b: number,
) => number> = {
  ADD: function add(
    a,
    b,
  ) {
    return a + b;
  },
  SUB: function sub(
    a,
    b,
  ) {
    return a - b;
  },
  MUL: function mul(
    a,
    b,
  ) {
    return a * b;
  },
  DIV: function div(
    a,
    b,
  ) {
    return Math.floor(a / b,);
  },
  MOD: function mod(
    a,
    b,
  ) {
    return ((a % b) + b) % b;
  },
};

/**
 * Options for {@link executeOp}.
 *
 * @example
 * ```ts
 * const opts: ExecuteOpOptions = {
 *   op: '42',
 *   arg: undefined,
 *   stack: [],
 *   env: new Map(),
 *   labels: new Map(),
 * };
 * ```
 */
export type ExecuteOpOptions = {
  /** Opcode string (e.g. "ADD", "JUMP", or a numeric literal) */
  readonly op: string;
  /** Optional argument (variable or label name) */
  readonly arg: string | undefined;
  /** Mutable integer stack */
  readonly stack: number[];
  /** Mutable variable environment */
  readonly env: Map<string, number>;
  /** Label-to-position mapping from the indexing pass */
  readonly labels: ReadonlyMap<string, number>;
};

/**
 * Returns true when `op` is an optionally-negative ASCII integer literal
 * (mirrors `/^-?\d+$/`). Empty strings and non-digit runs return false.
 *
 * @param op - candidate opcode literal
 *
 * @returns whether `op` is a parseable integer literal
 */
function isIntegerLiteral(op: string,): boolean {
  if (op.length
    === 0)
    return false;
  /** Cursor: skip a leading `-` so the rest is checked for digits only. */
  const start = op.startsWith('-',) ? 1 : 0;
  if (start >= op
    .length)
    return false;
  for (const c of op.slice(start,)) {
    if ((c < '0') || (c > '9'))
      return false;
  }
  return true;
}

/**
 * Executes a single Stak instruction, mutating the stack and environment.
 *
 * @param op - opcode string (e.g. "ADD", "JUMP", or a numeric literal)
 *
 * @param arg - optional argument (variable or label name)
 *
 * @param stack - mutable integer stack
 *
 * @param env - mutable variable environment
 *
 * @param labels - label-to-position mapping from the indexing pass
 *
 * @returns step result indicating jump target and/or output text
 *
 * @throws on stack underflow, undefined variable, missing argument, or unknown opcode
 *
 * @example
 * ```ts
 * const stack: number[] = [];
 * const env = new Map<string, number>();
 * const labels = new Map<string, number>();
 * executeOp({ op: '42', arg: undefined, stack, env, labels });
 * // stack is now [42]
 * ```
 */
export function executeOp({
  op,
  arg,
  stack,
  env,
  labels,
}: ExecuteOpOptions,): ExecutionStep {
  if (isIntegerLiteral(op,)) {
    stack.push(Number(op,),);
    return {};
  }

  /** Binary arithmetic implementation for `op`, or undefined when the op is non-arithmetic. */
  const binaryOp = BINARY_OPS[op];
  if (binaryOp !== undefined) {
    /** Right-hand operand; popped first because Stak pushes in left-to-right order. */
    const b = pop(stack,);
    /** Left-hand operand; popped after `b` to restore the original operand order. */
    const a = pop(stack,);
    stack.push(binaryOp(
      a,
      b,
    ),);
  }
  else if (op === 'DUP') {
    /** Current top of stack; duplicated without consuming, hence `at(-1)` rather than `pop`. */
    const top = stack.at(-1,);
    if (top === undefined)
      throw new Error('stack underflow',);
    stack.push(top,);
  }
  else if (op === 'SWAP') {
    /** Top operand before swap; re-pushed second so it lands below `a`. */
    const b = pop(stack,);
    /** Second operand before swap; re-pushed last so it lands on top. */
    const a = pop(stack,);
    stack.push(b,);
    stack.push(a,);
  }
  else if (op === 'DROP')
    pop(stack,);
  else if (op === 'PRINT')
    return { output: `${String(pop(stack,),)}\n`, };
  else if (op === 'PRINTC')
    return { output: String.fromCodePoint(pop(stack,),), };
  else if (op === 'STORE') {
    if (arg === undefined)
      throw new Error('STORE missing name',);
    env.set(
      arg,
      pop(stack,),
    );
  }
  else if (op === 'LOAD') {
    if (arg === undefined)
      throw new Error('LOAD missing name',);
    /** Value bound to `arg` in the environment; undefined means the variable was never STOREd. */
    const val = env.get(arg,);
    if (val === undefined)
      throw new Error(`undefined: ${arg}`,);
    stack.push(val,);
  }
  else if (op === 'LABEL') {
    /* no-op */
  }
  else if (op === 'JUMP') {
    return resolveJumpTarget({
      op,
      arg,
      labels,
    },);
  }
  else if (op === 'JUMPZ') {
    /** Popped predicate; conditionally jumps when zero, otherwise falls through. */
    const val = pop(stack,);
    if (val === 0) {
      return resolveJumpTarget({
        op,
        arg,
        labels,
      },);
    }
  }
  else {
    throw new Error(`unknown op: ${String(op,)}`,);
  }

  return {};
}
