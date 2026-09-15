# Node 26.8.2 root-input JSON omits definition-order Set members

## Symptom

The retained Task47 artifact contains `freeOrder: { "source": {}, "target": {} }`
for every queried registration.
The file is valid JSON,
so the byte comparison and byte/JSON reader report no serialization error.
Those checks do not establish that runtime collection contents survived persistence.

The measured artifact has 42 queried registrations.
Nine have nonempty definition-node inventories,
but their persisted order-exemption fields still contain empty objects.
Task67 owns the repair and blocks task63's complete DTO decoder.
Do not interpret the empty objects as empty exemption sets or grant plan authority to this artifact.
Frozen originals remain retained unchanged.

## Root cause

`package/module/translation-repair/src/preparation-root-registration-model.ts:93`
uses the in-memory question type in a supposedly serializable DTO:

```ts
// package/module/translation-repair/src/preparation-root-registration-model.ts
readonly freeOrder: BlockPairingQuestion['freeOrder'];
```

The referenced `FreeOrderBlocks` at
`package/module/translation-repair/src/pair-blocks-wire.ts:274` contains sets:

```ts
// package/module/translation-repair/src/pair-blocks-wire.ts
readonly source: ReadonlySet<number>;
readonly target: ReadonlySet<number>;
```

`definitionIndexes` in `package/module/translation-repair/src/pair-definition-order.ts:85`
constructs a set of local node positions.
The registration constructor at
`package/module/translation-repair/src/preparation-root-registration.ts:152`
retains those runtime objects directly:

```ts
// package/module/translation-repair/src/preparation-root-registration.ts
freeOrder: numbered.freeOrder,
```

The application at
`package/module/translation-repair/src/corpus-run/producer-prepare-app.ts:206`
passes `JSON.stringify(inputs)` to its output writer without a collection transformation.
Node does not encode Set members through ordinary JSON object properties.

The deciding source is Node `v26.8.2`,
commit `f2f2c2f246c36bd74f082cb43ecfe830657d81c9`,
read without modifying the source clone.
V8's `deps/v8/src/json/json-stringifier.cc:1379` emits an empty object when there are no own descriptors:

```cpp
// nodejs/node: deps/v8/src/json/json-stringifier.cc
if (map->NumberOfOwnDescriptors() == 0) {
  AppendCStringLiteral("{}");
  return SUCCESS;
}
```

Its slow object path at line 1466 obtains enumerable own string keys:

```cpp
// nodejs/node: deps/v8/src/json/json-stringifier.cc
KeyAccumulator::GetKeys(isolate_, object, KeyCollectionMode::kOwnOnly,
                       ENUMERABLE_STRINGS,
                       GetKeysConversion::kConvertToString)
```

The defect is the repository's DTO choice,
not a Node promise that sets serialize as arrays.

## Verification

The original artifact has 2821409 bytes and SHA-256
`12c4f304dad2a7039c5452ae7f3de5a84160f759e27968e05e47494c0f3eb75a`.
Its observed field shapes and definition domains are retained in package
`node_modules/.monochromatic/preparation-input-reader/free-order-observation/persisted-reading.json`.
The observed input collections are not a current acquisition receipt or reviewed plan.

Native Node `26.8.2` controls distinguish the representations:

```js
// Provider-free serialization control.
JSON.stringify({ source: new Set([1, 3]), target: new Set([2]) });
// Observed: {"source":{},"target":{}}
JSON.stringify({ source: [1, 3], target: [2] });
// Observed: {"source":[1,3],"target":[2]}
```

The exact control strings,
observation hash and retained V8 source are in the same private evidence directory.
The array control preserves members;
the set control loses them.
No provider call or corpus edit is involved.

## Repair ownership and limits

Keep `FreeOrderBlocks` as sets for existing in-memory pairing interpretation.
The root registration DTO must instead own explicit ordered numeric arrays,
materialized from those sets before JSON persistence.
This changes unpublished transport data,
not substantive pairing messages,
model identities,
provider order,
quorums or definition authority.

The existing responsibilities stay separate:

- `definitionIndexes` selects definition positions from native node zones.
- `blockPairingQuestion` owns in-memory order-exemption sets and the historical question key.
- Root registration owns the serializable projection.
- Task47 owns exclusive persistence and retained file identity.
- Task63 validates the corrected persisted DTO.
- Later pairing interpretation owns any array-to-set conversion it actually needs.

Source search finds no production consumer of the root DTO's `freeOrder` field yet.
The existing replay and evidence-occurrence consumers use `BlockPairingQuestion.freeOrder`,
not the root DTO;
they must retain their current set behavior.

The repair requires a failing native-root JSON round-trip control,
passing asymmetric and empty definition-index cases,
and fresh provider-free artifact qualification.
Those implementation checks are pending.
Do not silently relabel the frozen artifact or derive a new expected digest from it.

## Rejected remedies

- A decoder that treats `{}` as an empty set invents absent interpretation data.
- A generic JSON replacer conceals the DTO's runtime-only field type and broadens serialization behavior.
- Reconstructing missing fields while calling them decoded data hides the persistence defect.
- Reusing the old file's byte-parity result as semantic validation overstates that proof.
- Editing frozen artifacts would destroy their bound evidence.

## Upstream filing decision

The `.out-of-scope/` topic inventory contains no matching Node JSON/Set entry.
No Node filing or patch is proposed.

1.  Upstream fault:
    no;
    the consumer stores runtime sets in JSON-bound data.
2.  Upstream fixability:
    no Node change is needed for an explicit DTO projection.
3.  Supported use case:
    the measured native object serialization does not promise Set-member preservation.
4.  Contribution policy:
    not asserted because there is no proposed upstream contribution.
5.  Expected upstream action:
    not asserted;
    ordinary serialization behavior is not an upstream refusal incident.
6.  Prototype:
    the native array control preserves indexes;
    repository integration and fresh artifact qualification remain pending.

Upstream filing artifact:
nothing to add to Node.
The repository defect is tracked separately with the changes explicitly unreviewed.
