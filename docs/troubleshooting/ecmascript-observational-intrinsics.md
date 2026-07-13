# ECMA-262 2026 object observation calls can hide user-code effects from readonly analysis

## Symptom

`no-restricted-syntax/prefer-readonly-parameter-types` reports `opaqueEffect` when a parameter crosses an
uncatalogued ECMAScript call.
Blanket treatment of serialization and reflection as observational would remove useful diagnostics but would be
unsound.

The audited outcomes are:

- `Array.isArray(value)` and `Object.is(left, right)` are observational;
- primitive String transforms and searches are observational for typed primitive inputs and outputs;
- Array identity searches,
  array and collection iterators,
  collection lookups,
  and collection `has` checks are observational;
- Array callback methods expose receiver-reachable values to callbacks,
  so callback effects propagate back to receiver origin;
- `Array.prototype.join` is observational only when every reachable element is primitive;
- `Error.isError(value)` is observational;
- `JSON.stringify(value)` remains opaque because it can invoke `toJSON`,
   accessors,
   proxy behavior,
   and a replacer;
- integrity and property reflection calls remain opaque when their abstract operations can dispatch proxy traps.

## Root cause

ECMA-262 commit `1355a23e48aaf2b1d7b6cbfad0fb98bce999cfd1` defines `Array.isArray` as only an `IsArray` call in
`spec.html:40633`:

```html
<emu-clause id="sec-array.isarray" type="built-in function">
  <emu-alg>
    1. Return ? IsArray(_arg_).
  </emu-alg>
</emu-clause>
```

`IsArray` inspects internal identity and recursively unwraps proxies without invoking a proxy handler
(`spec.html:5798`):

```html
1. If _arg_ is not an Object, return *false*.
1. If _arg_ is an Array exotic object, return *true*.
1. If _arg_ is a Proxy exotic object, then
  1. Perform ? ValidateNonRevokedProxy(_arg_).
  1. Let _proxyTarget_ be _arg_.[[ProxyTarget]].
  1. Return ? IsArray(_proxyTarget_).
1. Return *false*.
```

Array and collection callback operations do not mutate their receiver directly,
but they call user code with receiver-reachable values.
The catalog therefore records callback argument positions separately from direct mutation targets.
A zero-target callback operation is not complete until call analysis propagates callback mutation and opacity.

`Object.is` delegates only to `SameValue` (`spec.html:31394`):

```html
<emu-clause id="sec-object.is" type="built-in function">
  <emu-alg>
    1. Return SameValue(_value1_, _value2_).
  </emu-alg>
</emu-clause>
```

`JSON.stringify` is different.
 Its `SerializeJSONProperty` operation reads `toJSON` and calls it when callable
(`spec.html:48387`):

```html
1. Let _value_ be ? Get(_holder_, _key_).
1. If _value_ is an Object or _value_ is a BigInt, then
  1. Let _toJSON_ be ? GetV(_value_, *"toJSON"*).
  1. If IsCallable(_toJSON_) is *true*, then
    1. Set _value_ to ? Call(_toJSON_, _value_, « _key_ »).
1. If _state_.[[ReplacerFunction]] is not *undefined*, then
  1. Set _value_ to ? Call(_state_.[[ReplacerFunction]], _holder_, « _key_, _value_ »).
```

The earlier idea that serialization and reflection calls could share one observational catalog class was wrong.
The algorithms differ at the exact user-code dispatch boundary,
 so each callable requires its own audit.

## Verification

The source under test is TC39 ECMA-262 commit
`1355a23e48aaf2b1d7b6cbfad0fb98bce999cfd1`,
 cloned on 2026-07-13.
Node.
js `v26.5.0` produced the recorded runtime result:

```js
let traps = 0;
const target = [];
const proxy = new Proxy(target, {
  get(value, key, receiver) {
    traps += 1;
    return Reflect.get(value, key, receiver);
  },
  ownKeys(value) {
    traps += 1;
    return Reflect.ownKeys(value);
  },
  getOwnPropertyDescriptor(value, key) {
    traps += 1;
    return Reflect.getOwnPropertyDescriptor(value, key);
  },
});

console.log(JSON.stringify({
  isArray: Array.isArray(proxy),
  same: Object.is(proxy, proxy),
  traps,
}));
JSON.stringify(proxy);
console.log(JSON.stringify({ trapsAfterStringify: traps }));

const state = {
  value: 0,
  toJSON() {
    this.value += 1;
    return { value: this.value };
  },
};
console.log(JSON.stringify({ json: JSON.stringify(state), valueAfter: state.value }));
```

```text
{"isArray":true,"same":true,"traps":0}
{"trapsAfterStringify":2}
{"json":"{\"value\":1}","valueAfter":1}
```

### Calls verified as observational

- `Array.isArray(proxy)` did not invoke configured proxy traps.
- `Object.is(proxy, proxy)` did not invoke configured proxy traps.
- Exact standard-library String transforms and searches return primitives without mutating their string receiver.
- Exact Array `includes`,
  `indexOf`,
  and `lastIndexOf` calls compare identity without mutating receiver.
- Exact Array `at`,
  `entries`,
  `keys`,
  `slice`,
  and `values` calls observe receiver without invoking user callbacks.
- Exact Array `every`,
  `filter`,
  `find`,
  `findIndex`,
  `flatMap`,
  `forEach`,
  `map`,
  and `some` calls propagate callback effects from receiver-reachable element and collection arguments.
- Exact Map,
  Set,
  WeakMap,
  and WeakSet `has` calls test identity without mutating receiver.
- Exact Map and Set iterator calls observe collection without invoking user callbacks.
- Exact collection `forEach` calls propagate callback effects from receiver-reachable keys,
  values,
  and collection arguments.
- Exact Map `get` observes stored identity without mutating receiver.
- Exact Array `join` observes primitive elements,
  while object-element coercion remains opaque.
- Exact `Error.isError` inspects error identity without mutating its argument.

### Calls verified as effectful or opaque

- `JSON.stringify(proxy)` invoked proxy behavior.
- `JSON.stringify(state)` invoked authored `toJSON` and mutated `state.value`.
- `JSON.stringify(value, replacer)` has an additional explicit callback path in `spec.html:48392`.

## Verified workarounds

The rule catalog records exact standard-library owner and member identities with empty mutation targets.
This covers `ArrayConstructor.isArray`,
`ObjectConstructor.is`,
primitive String methods with primitive-only typed inputs and outputs,
Array identity searches and iterators,
collection membership and iterator operations,
callback operations with explicit callback relations,
primitive-element Array `join`,
and `ErrorConstructor.isError`.
Exact declaration provenance prevents same-named project methods from inheriting this treatment.

For `JSON.stringify`,
 use a verified local adapter whose `@mutates` contract names `JSON.stringify` as its upstream
boundary and lists every parameter whose hooks can run.
 This is conservative:
 callers must acknowledge possible
mutation even when current runtime values happen to be plain data.

## What does not work

- Cataloging `JSON.stringify` as observational because no replacer argument is present fails because `toJSON`,
   getters,
  and proxy behavior remain reachable.
- Cataloging all reflection functions together fails because operations such as integrity checks can dispatch proxy
  internal methods.
- Treating callback methods as complete zero-effect observations misses mutation through callback parameters.
- Treating Array `join` as unconditionally observational misses object coercion hooks.
- Treating `Object.entries` over unknown values as observational misses getters and proxy traps.
  Traverse foreign AST values through parser-declared visitor keys instead.
- Matching only member text such as `is` or `isArray` would bless unrelated project code.
   The catalog must retain owner,
  member,
   declaration provenance,
   and package-major identity.

## Upstream filing artifact

### Upstream filing decision

1. **Is it really upstream's fault?
   ** No. The observed behavior is required ECMAScript semantics.
2. **Can upstream fix it?
   ** No applicable defect exists;
    removing hook dispatch would change JavaScript behavior.
3. **Are they supporting this use case?
   ** The specification supports the runtime operations,
    not static effect analysis.
4. **Would the repo welcome our contribution?
   ** Not applicable because no specification defect was found.
5. **Will they likely fix it?
   ** Not applicable because the algorithms are behaving as specified.
6. **Have we prototyped a minimal fix compatible with their architecture?
   ** No upstream fix is appropriate.
    The
   consumer-side exact intrinsic catalog is the verified remedy.

Nothing should be filed upstream.
