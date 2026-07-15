/**
 * Reference interpreter for the Stak language.
 *
 * Stak is a minimal stack-based language where each instruction occupies one line.
 * Blank lines are ignored; tokens are case-sensitive. Instruction dispatch is
 * handled by {@link executeOp} in the ops module.
 */
import { executeOp, } from './interpreter-ops.ts';

/**
 * Executes a Stak program and returns its collected output.
 *
 * @param source - program source with one instruction per line
 *
 * @returns concatenated output from PRINT and PRINTC instructions
 *
 * @throws on stack underflow, undefined variable read, or unknown instruction
 *
 * @example
 * ```ts
 * const output = runStak('5\n3\nADD\nPRINT');
 * // output === "8\n"
 * ```
 */
export function runStak(source: string,): string {
  /**
   * Source split into one trimmed, non-empty token per line; index doubles as the instruction pointer.
   */
  const tokens = source
    .split('\n',)
    .map(function trimLine(l,): string {
      return l.trim();
    },)
    .filter(function nonEmpty(l,): boolean {
      return l !== '';
    },);

  // First pass: index label positions so JUMP/JUMPZ can resolve targets before execution
  /**
   * Label name to token index; populated in the first pass so jumps can resolve forward labels.
   */
  const labels = new Map<string, number>();
  for (let loopIndex = 0; loopIndex < tokens
    .length; loopIndex++) {
    /**
     * Current token in the label-indexing pass; undefined when the array has holes.
     */
    const token = tokens[loopIndex];
    if (token === undefined)
      continue;
    /**
     * Opcode and optional label name destructured from the token; only LABEL declarations matter here.
     */
    const [
      op,
      name,
    ] = token.split(' ',);
    if ((op === 'LABEL') && (name !== undefined)) {
      labels.set(
        name,
        loopIndex,
      );
    }
  }

  /**
   * Operand stack manipulated by every op; numbers only, no tagging.
   */
  const stack: number[] = [];
  /**
   * Variable environment mapping names to current values, mutated by STORE-style ops.
   */
  const env = new Map<string, number>();
  // ip and out are let because they are mutated on every instruction
  /**
   * Instruction pointer; advances by 1 per step unless an op specifies a jump target.
   */
  let ip = 0;
  /**
   * Output buffer accumulated from PRINT/PRINTC; returned to the caller at end of program.
   */
  let out = '';

  while (ip < tokens
    .length) {
    /**
     * Token at the current ip; loop terminates if it is missing.
     */
    const currentToken = tokens[ip];
    if (currentToken === undefined)
      break;
    /**
     * Opcode and optional argument for this instruction.
     */
    const [
      op,
      arg,
    ] = currentToken.split(' ',);
    if (op === undefined) {
      ip++;
      continue;
    }

    /**
     * Result of dispatching the current op; may carry output text and/or a jump target.
     */
    const step = executeOp({
      op,
      ...((arg !== undefined) ? { arg, } : {}),
      stack,
      env,
      labels,
    },);
    if (step.output
      !== undefined)
      out += step.output;
    if (step.jumpTo
      !== undefined) {
      ip = step.jumpTo;
      continue;
    }
    ip++;
  }

  return out;
}
