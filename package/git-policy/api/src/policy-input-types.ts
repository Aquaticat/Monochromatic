/**
 Public declarations of what a policy reads outside its `PolicyContext`.

 After a replayed commit,
 cli-git re-runs a policy that declares inputs only when one of its recorded context reads
 or one of these declared inputs changed;
 an unrestricted policy always re-runs.

 @module
 */

/**
 One input a policy reads outside its context, which cli-git fingerprints.

 @example
 ```ts
 const rules: PolicyInput = { kind: 'worktree', pathspecs: ['forbidden-strings.local.txt'] };
 ```
 */
export type PolicyInput =
  | Readonly<{
    /**
     Worktree files matched by Git pathspecs from the worktree root, ignored files included.
     */
    kind: 'worktree';
    /**
     Non-empty Git pathspecs.
     */
    pathspecs: readonly string[];
  }>
  | Readonly<{
    /**
     An executable the policy starts.
     */
    kind: 'executable';
    /**
     Path relative to the worktree root, absolute path, or `PATH`-resolved name.
     */
    path: string;
  }>
  | Readonly<{
    /**
     A Git revision resolved against the commit's parent.
     */
    kind: 'revision';
    /**
     Revision expression, such as `HEAD` or `refs/remotes/origin/main`.
     */
    rev: string;
  }>
  | Readonly<{
    /**
     An environment variable.
     */
    kind: 'env';
    /**
     Variable name.
     */
    name: string;
  }>;

/**
 Everything a policy reads outside its context:
 `'unrestricted'` when unknown,
 or the complete external list,
 empty for a policy that reads only through its context.

 @example
 ```ts
 const contextOnly: PolicyInputs = { external: [] };
 ```
 */
export type PolicyInputs =
  | 'unrestricted'
  | Readonly<{
    /**
     Complete external inputs.
     */
    external: readonly PolicyInput[];
  }>;

/**
 Static inputs,
 or a function computing them from the validated policy options,
 so an option such as a configured executable can name its input.

 @example
 ```ts
 const inputs: PolicyInputsDeclaration<{ executable: string }> = function inputs(options) {
   return { external: [{ kind: 'executable', path: options.executable }] };
 };
 ```
 */
export type PolicyInputsDeclaration<TOptions> =
  | PolicyInputs
  | ((options: Readonly<TOptions>) => PolicyInputs);
