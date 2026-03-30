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
 */
export function runStak(source: string,): string {
  const tokens = source
    .split('\n',)
    .map(function trimLine(l,): string {
      return l.trim();
    },)
    .filter(function nonEmpty(l,): boolean {
      return l !== '';
    },);

  // First pass: index label positions so JUMP/JUMPZ can resolve targets before execution
  const labels = new Map<string, number>();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === undefined)
      continue;
    const [op, name,] = token.split(' ',);
    if (op === 'LABEL' && name !== undefined) {
      labels.set(
        name,
        i,
      );
    }
  }

  const stack: number[] = [];
  const env = new Map<string, number>();
  // ip and out are let because they are mutated on every instruction
  let ip = 0;
  let out = '';

  while (ip < tokens.length) {
    const currentToken = tokens[ip];
    if (currentToken === undefined)
      break;
    const [op, arg,] = currentToken.split(' ',);
    if (op === undefined) {
      ip++;
      continue;
    }

    const step = executeOp(
      op,
      arg,
      stack,
      env,
      labels,
    );
    if (step.output !== undefined)
      out += step.output;
    if (step.jumpTo !== undefined) {
      ip = step.jumpTo;
      continue;
    }
    ip++;
  }

  return out;
}
