# `ignore` 7.0.6 matcher calls mutate caches and trigger unresolved readonly effects

## Symptom

A TypeScript caller that receives an `Ignore` matcher and calls `test` saw this diagnostic:

```text
The function input named "matcher" is used as the object for these method calls: matcher.ignore.test.
```

The same rule also failed closed for `matcher.add`.
Treating `test` as an observational zero-effect method would hide receiver mutation.

## Root cause

The `ignore` 7.0.6 tag is commit `3823b5f14bb16b358397c94172bd5741dd2d7bec`.
Its `index.js:616` to `621` creates two mutable result caches:

```js
_initCache () {
  // A cache for the result of `.ignores()`
  this._ignoreCache = Object.create(null)

  // A cache for the result of `.test()`
  this._testCache = Object.create(null)
}
```

`index.js:624` to `630` adds rules and resets both caches when matcher behavior changes:

```js
add (pattern) {
  if (this._rules.add(pattern)) {
    this._initCache()
  }

  return this
}
```

`index.js:694` to `722` reads and populates the selected cache recursively:

```js
if (path in cache) {
  return cache[path]
}
...
return cache[path] = parent.ignored
  ? parent
  : this._rules.test(path, checkUnignored, MODE_IGNORE)
```

`index.js:728` to `730` passes `_ignoreCache` into the same mutating path:

```js
ignores (path) {
  return this._test(path, this._ignoreCache, false).ignored
}
```

Finally,
`index.js:741` to `743` passes the receiver's `_testCache` into that mutating path:

```js
test (path) {
  return this._test(path, this._testCache, true)
}
```

Therefore `add`,
`ignores`,
and `test` have proven receiver effects.
The mutation is internal cache or rule state rather than mutation of the path string argument.

## Verification

The verified package is `ignore` 7.0.6 at tag and commit
`3823b5f14bb16b358397c94172bd5741dd2d7bec`.
The installed package and tagged upstream source contain the same implementation.

Run this probe from the repository root:

```sh
node --input-type=module -e "import ignore from './node_modules/.pnpm/ignore@7.0.6/node_modules/ignore/index.js'; const matcher=ignore({ignorecase:false}); console.log(JSON.stringify({rulesBefore:matcher._rules._rules.length,testCacheBefore:Object.keys(matcher._testCache)})); matcher.add('dist/'); console.log(JSON.stringify({rulesAfter:matcher._rules._rules.length,testCacheAfterAdd:Object.keys(matcher._testCache)})); const result=matcher.test('dist/file.js'); console.log(JSON.stringify({result,testCacheAfterTest:Object.keys(matcher._testCache)}));"
```

Observed output:

```text
{"rulesBefore":0,"testCacheBefore":[]}
{"rulesAfter":1,"testCacheAfterAdd":[]}
{"result":{"ignored":true,"unignored":false,"rule":{"pattern":"dist/","negative":false}},"testCacheAfterTest":["dist/","dist/file.js"]}
```

### Patterns that work

- Catalog `Ignore.add` as a receiver effect.
- Catalog `Ignore.ignores` and `Ignore.test` as receiver effects.
- Keep path strings outside the mutation target because they cannot carry caller-owned object state.

### Patterns that fail closed

- An unsupported `Ignore` method remains unresolved.
- A different package or major version cannot match the `7.x` entries.
- A same-named `test` method on another owner
  cannot match `Ignore.test`.

## Verified workarounds

Use exact package,
major,
owner,
and member entries:

```ts
{
  provenance: { kind: 'package', packageName: 'ignore', major: 7 },
  ownerType: 'Ignore',
  member: 'test',
  targets: [{ kind: 'receiver' }],
  evidence: 'ignore 7.0.6 shipped implementation updates matcher result caches',
}
```

Apply the same receiver target to `add` and `ignores`.
This preserves matcher caching and exposes its real state transition.
The tradeoff is maintaining an audited catalog entry when the installed package major changes.

A local `@mutates matcher` contract also fails closed safely.
Its tradeoff is repeating package implementation knowledge at every call site.

## What does not work

- An empty target list for `test` is incorrect because `_testCache` is populated.
- A path-argument target is incorrect because the implementation treats the path as string data.
- A readonly projection of `Ignore` is dishonest because its callable methods retain mutable receiver state.
- Disabling the readonly rule discards both exact provenance and stale-contract checking.

## Upstream filing artifact

### Upstream filing decision

1.  **Is it really upstream's fault?
    ** No.
    Caching and rule installation are intentional matcher behavior.
2.  **Can upstream fix it?
    ** No defect needs an upstream fix.
    Removing caching would change performance behavior
    without improving the public contract.
3.  **Are they supporting this use case?
    ** Yes.
    The README documents matcher construction and path testing.
4.  **Would the repo welcome our contribution?
    ** No contribution is needed.
    The repository has a README
    and no `CONTRIBUTING.md` or repository-local issue template prohibiting reports.
5.  **Will they likely fix it?
    ** Not applicable because the observed mutation is expected behavior.
6.  **Have we prototyped a minimal fix compatible with their architecture?
    ** Yes.
    The consumer-side exact effect entries preserve upstream behavior
    and pass semantic catalog tests.

No matching `.out-of-scope/` exemption applies.
Open and closed issue and pull-request searches for `test cache mutation` found no duplicate.
There is no upstream issue or comment to file because no upstream defect exists.
