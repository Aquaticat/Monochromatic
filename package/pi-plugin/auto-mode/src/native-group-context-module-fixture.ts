/** Load genuine built group state through an independent consumer contract. @module */
import type { PreparationFixtureRecord } from './native-preparation-module-fixture.ts';

//region Consumers use the emitted factory without importing its source type graph.
/** Group preparation publishes records without approving execution. */
type GroupContext = Readonly<{
  bindings: WeakMap<object, PreparationFixtureRecord>;
  byMember: Map<string, object>;
  prepare: (members: unknown) => void;
  preparedJSON: (members: unknown) => string;
}>;
/** The factory owns records; fixture inputs supply ordinary callbacks and native-shaped data. */
type GroupModule = Readonly<{
  createPreparedGroupContext: (input: Readonly<Record<string, unknown>>) => GroupContext;
}>;
/** Require the actual emitted constructor before fixtures create group state. */
function assertGroupModule(value: unknown): asserts value is GroupModule {
  if (value === null || typeof value !== 'object' || !('createPreparedGroupContext' in value)
    || typeof value.createPreparedGroupContext !== 'function')
    throw new Error('Built native group constructor is unavailable');
}
/** Dynamic loading keeps artifact implementations outside the source test project's file list. */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/integration/native-batch/prepared-group-context.ts', import.meta.url,
).href);
assertGroupModule(loaded);
/** Tests instantiate the real constructor instead of making owned records themselves. */
export const groupContextModule: GroupModule = loaded;
//endregion
