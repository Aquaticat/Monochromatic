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
    const value = stack.pop();
    if (value === undefined) throw new Error('stack underflow — unreachable');
    return value;
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

    if (op === 'ADD') { const b = pop(); const a = pop(); stack.push(a + b); }
    else if (op === 'SUB') { const b = pop(); const a = pop(); stack.push(a - b); }
    else if (op === 'MUL') { const b = pop(); const a = pop(); stack.push(a * b); }
    else if (op === 'DIV') { const b = pop(); const a = pop(); stack.push(Math.floor(a / b)); }
    else if (op === 'MOD') { const b = pop(); const a = pop(); stack.push(((a % b) + b) % b); }
    else if (op === 'DUP') { const top = stack.at(-1); if (top === undefined) throw new Error('stack underflow'); stack.push(top); }
    else if (op === 'SWAP') { const b = pop(); const a = pop(); stack.push(b); stack.push(a); }
    else if (op === 'DROP') { pop(); }
    else if (op === 'PRINT') { out += `${String(pop())}\n`; }
    else if (op === 'PRINTC') { out += String.fromCodePoint(pop()); }
    else if (op === 'STORE') { if (arg === undefined) throw new Error('STORE missing name'); env.set(arg, pop()); }
    else if (op === 'LOAD') {
      if (arg === undefined) throw new Error('LOAD missing name');
      const val = env.get(arg);
      if (val === undefined) throw new Error(`undefined: ${arg}`);
      stack.push(val);
    }
    else if (op === 'LABEL') { /* no-op */ }
    else if (op === 'JUMP') { if (arg === undefined) throw new Error('JUMP missing label'); const target = labels.get(arg); if (target === undefined) throw new Error(`unknown label: ${arg}`); ip = target; continue; }
    else if (op === 'JUMPZ') {
      const val = pop();
      if (val === 0) { if (arg === undefined) throw new Error('JUMPZ missing label'); const target = labels.get(arg); if (target === undefined) throw new Error(`unknown label: ${arg}`); ip = target; continue; }
    }
    else { throw new Error(`unknown op: ${String(op)}`); }

    ip++;
  }

  return out;
}
