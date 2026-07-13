# Pi extension methods change host state without assigning the API input

## Symptom

The project readonly rule originally reported this uncertainty:

```text
The function input named "pi" is used by these calls: pi.appendEntry, pi.registerTool.
```

That message did not say these expressions are method calls.
It also did not explain that a method can change state without assigning a new value to `pi`.

## What the installed API declares

The installed Pi `0.80.6` declaration at
`node_modules/.pnpm/@earendil-works+pi-coding-agent@0.80.6/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
declares both members with method syntax:

```ts
registerTool<TParams extends TSchema = TSchema, TDetails = unknown, TState = any>(
  tool: ToolDefinition<TParams, TDetails, TState>,
): void;

appendEntry<T = unknown>(customType: string, data?: T): void;
```

No assignment such as `pi.registerTool = value` is needed for either call to change state.
Assignment would replace a property on the API object.
Calling a method can instead change data held behind the API capability.

## What the installed implementation changes

The installed extension loader at
`node_modules/.pnpm/@earendil-works+pi-coding-agent@0.80.6/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js`
implements `registerTool` by updating `extension.tools` and refreshing the tool registry:

```js
registerTool(tool) {
  runtime.assertActive();
  extension.tools.set(tool.name, {
    definition: tool,
    sourceInfo: extension.sourceInfo,
  });
  runtime.refreshTools();
}
```

The same loader delegates `appendEntry` to the active runtime.
The installed agent session at
`node_modules/.pnpm/@earendil-works+pi-coding-agent@0.80.6/node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js`
appends a custom session entry and emits an `entry_appended` event:

```js
appendEntry: (customType, data) => {
  const entryId = this.sessionManager.appendCustomEntry(customType, data);
  const entry = this.sessionManager.getEntry(entryId);
  if (entry) {
    this._emit({ type: "entry_appended", entry });
  }
}
```

Both methods therefore change state observable through Pi even though the local `pi` binding is never reassigned.

## Resolution

`packages/oxlint-plugins/no-restricted-syntax/src/rules/prefer-readonly-parameter-types/pi-package-effect-catalog.ts`
now records exact receiver effects for:

- package `@earendil-works/pi-coding-agent`;
- package major `0`;
- owner type `ExtensionAPI`;
- members `appendEntry` and `registerTool`.

`packages/pi-plugins/auto-mode/src/register-propose-trust.ts` documents the known state changes with:

```ts
@mutates pi - `pi.registerTool` changes registered tools; deferred `pi.appendEntry` calls append accepted trust state.
```

Unknown method calls now receive a method-specific diagnostic.
It states that methods can change data in their object or controlled system without assigning to the input.
The diagnostic lists every supported remediation:

1. remove or rewrite the call;
2. include repository source in the nearest TypeScript project;
3. audit the exact external call and add a tested catalogue entry;
4. document every possibly changed input with `@mutates` in the current or a dedicated function.

## Verification

The following checks passed:

```text
mise run //packages/oxlint-plugins/no-restricted-syntax:lint:types
mise run //packages/oxlint-plugins/no-restricted-syntax:lint:oxlint
mise run //packages/oxlint-plugins/no-restricted-syntax:test:unit -- src/intrinsic-effect-catalog.unit.test.ts src/oxlint-no-restricted-syntax.unit.test.ts
```

The intrinsic test resolves both calls through the real Pi declaration provenance and verifies matching audited entries.
A package-local auto-mode Oxlint run no longer reports the old `pi.appendEntry, pi.registerTool` uncertainty at
`register-propose-trust.ts`.
