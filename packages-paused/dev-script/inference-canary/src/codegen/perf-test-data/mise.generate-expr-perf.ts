/**
 * Generates expression evaluator perf test input and expected output.
 *
 * Produces 5000 arithmetic expressions with known results. Mix of:
 * - Simple two-operand expressions
 * - Multi-operator with precedence
 * - Nested parentheses
 * - Division by zero (ERR)
 * - Negative numbers
 *
 * A correct recursive-descent parser handles this in well under 2 seconds;
 * inefficient implementations (string splitting, repeated substring operations)
 * can take 5-10+ seconds.
 */

/** Number of expressions to generate */
const EXPR_COUNT = 5_000;

/** Seed for deterministic pseudo-random generation */
const SEED = 42;

/**
 * Simple LCG for deterministic pseudo-random numbers.
 * @param seed - initial seed
 * @returns generator yielding pseudo-random integers
 */
function* lcg(seed: number,): Generator<number> {
  // state is let because the LCG updates it on every iteration
  let state = seed;
  while (true) {
    state = (state * 1_664_525 + 1_013_904_223) % 2_147_483_648;
    yield state;
  }
}

const rng = lcg(SEED,);

/**
 * Gets the next pseudo-random integer in range [min, max].
 * @param min - inclusive lower bound
 * @param max - inclusive upper bound
 * @returns pseudo-random integer
 */
function rand(min: number, max: number,): number {
  const { value, } = rng.next();
  if (value === undefined)
    throw new Error('RNG exhausted',);
  return min + (value % (max - min + 1));
}

/** All generated expressions and their expected results */
const expressions: string[] = [];
const results: string[] = [];

for (const index of Array.from({ length: EXPR_COUNT, },).keys()) {
  const variant = index % 8;

  if (variant === 0) {
    // Simple addition
    const operandA = rand(1, 999,);
    const operandB = rand(1, 999,);
    expressions.push(`${String(operandA,)} + ${String(operandB,)}`,);
    results.push(String(operandA + operandB,),);
  }
  else if (variant === 1) {
    // Precedence: a + b * c
    const operandA = rand(1, 99,);
    const operandB = rand(1, 99,);
    const operandC = rand(1, 99,);
    expressions.push(
      `${String(operandA,)} + ${String(operandB,)} * ${String(operandC,)}`,
    );
    results.push(String(operandA + operandB * operandC,),);
  }
  else if (variant === 2) {
    // Parentheses: (a + b) * c
    const operandA = rand(1, 99,);
    const operandB = rand(1, 99,);
    const operandC = rand(1, 99,);
    expressions.push(
      `(${String(operandA,)} + ${String(operandB,)}) * ${String(operandC,)}`,
    );
    results.push(String((operandA + operandB) * operandC,),);
  }
  else if (variant === 3) {
    // Division
    const operandA = rand(10, 9_999,);
    const operandB = rand(1, 99,);
    const quotient = operandA / operandB;
    // Match what a correct evaluator would produce (no rounding specified, raw float)
    expressions.push(`${String(operandA,)} / ${String(operandB,)}`,);
    results.push(String(quotient,),);
  }
  else if (variant === 4) {
    // Division by zero
    const operandA = rand(1, 999,);
    expressions.push(
      `${String(operandA,)} / (${String(rand(1, 50,),)} - ${String(rand(1, 50,),)})`,
    );
    // Might or might not be zero: compute to find out
    const evalStr = expressions.at(-1,);
    if (evalStr === undefined)
      throw new Error('Expression disappeared',);
    // Safe: we constructed this expression ourselves from known integers
    // oxlint-disable-next-line no-eval -- generating expected output for test data
    const evalResult = eval(evalStr,) as number;
    if (!Number.isFinite(evalResult,))
      results.push('ERR',);
    else
      results.push(String(evalResult,),);
  }
  else if (variant === 5) {
    // Negative number
    const operandA = rand(1, 999,);
    const operandB = rand(1, 999,);
    expressions.push(`-${String(operandA,)} + ${String(operandB,)}`,);
    results.push(String(-operandA + operandB,),);
  }
  else if (variant === 6) {
    // Nested parens: ((a + b) * (c - d))
    const operandA = rand(1, 50,);
    const operandB = rand(1, 50,);
    const operandC = rand(1, 50,);
    const operandD = rand(1, 50,);
    expressions.push(
      `((${String(operandA,)} + ${String(operandB,)}) * (${String(operandC,)} - ${
        String(operandD,)
      }))`,
    );
    results.push(String((operandA + operandB) * (operandC - operandD),),);
  }
  else {
    // Subtraction chain: a - b - c
    const operandA = rand(100, 999,);
    const operandB = rand(1, 99,);
    const operandC = rand(1, 99,);
    expressions.push(
      `${String(operandA,)} - ${String(operandB,)} - ${String(operandC,)}`,
    );
    results.push(String(operandA - operandB - operandC,),);
  }
}

const input = expressions.join('\n',) + '\n';
const expectedOutput = results.join('\n',) + '\n';

const { writeFile, } = await import('node:fs/promises');
await writeFile(new URL('expr-perf-input.txt', import.meta.url,).pathname, input,);
await writeFile(new URL('expr-perf-expected.txt', import.meta.url,).pathname,
  expectedOutput,);

console.log(
  `Generated expr perf test: ${String(EXPR_COUNT,)} expressions, ${
    String(input.length,)
  } bytes input, ${String(expectedOutput.length,)} bytes expected output`,
);

export {};
