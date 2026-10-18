# Node VM evaluations retain bindings when the context object is reused

## Symptom

Node `26.12.0` emitted this diagnostic during a local CI source-control preflight:

```text
SyntaxError: Identifier 'changedSource' has already been declared
```

The first `runInNewContext` call succeeded.
The second evaluated the same `const` declaration with the same context object.
The failure preceded admission-file creation and cloud dispatch.
It is separate from duplicate imports assembled into one Mise task body,
documented in [the inline-import incident](mise-inline-task-import-collision.md).

## Deciding source

In Node tag `v26.12.0`,
`lib/vm.js:305` passes the supplied object through `createContext`.
At `lib/vm.js:226`,
`createContext` returns an already contextified object unchanged.
The supplied object can therefore retain the earlier evaluation's lexical bindings.
The function name does not guarantee a fresh context when its object argument is reused.

The inspected Git blob is `2c7446af607637bc002d20099a929cc737c7c1be`;
the full source SHA256 is `774a31123f8ca83e7bc1d3966d1e738d9034ec2b3f8e98791fa5d40d058a9cdf`.
The [versioned implementation](https://github.com/nodejs/node/blob/v26.12.0/lib/vm.js)
is the primary source for this boundary.

## Verified remedy and controls

Pass a fresh context object for each evaluation that should have independent lexical bindings.
The affected preflight now uses a fresh shallow copy of its explicit scope for each call.
That copy separates the VM context;
it does not deep-clone values inside the scope or establish a security boundary.

An actual Node `26.12.0` control evaluated `const selected = 1` in a shared object,
then rejected `const selected = 2` with the same duplicate-binding diagnostic.
`isContext` confirmed that shared object was contextified.
The same declarations both passed when supplied separate fresh objects.
The restored CI preflight then completed unchanged-source,
changed-object,
removed-guard and restored-source measurements before dispatch.

The private controller retained the fetched implementation,
source hash,
exact diagnostic and control outcomes in `node-vm-context-source.json` on 2026-10-18.
