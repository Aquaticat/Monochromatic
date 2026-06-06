/**
 * Generates CSS mixin transpiler perf test input and expected output.
 *
 * Produces a stylesheet with:
 * - 20 mixin definitions (some referencing others via @apply)
 * - 500 rule blocks each using 1-3 @apply rules
 * - Nested rules with @apply at depth 2
 *
 * A correct character-by-character parser handles this in well under 3 seconds;
 * naive approaches with excessive string scanning or rebuilding can take 8-15+ seconds.
 */

/** Number of base mixins to define */
const MIXIN_COUNT = 20;

/** Number of rule blocks that use @apply */
const RULE_COUNT = 500;

/**
 * Generates a mixin definition with 2-4 declarations.
 * @param index - zero-based mixin index
 * @returns mixin CSS block
 */
function generateMixin(
  index: number,
): { name: string; css: string; declarations: string; } {
  const name = `--mixin-${String(index,)}`;
  const decls = [
    `  property-a-${String(index,)}: value-a-${String(index,)};`,
    `  property-b-${String(index,)}: value-b-${String(index,)};`,
  ];
  if (index % 3 === 0)
    decls.push(`  property-c-${String(index,)}: value-c-${String(index,)};`,);
  if (index % 5 === 0)
    decls.push(`  property-d-${String(index,)}: value-d-${String(index,)};`,);
  const declarations = decls.join('\n',);
  const css = `@mixin ${name} {\n${declarations}\n}`;
  return { name, css, declarations, };
}

/**
 * Generates a recursive mixin that applies another mixin.
 * @param index - mixin index
 * @param referencedName - name of the mixin to @apply inside
 * @param referencedDeclarations - declarations of the referenced mixin (for expected output)
 * @returns mixin definition and its fully expanded declarations
 */
function generateRecursiveMixin(
  index: number,
  referencedName: string,
  referencedDeclarations: string,
): { name: string; css: string; expandedDeclarations: string; } {
  const name = `--recursive-${String(index,)}`;
  const ownDecl = `  recursive-prop-${String(index,)}: recursive-val-${String(index,)};`;
  const css = `@mixin ${name} {\n  @apply ${referencedName};\n${ownDecl}\n}`;
  const expandedDeclarations = `${referencedDeclarations}\n${ownDecl}`;
  return { name, css, expandedDeclarations, };
}

// Generate base mixins
const mixins = Array.from({ length: MIXIN_COUNT, },).map((_, index,) =>
  generateMixin(index,)
);

// Generate 5 recursive mixins that reference base mixins
const recursiveMixinCount = 5;
const recursiveMixins = Array.from({ length: recursiveMixinCount, },).map((_, index,) => {
  const baseMixin = mixins[index % MIXIN_COUNT];
  if (baseMixin === undefined)
    throw new Error('Base mixin undefined',);
  return generateRecursiveMixin(index, baseMixin.name, baseMixin.declarations,);
},);

// All mixin definitions
const allMixinCss = [
  ...mixins.map(mixin => mixin.css),
  ...recursiveMixins.map(mixin => mixin.css),
]
  .join('\n\n',);

// Generate rule blocks
const ruleInputLines: string[] = [];
const ruleExpectedLines: string[] = [];

for (const index of Array.from({ length: RULE_COUNT, },).keys()) {
  const selector = `.component-${String(index,)}`;
  const ownDecl = `  color: hsl(${String(index % 360,)}, 50%, 50%);`;

  // Pick 1-3 mixins to apply
  const applyCount = 1 + (index % 3);
  const applyNames: string[] = [];
  const expandedDecls: string[] = [];

  for (const applyIndex of Array.from({ length: applyCount, },).keys()) {
    const mixinIdx = (index + applyIndex) % MIXIN_COUNT;

    // Every 7th rule uses a recursive mixin instead
    if (index % 7 === 0 && applyIndex === 0) {
      const recursiveIdx = index % recursiveMixinCount;
      const recMixin = recursiveMixins[recursiveIdx];
      if (recMixin === undefined)
        throw new Error('Recursive mixin undefined',);
      applyNames.push(recMixin.name,);
      expandedDecls.push(recMixin.expandedDeclarations,);
    }
    else {
      const mixin = mixins[mixinIdx];
      if (mixin === undefined)
        throw new Error('Mixin undefined',);
      applyNames.push(mixin.name,);
      expandedDecls.push(mixin.declarations,);
    }
  }

  const applyLines = applyNames.map(name => `  @apply ${name};`).join('\n',);

  // Every 10th rule has a nested rule with @apply
  if (index % 10 === 0) {
    const nestedMixinIdx = (index + 3) % MIXIN_COUNT;
    const nestedMixin = mixins[nestedMixinIdx];
    if (nestedMixin === undefined)
      throw new Error('Nested mixin undefined',);
    const nestedInput =
      `\n  & .nested {\n    @apply ${nestedMixin.name};\n    font-size: 1rem;\n  }`;
    const nestedExpected =
      `\n  & .nested {\n${nestedMixin.declarations}\n    font-size: 1rem;\n  }`;

    ruleInputLines.push(`${selector} {\n${applyLines}\n${ownDecl}${nestedInput}\n}`,);
    ruleExpectedLines.push(
      `${selector} {\n${expandedDecls.join('\n',)}\n${ownDecl}${nestedExpected}\n}`,
    );
  }
  else {
    ruleInputLines.push(`${selector} {\n${applyLines}\n${ownDecl}\n}`,);
    ruleExpectedLines.push(`${selector} {\n${expandedDecls.join('\n',)}\n${ownDecl}\n}`,);
  }
}

const input = allMixinCss + '\n\n' + ruleInputLines.join('\n\n',) + '\n';
const expectedOutput = ruleExpectedLines.join('\n\n',) + '\n';

const { writeFile, } = await import('node:fs/promises');
await writeFile(new URL('css-mixin-perf-input.txt', import.meta.url,).pathname, input,);
await writeFile(new URL('css-mixin-perf-expected.txt', import.meta.url,).pathname,
  expectedOutput,);

console.log(
  `Generated CSS mixin perf test: ${String(MIXIN_COUNT,)} mixins + ${
    String(RULE_COUNT,)
  } rules, ${String(input.length,)} bytes input, ${
    String(expectedOutput.length,)
  } bytes expected output`,
);

export {};
