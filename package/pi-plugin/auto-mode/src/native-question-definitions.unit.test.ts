/** Built catalogs preserve pinned bytes, fixed rubric membership, and independent claim indexes. @module */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from '@monochromatic-dev/module-test/ts';

type CatalogModule = Readonly<{
  readQuestionDefinitions: (input: Readonly<Record<string, unknown>>) => Readonly<{
    digest: string;
    definitions: ReadonlyMap<string, Readonly<{ type: string; instructions: string; criteria: Readonly<Record<string, string>> }>>;
    byDefinition: ReadonlyMap<string, WeakMap<object, object>>;
  }>;
}>;

function assertCatalogModule(value: unknown): asserts value is CatalogModule {
  assert.ok(typeof value === 'object' && value !== null);
  assert.ok('readQuestionDefinitions' in value && typeof value.readQuestionDefinitions === 'function');
}

const loaded: unknown = await import(new URL('../dist/native/contract/lifecycle/claim-evidence-batch-selection/selection-definitions.ts', import.meta.url).href);
assertCatalogModule(loaded);

function fixedScalar(): Readonly<Record<string, unknown>> {
  return { type: 'noul', instructions: 'Assess the fixed predicate.', criteria: { false: 'negative', true: 'positive' } };
}

function fixedChoice(): Readonly<Record<string, unknown>> {
  return { type: 'choice', instructions: 'Select the best fixed option.', criteria: { yes: 'positive', no: 'negative' } };
}

function catalogInput(catalogText: string): Readonly<Record<string, unknown>> {
  return { catalogText, catalogSHA256: createHash('sha256').update(catalogText).digest('hex'), envelope: Object.freeze({}), resolveBinding: function resolveBinding() {
    throw new Error('Catalog admission must not resolve bindings');
  } };
}

function readCatalog(value: unknown): ReturnType<CatalogModule['readQuestionDefinitions']> {
  return loaded.readQuestionDefinitions(catalogInput(JSON.stringify(value)));
}

//region Pinned catalogs establish structural membership, never claim identity or semantic truth.
await describe({ name: '', children: [
  it({ name: 'retains exact digest and instruction bytes with stable definition and scalar rubric order', fn: async function retainCatalog() {
    const source = JSON.stringify({ scalar: fixedScalar(), choice: fixedChoice() });
    const input = catalogInput(source);
    const catalog = loaded.readQuestionDefinitions(input);
    assert.equal(catalog.digest, input.catalogSHA256);
    assert.deepEqual([...catalog.definitions.keys()], ['scalar', 'choice']);
    for (const definition of catalog.definitions.values()) {
      assert.equal(Object.isFrozen(definition), true);
      assert.equal(Object.isFrozen(definition.criteria), true);
    }
    const scalar = catalog.definitions.get('scalar');
    assert.ok(scalar);
    assert.equal(scalar.instructions, 'Assess the fixed predicate.');
    assert.deepEqual(Object.keys(scalar.criteria), ['true', 'false']);
    const binding = {};
    const firstHandle = {};
    const secondHandle = {};
    const scalarIndex = catalog.byDefinition.get('scalar');
    const choiceIndex = catalog.byDefinition.get('choice');
    assert.ok(scalarIndex);
    assert.ok(choiceIndex);
    assert.notEqual(scalarIndex, choiceIndex);
    assert.equal(scalarIndex.has(binding), false);
    scalarIndex.set(binding, firstHandle);
    choiceIndex.set(binding, secondHandle);
    assert.equal(scalarIndex.get(binding), firstHandle);
    assert.equal(choiceIndex.get(binding), secondHandle);
  } }),
  it({ name: 'rejects changed bytes even when parsed definitions are equivalent', fn: async function rejectUnpinnedBytes() {
    const source = JSON.stringify({ scalar: fixedScalar() });
    assert.throws(function changedSource() {
      loaded.readQuestionDefinitions({ ...catalogInput(source), catalogText: `${source}\n` });
    }, { name: 'QuestionSelectionError', message: 'Question catalog bytes differ from the pinned definitions' });
  } }),
  it({ name: 'retains the original JSON parse failure as its cause', fn: async function parseFailure() {
    assert.throws(function malformedJSON() {
      loaded.readQuestionDefinitions(catalogInput('{'));
    }, function checkParseError(error: unknown) {
      assert.ok(Error.isError(error));
      assert.equal(error.name, 'QuestionSelectionError');
      assert.equal(error.message, 'Question catalog is not valid JSON');
      assert.ok(error.cause instanceof SyntaxError);
      return true;
    });
  } }),
  ...[
    { name: 'non-text catalog', fields: { catalogText: null } },
    { name: 'empty catalog text', fields: { catalogText: '' } },
    { name: 'ill-formed catalog text', fields: { catalogText: '\ud800' } },
    { name: 'oversized UTF-8 catalog', fields: { catalogText: '😀'.repeat(262145) } },
    { name: 'missing resolver', fields: { resolveBinding: null } },
  ].map(function boundaryCase(testCase) {
    return it({ name: `rejects ${testCase.name}`, fn: async function rejectBoundary() {
      assert.throws(function read() {
        loaded.readQuestionDefinitions({ ...catalogInput('{}'), ...testCase.fields });
      }, { name: 'QuestionSelectionError', message: 'Question catalog or owned binding resolver is unavailable' });
    } });
  }),
  ...[null, {}, 'text'].map(function envelopeCase(envelope, index) {
    return it({ name: `rejects unowned envelope ${index}`, fn: async function rejectEnvelope() {
      assert.throws(function read() {
        loaded.readQuestionDefinitions({ ...catalogInput('{}'), envelope });
      }, { name: 'QuestionSelectionError', message: 'Question envelope must be an immutable owned projection' });
    } });
  }),
  ...[
    { name: 'null root', value: null, message: 'Question catalog must be a definition object' },
    { name: 'array root', value: [], message: 'Question catalog must be a definition object' },
    { name: 'empty catalog', value: {}, message: 'Question definition count exceeds the declared profile' },
    { name: 'empty identifier', value: { '': fixedScalar() }, message: 'Question definition is missing its fixed predicate or criteria' },
    { name: 'null definition', value: { scalar: null }, message: 'Question definition is missing its fixed predicate or criteria' },
    { name: 'array definition', value: { scalar: [] }, message: 'Question definition is missing its fixed predicate or criteria' },
    { name: 'unsupported kind', value: { scalar: { ...fixedScalar(), type: 'other' } }, message: 'Question definition is missing its fixed predicate or criteria' },
    { name: 'empty instructions', value: { scalar: { ...fixedScalar(), instructions: '' } }, message: 'Question definition is missing its fixed predicate or criteria' },
    { name: 'non-object criteria', value: { scalar: { ...fixedScalar(), criteria: null } }, message: 'Question definition is missing its fixed predicate or criteria' },
    { name: 'array criteria', value: { scalar: { ...fixedScalar(), criteria: [] } }, message: 'Question definition is missing its fixed predicate or criteria' },
    { name: 'extra field', value: { scalar: { ...fixedScalar(), extra: true } }, message: 'Question definition has undeclared fields' },
    { name: 'empty rubric label', value: { choice: { ...fixedChoice(), criteria: { '': 'positive', no: 'negative' } } }, message: 'Question options require named text rubrics' },
    { name: 'empty rubric text', value: { choice: { ...fixedChoice(), criteria: { yes: '', no: 'negative' } } }, message: 'Question options require named text rubrics' },
    { name: 'non-text rubric', value: { choice: { ...fixedChoice(), criteria: { yes: 1, no: 'negative' } } }, message: 'Question options require named text rubrics' },
    { name: 'foreign scalar option', value: { scalar: { ...fixedScalar(), criteria: { true: 'positive', other: 'negative' } } }, message: 'Scalar definition requires exactly true and false criteria' },
    { name: 'single choice option', value: { choice: { ...fixedChoice(), criteria: { yes: 'positive' } } }, message: 'Choice definition requires two through 255 options' },
  ].map(function catalogCase(testCase) {
    return it({ name: `rejects ${testCase.name}`, fn: async function rejectCatalog() {
      assert.throws(function read() {
        readCatalog(testCase.value);
      }, { name: 'QuestionSelectionError', message: testCase.message });
    } });
  }),
  it({ name: 'admits the maximum definition count and rejects the next entry', fn: async function definitionCount() {
    const definitions = Object.fromEntries(Array.from({ length: 512 }, function define(_unused, index) {
      return [`definition${index}`, fixedScalar()];
    }));
    assert.equal(readCatalog(definitions).definitions.size, 512);
    assert.throws(function oneMore() {
      readCatalog({ ...definitions, extra: fixedScalar() });
    }, { name: 'QuestionSelectionError', message: 'Question definition count exceeds the declared profile' });
  } }),
  it({ name: 'admits the maximum choice membership and rejects the next option', fn: async function optionCount() {
    const criteria = Object.fromEntries(Array.from({ length: 255 }, function option(_unused, index) {
      return [`option${index}`, 'Fixed rubric.'];
    }));
    assert.equal(readCatalog({ choice: { ...fixedChoice(), criteria } }).definitions.size, 1);
    assert.throws(function oneMore() {
      readCatalog({ choice: { ...fixedChoice(), criteria: { ...criteria, extra: 'Additional rubric.' } } });
    }, { name: 'QuestionSelectionError', message: 'Choice definition requires two through 255 options' });
  } }),
] });
//endregion
