/**
 Verify native construction custody and retryable cleanup through the emitted artifact.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { assertScopeModule, createScopeFixture } from './native-factory-scopes-fixture.ts';

/** Consumers execute the emitted native owner, including its lexical disposal implementation. */
const built: unknown = await import(new URL(
  '../dist/native/contract/lifecycle/runtime-factory-scopes/scopes.ts', import.meta.url,
).href);
assertScopeModule(built);

//region Original input capture and publication identity remain distinct from caller containers

await describe({ name: '', children: [
  it({ name: 'retains original callbacks and manager after caller container replacement', fn: async function originalCapture() {
    /** Every capability in this fixture belongs only to this test. */
    const fixture = createScopeFixture();
    /** Capture original callbacks before replacing their caller-owned properties. */
    const scopes = built.createRuntimeFactoryScopes(fixture.definition);
    /** Input mutation must not change the original manager occurrence. */
    const input = { manager: fixture.manager };
    /** One registered session remains paired with the original manager. */
    const session = { manager: fixture.manager };
    /** Begin captures the original manager before the caller replaces its property. */
    const scope = scopes.begin(input);
    input.manager = {};
    fixture.definition.readManager = function replacementReader() { throw new Error('Caller replacement reader ran'); };
    fixture.definition.prepareResult = function replacementPreparer() { throw new Error('Caller replacement preparer ran'); };
    scope.registerSession(session);
    /** Publication requires the exact newly prepared result, not an equal copy. */
    const prepared = scope.accept({ session });
    expect(function copiedPublication() { scope.publish({ ...prepared }); }).toThrow('exact prepared result');
    scope.publish(prepared);
    expect(fixture.events).toEqual(['begin', 'bind', 'publish']);
    expect(function publishedAbort() { scope.abort(); }).toThrow('cannot be abandoned');
    expect(function publishedRegistration() { scope.registerSession(session); }).toThrow('no longer preparing');
  } }),
  it({ name: 'rejects session substitution, duplicate registration, and manager replacement', fn: async function identityChecks() {
    /** Original manager and session identities are independent test objects. */
    const fixture = createScopeFixture();
    /** This owner authenticates only the callback-selected original manager. */
    const scopes = built.createRuntimeFactoryScopes(fixture.definition);
    /** Registration precedes result acceptance. */
    const scope = scopes.begin({ manager: fixture.manager });
    /** The original result session remains mutable to simulate native manager replacement. */
    const session = { manager: fixture.manager };
    expect(function unregisteredResult() { scope.accept({ session }); }).toThrow('exact session registered');
    scope.registerSession(session);
    expect(function duplicateRegistration() { scope.registerSession(session); }).toThrow('already registered');
    expect(function foreignResult() { scope.accept({ session: { manager: fixture.manager } }); }).toThrow('exact session registered');
    session.manager = {};
    expect(function foreignManager() { scope.accept({ session }); }).toThrow('another manager');
    session.manager = fixture.manager;
    /** Acceptance stores an exact result for the subsequent manager-change check. */
    const prepared = scope.accept({ session });
    expect(function duplicateAcceptance() { scope.accept({ session }); }).toThrow('already accepted');
    session.manager = {};
    expect(function changedManager() { scope.publish(prepared); }).toThrow('changed its manager');
    session.manager = fixture.manager;
    scope.abort();
    expect(fixture.control.disposeCalls).toBe(1);
  } }),

  //endregion Original input capture and publication identity remain distinct from caller containers

  //region Failed native effects remain retryable while callbacks cannot reenter the factory

  it({ name: 'retains failed cleanup, aggregates retry failure, and disposes only once after success', fn: async function cleanupRetry() {
    /** Disposal failure remains local and repeatable without touching actual sessions. */
    const fixture = createScopeFixture();
    /** The owner retains the failed occurrence between separate retry calls. */
    const scopes = built.createRuntimeFactoryScopes(fixture.definition);
    /** Cleanup owes the original registered session even if no result was accepted. */
    const scope = scopes.begin({ manager: fixture.manager });
    scope.registerSession({ manager: fixture.manager });
    fixture.control.failDisposal = true;
    expect(function failedAbort() { scope.abort(); }).toThrow('Fixture native disposal failed');
    expect(scopes.diagnostics().pendingCleanup).toBe(1);
    expect(function blockedConstruction() { scopes.begin({ manager: fixture.manager }); }).toThrow('cleanup is pending');
    expect(function failedRetry() { scopes.retryCleanup(); }).toThrow(AggregateError);
    expect(fixture.control.disposeCalls).toBe(2);
    fixture.control.failDisposal = false;
    scopes.retryCleanup();
    scope.abort();
    expect(fixture.control.disposeCalls).toBe(3);
    expect(scopes.diagnostics().pendingCleanup).toBe(0);
    /** An unregistered construction has no native session to dispose. */
    const empty = scopes.begin({ manager: fixture.manager });
    empty.abort();
    expect(fixture.control.disposeCalls).toBe(3);
  } }),
  it({ name: 'rejects synchronous reentry and releases exclusion after the thrown callback', fn: async function reentryRecovery() {
    /** The native reader can attempt a callback into the same factory. */
    const fixture = createScopeFixture();
    /** Exclusion must cover every scope issued by the original factory. */
    const scopes = built.createRuntimeFactoryScopes(fixture.definition);
    /** The original session still becomes publishable after the failed callback. */
    const session = { manager: fixture.manager };
    /** Reentry occurs during acceptance, after successful registration. */
    const scope = scopes.begin({ manager: fixture.manager });
    scope.registerSession(session);
    fixture.control.beforeRead = function reenterFactory() { scopes.begin({ manager: fixture.manager }); };
    expect(function reentrantAcceptance() { scope.accept({ session }); }).toThrow('cannot reenter');
    fixture.control.beforeRead = undefined;
    scope.publish(scope.accept({ session }));
    expect(fixture.events).toEqual(['begin', 'bind', 'publish']);
  } }),

  //endregion Failed native effects remain retryable while callbacks cannot reenter the factory
] });
