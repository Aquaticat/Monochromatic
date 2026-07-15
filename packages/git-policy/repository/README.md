# Repository Git policies

Repository-owned cli-git policies live in this private package rather than cli-git core.
Consumers choose the effective namespace when registering `repositoryPolicyPlugin` in trusted configuration.

## Forbidden root context

`forbiddenRootContext` rejects a non-deleted root `CONTEXT.md` candidate during pre-forward add/commit checks and direct
checks.
A nested path such as `docs/CONTEXT.md` does not match.
The policy defaults to error and is warning-safe.

```ts
// cli-git.config.ts
import { defineConfig, } from '@monochromatic-dev/git-policy-cli/ts';
import { repositoryPolicyPlugin, } from '@monochromatic-dev/git-policy-repository/ts';

export default defineConfig({
  plugins: {
    mono: repositoryPolicyPlugin,
  },
  policies: {
    'mono/forbidden-root-context': 'error',
  },
});
```

The package is private and is not published independently.
