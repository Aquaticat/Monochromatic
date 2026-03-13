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
 *
 * @param source - program source with one instruction per line
 *
 * @returns concatenated output from PRINT and PRINTC instructions
 *
 * @throws {Error} on stack underflow, undefined variable read, or unknown instruction
 */
export function runStak(source: string): string {
  const tokens = source.split('\n').map(function trimLine(l): string { return l.trim(); }).filter(function nonEmpty(l): boolean { return l !== ''; });

  // First pass: index label positions so JUMP/JUMPZ can resolve targets before execution
  const labels = new Map<string, number>();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === undefined) continue;
    const [op, name] = token.split(' ');
    if (op === 'LABEL' && name !== undefined) labels.set(name, i);
  }

  const stack: number[] = [];
  const env: Env = new Map();
  // ip and out are let because they are mutated on every instruction
  let ip = 0;
  let out = '';

  /**
   * Removes and returns the top stack value.
   *
   * @returns top value from the stack
   *
   * @throws {Error} if the stack is empty
   */
  function pop(): number {
    if (stack.length === 0) throw new Error('stack underflow');
    // oxlint-disable-next-line typescript/no-non-null-assertion -- length check above guarantees element exists
    return stack.pop()!;
  }

  while (ip < tokens.length) {
    const currentToken = tokens[ip];
    if (currentToken === undefined) break;
    const [op, arg] = currentToken.split(' ');

    if (op !== undefined && /^-?\d+$/.test(op)) {
      stack.push(Number(op));
      ip++;
      continue;
    }

    // oxlint-disable-next-line no-switch -- interpreter dispatch: switch is canonical for opcode dispatch and clearer than if/else chains here
    switch (op) {
      case 'ADD':  { const b = pop(); const a = pop(); stack.push(a + b); break; }
      case 'SUB':  { const b = pop(); const a = pop(); stack.push(a - b); break; }
      case 'MUL':  { const b = pop(); const a = pop(); stack.push(a * b); break; }
      case 'DIV':  { const b = pop(); const a = pop(); stack.push(Math.floor(a / b)); break; }
      case 'MOD':  { const b = pop(); const a = pop(); stack.push(((a % b) + b) % b); break; }
      case 'DUP':  { const top = stack.at(-1); if (top === undefined) throw new Error('stack underflow'); stack.push(top); break; }
      case 'SWAP': { const b = pop(); const a = pop(); stack.push(b); stack.push(a); break; }
      case 'DROP': { pop(); break; }
      case 'PRINT':  { out += `${String(pop())}\n`; break; }
      case 'PRINTC': { out += String.fromCodePoint(pop()); break; }
      case 'STORE':  { if (arg === undefined) throw new Error('STORE missing name'); env.set(arg, pop()); break; }
      case 'LOAD': {
        if (arg === undefined) throw new Error('LOAD missing name');
        const val = env.get(arg);
        if (val === undefined) throw new Error(`undefined: ${arg}`);
        stack.push(val);
        break;
      }
      case 'LABEL': { break; }
      case 'JUMP':  { if (arg === undefined) throw new Error('JUMP missing label'); const target = labels.get(arg); if (target === undefined) throw new Error(`unknown label: ${arg}`); ip = target; continue; }
      case 'JUMPZ': {
        const val = pop();
        if (val === 0) { if (arg === undefined) throw new Error('JUMPZ missing label'); const target = labels.get(arg); if (target === undefined) throw new Error(`unknown label: ${arg}`); ip = target; continue; }
        break;
      }
      default: throw new Error(`unknown op: ${String(op)}`);
    }

    ip++;
  }

  return out;
}
