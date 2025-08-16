# Testing & Vitest Troubleshooting

## Vitest UI port binding fails on Windows

When running `pnpm exec vitest --ui`, you may encounter permission denied errors:

```
Error: listen EACCES: permission denied 127.0.0.1:3000
Error: listen EACCES: permission denied ::1:51204
```

### Root cause
Windows restricts port binding to certain address ranges, particularly:
- IPv6 loopback (`::1`) binding is often blocked
- Localhost (`127.0.0.1`) binding may be restricted for certain port ranges
- Ports in the 49152-65535 range are commonly restricted

### Solution
Use `0.0.0.0` (all network interfaces) instead of localhost:

```bash
# Working command
pnpm exec vitest --ui --api.host 0.0.0.0 --api.port 3000

# Or with other common development ports
pnpm exec vitest --ui --api.host 0.0.0.0 --api.port 8080
pnpm exec vitest --ui --api.host 0.0.0.0 --api.port 5173
```

### Permanent configuration
Add to your [`vitest.config.ts`](vitest.config.ts:1):

```typescript
export default defineConfig({
  test: {
    // ... existing configuration
    api: {
      port: 3000,
      host: '0.0.0.0'
    }
  }
})
```

Then run: `vitest --ui`

### Security note
Binding to `0.0.0.0` makes the Vitest UI accessible from other devices on your network at `http://[your-ip]:3000`. This is typically fine for development but be aware of network accessibility.

### Command flags clarification
- Use `--api.host` and `--api.port` for Vitest UI server configuration
- **Not** `--host` and `--port` (those are for different Vite functionality)

## Vitest: missing assertions or console output with duplicate describe blocks

Symptoms:
- Reporter output omits some `expect(...)` failures.
- Reporter output omits or misattributes `console.log` messages.
- Test counts in the reporter are lower than the number of tests defined in the file.
- Running a single file shows fewer suites than expected.

Root cause:
- Duplicate `describe` blocks with the same title at the same lexical scope cause suite merging in the reporter.
- Merged suites collapse logs and results from earlier suites into the last suite with the same title.
- Duplicate test titles under the same suite increase ambiguity and hide earlier failures.
- The effect is local to a file where the duplicates exist.

Reproduction:
```ts
// example.duplicate-describe.unit.test.ts
import { describe, test, expect } from 'vitest';

describe('suite', () => {
  test('first', () => {
    // eslint-disable-next-line no-console -- demonstration
    console.log('from first suite');
    expect(1).toBe(2);
  });
});

describe('suite', () => {
  test('second', () => {
    // eslint-disable-next-line no-console -- demonstration
    console.log('from second suite');
    expect(1).toBe(1);
  });
});
```
- The reporter may omit the failure from the first `suite` and show only the second `suite`.
- Console output from the first `suite` can be missing or attributed to the second `suite`.

Impact:
- CI logs become misleading and hide actual failures.
- Local debugging becomes unreliable when logs or failures do not appear.
- Coverage metrics remain unaffected, which can mask the underlying problem.

Detection:
- List `describe` occurrences and scan for duplicate titles at the same scope.
  ```bash
  rg -n "^[[:space:]]*describe\\(" -t ts
  ```
- Focus on files with multiple top-level `describe` entries using the same string title.
- Verify suspicious files by running them directly with the unit config.
  ```bash
  moon run testUnit -- packages/module/es/src/function.tryCatch.unit.test.ts
  ```
- Increase verbosity if output looks incorrect.
  ```bash
  moon run testUnit -- --reporter verbose
  ```
- Temporarily isolate a test to confirm output.
  ```ts
  test.only('case under investigation', () => { /* ... */ });
  ```

Remediation:
- Use a single top-level `describe` per subject (API, function, or feature) within a file.
- Use nested `describe` groups under the top-level suite to partition contexts.
- Ensure `describe` titles are unique at the same scope inside a file.
- Ensure test titles are unique and context-aware to avoid ambiguity.
- Prefer hierarchical grouping over multiple duplicate suites at the same level.

Reference implementation:
- The `tryCatch` tests use a single top-level suite per API and mirror structure for sync and async contexts.
- Sync and async sections group cases into:
  - Success and retry behaviour.
  - Null suppression behaviour.
  - Tuple control behaviour.
  - Logging integration.
  - Validation and type checking.

Template for hierarchical grouping:
```ts
import { describe, test, expect } from 'vitest';

describe('subject-under-test', () => {
  describe('success and retry behaviour', () => {
    test('returns result on success', () => { /* ... */ });
    test('retries on true decision', () => { /* ... */ });
  });

  describe('null suppression behaviour', () => {
    test('returns undefined on null decision', () => { /* ... */ });
  });

  describe('tuple control behaviour', () => {
    test('tuple true retries with updated context', () => { /* ... */ });
    test('tuple false rethrows with serialized message', () => { /* ... */ });
  });

  describe('logging integration', () => {
    test('logs suppression with context', () => { /* ... */ });
  });

  describe('validation and type checking', () => {
    test('invalid decision type throws TypeError', () => { /* ... */ });
  });
});
```

Best practices:
- Keep one top-level `describe` per subject in a file.
- Mirror structure between sync and async suites for quick visual diffing.
- Keep suite titles unique and descriptive at their scope.
- Keep test titles explicit about context to avoid collision and ambiguity.
- Use region markers to maintain navigability in long files:
  ```ts
  //region Success and retry behaviour -- Direct success paths and retry control
  //endregion Success and retry behaviour
  ```

Recommended commands (Moon):
- Run a single test file with unit configuration.
  ```bash
  moon run testUnit -- packages/module/es/src/function.tryCatch.unit.test.ts
  ```
- Increase verbosity for investigation.
  ```bash
  moon run testUnit -- --reporter verbose
  ```
- Build and test together to avoid stale artifacts.
  ```bash
  moon run buildAndTest
  ```
- Clear Moon cache if results appear stale.
  ```bash
  moon clean --lifetime '1 seconds'
  ```

Rationale for the current structure:
- Unique suite hierarchy prevents reporter merging and preserves all logs and failures.
- Mirrored grouping for sync and async APIs makes failures easy to locate and compare.
- Region markers help maintainers extend tests without reintroducing duplicate suite titles.

## Vitest `Failed to resolve dependency: vitest > strip-literal, present in client 'optimizeDeps.include'`

`pnpm-workspace.yaml`

```yaml
packageExtensions:
  vitest:
    dependencies:
      'strip-literal': '>=3.0.0'
```

## Vitest and Vite type incompatible

Use one version of vite:
```yaml name=pnpm-workspace.yaml
catalog:
  "vite": "catalog:"
overrides:
  vite: 'catalog:'