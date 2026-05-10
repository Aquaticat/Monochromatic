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
  if (stack.length === 0)
    throw new Error('stack underflow',);
  const value = stack.pop();
  if (value === undefined)
    throw new Error('stack underflow (unreachable)',);
  return value;
}

/** Binary arithmetic operations that pop two values and push a result */
const BINARY_OPS: Record<string, (a: number, b: number,) => number> = {
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
 * executeOp('42', undefined, stack, env, labels);
 * // stack is now [42]
 * ```
 */
export function executeOp(
  op: string,
  arg: string | undefined,
  stack: number[],
  env: Map<string, number>,
  labels: ReadonlyMap<string, number>,
): ExecutionStep {
  // oxlint-disable-next-line prefer-named-capture-group -- detection heuristic, not data extraction
  if (/^-?\d+$/.test(op,)) {
    stack.push(Number(op,),);
    return {};
  }

  const binaryOp = BINARY_OPS[op];
  if (binaryOp !== undefined) {
    const b = pop(stack,);
    const a = pop(stack,);
    stack.push(binaryOp(
      a,
      b,
    ),);
  }
  else if (op === 'DUP') {
    const top = stack.at(-1,);
    if (top === undefined)
      throw new Error('stack underflow',);
    stack.push(top,);
  }
  else if (op === 'SWAP') {
    const b = pop(stack,);
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
    const val = env.get(arg,);
    if (val === undefined)
      throw new Error(`undefined: ${arg}`,);
    stack.push(val,);
  }
  else if (op === 'LABEL') {
    /* no-op */
  }
  else if (op === 'JUMP') {
    return resolveJumpTarget(
      op,
      arg,
      labels,
    );
  }
  else if (op === 'JUMPZ') {
    const val = pop(stack,);
    if (val === 0) {
      return resolveJumpTarget(
        op,
        arg,
        labels,
      );
    }
  }
  else {
    throw new Error(`unknown op: ${String(op,)}`,);
  }

  return {};
}
