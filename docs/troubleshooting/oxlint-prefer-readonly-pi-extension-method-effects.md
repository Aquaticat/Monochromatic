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
declares the registration and append members with method syntax:

```ts
on(event: "before_agent_start", handler: ExtensionHandler<BeforeAgentStartEvent, BeforeAgentStartEventResult>): void;

registerTool<TParams extends TSchema = TSchema, TDetails = unknown, TState = any>(
  tool: ToolDefinition<TParams, TDetails, TState>,
): void;

appendEntry<T = unknown>(customType: string, data?: T): void;
```

No assignment such as `pi.on = value` or `pi.registerTool = value` is needed for these calls to change state.
Assignment would replace a property on the API object.
Calling a method can instead change data held behind the API capability.

## What the installed implementation changes

The installed extension loader at
`node_modules/.pnpm/@earendil-works+pi-coding-agent@0.80.6/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js`
implements `on` by appending the handler to `extension.handlers`:

```js
on(event, handler) {
  runtime.assertActive();
  const list = extension.handlers.get(event) ?? [];
  list.push(handler);
  extension.handlers.set(event, list);
}
```

The same loader implements `registerTool` by updating `extension.tools` and refreshing the tool registry:

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

These methods therefore change state observable through Pi even though the local `pi` binding is never reassigned.

## Resolution

`packages/oxlint-plugins/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/pi-package-effect-catalog.ts`
now records exact receiver effects for:

- package `@earendil-works/pi-coding-agent`;
- package major `0`;
- owner type `ExtensionAPI`;
- mutating members `appendEntry`,
  `on`,
  `registerTool`,
  and `setThinkingLevel`;
- observational member `getThinkingLevel`,
  with no mutation targets.

`packages/pi-plugins/auto-mode/src/register-propose-trust.ts` documents the known state changes with:

```ts
@mutates pi - `pi.registerTool` changes registered tools; deferred `pi.appendEntry` calls append accepted trust state.
```

`packages/pi-plugins/current-time-context/src/index.ts` documents its registration effect with:

```ts
@mutates pi - `pi.on` stores the `before_agent_start` event registration in the Pi host
```

`packages/pi-plugins/thinking-defaults/src/index.ts` documents registration and active-level updates,
without inventing a mutation effect for `getThinkingLevel`:

```ts
@mutates pi - `pi.on` registers lifecycle handlers and `pi.setThinkingLevel` changes active host state
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
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:lint:types
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:lint:oxlint
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:build:js:node
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:test:unit
mise run //packages/pi-plugins/current-time-context:lint:oxlint
mise run //packages/pi-plugins/current-time-context:test:unit
mise run //packages/pi-plugins/current-time-context:verify:extension
```

The intrinsic test resolves `appendEntry` and `registerTool` through real Pi declaration provenance,
then verifies the exact `on` catalogue entry.
Package-local Oxlint runs accept the documented effects in both auto-mode and current-time-context sources.
