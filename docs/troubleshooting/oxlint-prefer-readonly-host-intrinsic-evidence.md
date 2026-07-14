# Oxlint prefer-readonly host intrinsic evidence

## Symptom

TypeScript declarations identify callable names and parameter types,
but they do not prove whether an ECMAScript,
Node,
DOM,
or browser-host callable observes,
mutates,
retains,
or invokes caller-owned values.
Treating declaration presence as behavior evidence can incorrectly permit mutable parameter types.

## Investigation

### ECMAScript

ECMA-262 is authored as Ecmarkup algorithms.
Ecmarkup exposes structured clause identities and propagating `effects` metadata.
Its documented effect vocabulary currently identifies `user-code`,
which is useful for detecting possible accessor,
proxy,
or callback execution.
It does not encode receiver or argument mutation targets.

The rule therefore consumes an exact,
machine-readable catalog of audited algorithm outcomes keyed by TypeScript declaration provenance,
owner,
and member.
Each entry records an exact ECMA-262 commit,
a SHA-256 digest of its `spec.html` authoring source,
and the exact Ecmarkup clause ID.
A bundled clause-ID index extracted from that pinned source rejects unknown algorithm identities.
Unrecognized source identities and absent entries remain opaque.
Runtime probes are not accepted as proof that an intrinsic does not mutate.

### DOM and browser hosts

Web IDL specifies API surfaces and JavaScript bindings.
The standard explicitly leaves API-specific behavior to prose and method steps in each defining standard.
It has no general mutation-effect extended attribute.

Browser-host entries therefore name an exact DOM,
HTML,
CSSOM,
or Encoding Standard commit,
a SHA-256 digest of the authoring source,
and the audited operation identity.
A bundled operation index is generated directly from pinned Bikeshed `<dfn method>` blocks,
independently of the effect catalog,
and rejects unknown anchor hashes.
TypeScript `lib.dom.d.ts` and `lib.webworker.d.ts` files establish only declaration identity.
Unknown browser APIs remain opaque rather than inheriting behavior from a same-named method.

The element-method audit distinguishes mutation from layout or selector observation:

- DOM `ParentNode.append` changes its receiver and can move supplied nodes from an existing parent;
- DOM `Element.setAttribute` and `DOMTokenList.toggle` change receiver state;
- DOM `ParentNode.querySelector` and `ParentNode.querySelectorAll` only select descendants;
- CSSOM View `Element.getBoundingClientRect` computes and returns a rectangle without changing caller-owned input.

Each entry uses the exact source-derived `<dfn method>` hash from the pinned DOM or CSSOM View authoring source.
The CSSOM View source is pinned separately from CSSOM because they are distinct authored specifications even though
both sources share one CSSWG repository revision.

The canvas audit uses HTML's source algorithms and TypeScript's declaration mixin owners:

- `HTMLCanvasElement.getContext` and `OffscreenCanvas.getContext` change canvas context mode and return the rendering
  context;
- `CanvasRect.clearRect` erases receiver bitmap pixels;
- `CanvasDrawPath.beginPath` and `CanvasPath.moveTo` or `lineTo` change the receiver's current path;
- `CanvasDrawPath.stroke` and `CanvasDrawImage.drawImage` paint the receiver canvas bitmap.

Every operation is a receiver effect.
`drawImage` observes its source image argument but does not claim to mutate or retain it.

The File API audit keeps immutable byte observation separate from host retention:

- `Blob.text` reads blob bytes without changing caller-owned state;
- `FileList.item` returns one indexed file without changing the list;
- `URL.createObjectURL` retains its blob in the host blob URL store until revocation,
  so the blob remains an opaque relation rather than a direct mutation target.

### Node

Node embeds JavaScript built-in module source in its executable.
Node's `BuiltinLoader` source documents that built-in JavaScript is bundled as static data and labels
`process.binding('natives')` as the legacy source-access path.
Node also documents `process.binding()` as deprecation `DEP0111` and says it is intended for Node internal code.

The rule uses that private path only as fail-closed evidence:

- Node declaration provenance includes exact installed `@types/node` major;
- each audited entry names one embedded module,
  exact callable-definition marker,
  and exact export or owner binding markers;
- current runtime version must equal audited version;
- SHA-256 of embedded source must equal audited digest;
- marker occurrence count must equal the audited source-to-callable mapping;
- public `node:fs` and `node:url` source digests plus import/export markers must map internal definitions back to
  declaration-facing exports;
- missing binding,
  missing source,
  version drift,
  or digest drift rejects the entry.

The gate does not claim that arbitrary native C++ bindings are analyzable.
Node APIs without audited embedded JavaScript evidence remain opaque.

## Resolution

Host intrinsic resolution now separates identity from authority:

1. TypeScript 7 resolves exact declaration provenance,
   owner,
   and member.
2. `IntrinsicEffectEntry.authority` records pinned standard source plus algorithm or exact Node source plus
   callable-definition identity.
3. `intrinsicEffect()` rejects every non-package entry without available authority.
4. Node entries additionally gate on declaration major,
   runtime version,
   source module,
   and source digest.
5. Callback invocation remains separate from referent effects.
   For example,
   `setTimeout` records handler invocation and an unresolved relation to forwarded arguments;
   it does not claim those arguments are proven mutated.
6. Retention,
   option inspection,
   and host-maintained dependency relations use opaque targets rather than referent mutation.
   `AbortController.abort(reason)`,
   `AbortSignal.any(signals)`,
   and EventTarget listener registration therefore require uncertainty documentation without claiming direct mutation.
7. Unlisted,
   native,
   dynamic,
   or unsupported host calls retain uncertainty and require complete `@mutates` documentation.

This is intentionally demand-driven at lookup time.
The repository does not generate a complete catalog of every host API.

## Upstream filing decision

No upstream issue was filed.
The evidence gap spans distinct authorities rather than one defective tool:
Ecmarkup deliberately models `user-code` effects,
Web IDL delegates API behavior to defining specifications,
and Node marks the only in-process source path as internal.
A request for one shared caller-mutation schema would not have a single project able to implement it.
The rule's fail-closed composition is therefore a downstream policy,
not an actionable bug in TypeScript,
Oxlint,
Ecmarkup,
Web IDL,
or Node.

## Sources

- [Ecmarkup effects][ecmarkup-effects]
- [ECMA-262 authoring source][ecma-source]
- [Web IDL standard][web-idl]
- [DOM Standard][dom-standard]
- [CSSOM View Module][cssom-view]
- [File API][file-api]
- [Node `BuiltinLoader` source for v26.5.0][node-builtins]
- [Node deprecation `DEP0111`][node-dep0111]

[ecmarkup-effects]: https://tc39.es/ecmarkup/#effects
[ecma-source]: https://raw.githubusercontent.com/tc39/ecma262/master/spec.html
[web-idl]: https://webidl.spec.whatwg.org/
[dom-standard]: https://dom.spec.whatwg.org/
[cssom-view]: https://drafts.csswg.org/cssom-view/
[file-api]: https://w3c.github.io/FileAPI/
[node-builtins]: https://github.com/nodejs/node/blob/v26.5.0/src/node_builtins.h
[node-dep0111]: https://nodejs.org/docs/latest-v26.x/api/deprecations.html#dep0111-processbinding
