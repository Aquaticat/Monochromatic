/**
 * Reference interpreter for the Stak language.
 *
 * Stak is a minimal stack-based language where each instruction occupies one line.
 * Blank lines are ignored; tokens are case-sensitive.
 */

/** Maps variable names to their current integer values */
type Env = Map<string, number>;

/**
 * Executes a Stak program and returns its collected output.
 * @param source - program source with one instruction per line
 * @returns concatenated output from PRINT and PRINTC instructions
 * @throws {Error} on stack underflow, undefined variable read, or unknown instruction
 */
export function runStak(source: string): string {
  const tokens = source.split('\n').map((l) => l.trim()).filter((l) => l !== '');

  // First pass: index label positions so JUMP/JUMPZ can resolve targets before execution
  const labels = new Map<string, number>();
  for (let i = 0; i < tokens.length; i++) {
    const [op, name] = tokens[i]!.split(' ');
    if (op === 'LABEL') labels.set(name!, i);
  }

  const stack: number[] = [];
  const env: Env = new Map();
  // ip and out are let because they are mutated on every instruction
  let ip = 0;
  let out = '';

  /**
   * Removes and returns the top stack value.
   * @throws {Error} if the stack is empty
   */
  const pop = (): number => {
    if (stack.length === 0) throw new Error('stack underflow');
    return stack.pop()!;
  };

  while (ip < tokens.length) {
    const [op, arg] = tokens[ip]!.split(' ');

    if (/^-?\d+$/.test(op!)) {
      stack.push(Number(op));
      ip++;
      continue;
    }

    switch (op) {
      case 'ADD':  { const b = pop(); const a = pop(); stack.push(a + b); break; }
      case 'SUB':  { const b = pop(); const a = pop(); stack.push(a - b); break; }
      case 'MUL':  { const b = pop(); const a = pop(); stack.push(a * b); break; }
      case 'DIV':  { const b = pop(); const a = pop(); stack.push(Math.floor(a / b)); break; }
      case 'MOD':  { const b = pop(); const a = pop(); stack.push(((a % b) + b) % b); break; }
      case 'DUP':  { stack.push(stack.at(-1)!); break; }
      case 'SWAP': { const b = pop(); const a = pop(); stack.push(b); stack.push(a); break; }
      case 'DROP': { pop(); break; }
      case 'PRINT':  { out += `${String(pop())}\n`; break; }
      case 'PRINTC': { out += String.fromCodePoint(pop()); break; }
      case 'STORE':  { env.set(arg!, pop()); break; }
      case 'LOAD': {
        const val = env.get(arg!);
        if (val === undefined) throw new Error(`undefined: ${arg}`);
        stack.push(val);
        break;
      }
      case 'LABEL': { break; }
      case 'JUMP':  { ip = labels.get(arg!)!; continue; }
      case 'JUMPZ': {
        const val = pop();
        if (val === 0) { ip = labels.get(arg!)!; continue; }
        break;
      }
      default: throw new Error(`unknown op: ${String(op)}`);
    }

    ip++;
  }

  return out;
}
