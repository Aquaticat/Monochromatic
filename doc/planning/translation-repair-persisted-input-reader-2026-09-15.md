# Strict persisted preparation input reader

## Ownership and sequence

Task52 is split into independently verifiable implementation owners:

- Task63 decodes the complete persisted input DTO.
- Task64 materializes finite root registrations and potential invocation slots.
- Task65 materializes initial and registered conditional post-relabel phases.
- Task66 owns exclusive persistence,
  separate review gates and independent reconstruction.

Task52 retains integration acceptance before task53 acquisition journals.
Task51 and task62 qualify the existing persisted-input comparison;
they do not approve root/phase contents or paid work.

## Reader shape

Use a DTO-specific closed decoder,
not a generic schema framework or a partial typed assertion.
Rebuild every supported `PreparationRootInputs` field from owned parsed values.
Freeze returned objects and arrays,
preserve array order,
and retain observed raw-byte extent and SHA-256 separately from the decoded evidence.
Neither field grants review or admission.

The byte-owning I/O caller must enforce its authorized extent before decoding.
`package/module/translation-repair/src/corpus-run/producer-input-bounds.ts` defines a metadata ceiling,
not a root-input-body ceiling;
it cannot reject the retained root artifact merely because that artifact exceeds metadata size.
Do not invent an existing artifact limit.

The public reader must copy genuine byte views before interpreting them,
reject proxies/detached buffers through owned fixed errors,
use strict UTF-8 decoding,
and retain no parser excerpt or foreign error cause.
The native writer passes compact `JSON.stringify(inputs)` to the UTF-8 output writer:
`package/module/translation-repair/src/corpus-run/producer-prepare-app.ts:206`
and `package/module/translation-repair/src/corpus-run/producer-input-output.ts:84`.
A serialization-grammar check must match those actual bytes,
not an assumed pretty-printed format.

Known evidence-only fields are still fully decoded.
Leaving them as `unknown` would let later consumers mistake unchecked evidence for a complete DTO.
Task64 may take an internal consumed-field projection after its owning entry decodes fresh bytes;
a previously returned typed object is not an authenticated certificate.
No additional persisted projection or general executor is needed.

## Relationship constraints from current source

`package/module/translation-repair/src/preparation-root-reference-model.ts` owns the closed unversioned DTO.
Require its exact scope and key inventory;
do not add or infer a `version` field.
Scalar,
discriminant,
array,
digest,
coordinate and nested-record validation precede typed construction.

Validate unique identities and complete relationships where the DTO actually represents them.
Do not conflate these collections:

- `parents` contains the ordered frozen writer selection.
- `registry` also contains definition-only dependencies.
  A registry member need not belong to `parents`.
  Resolve parent identity through the represented population and entry domains,
  preserving its independent roles.
- `unalignedDefinitions` deliberately retains nodes outside aligned parents.
  It must not be required to resolve to a registered definition parent.
  The separate Xing namespace must remain valid without widening acquisition scope.
- `questionAliases` groups exact serialized questions in registry order,
  not merely equal digests.
  Reuse that substantive identity when checking alias membership.

These distinctions follow
`package/module/translation-repair/src/preparation-root-registration.ts:79`,
`:99`,
`:173` and `:223`.
A scoped design review's suggestions to resolve all registry records through selected parents
and all unaligned definitions through registered definition parents are rejected by this source evidence.

Selected-entry text can validate the hashes and coordinates it actually carries.
Raw-document and supporting-artifact identities do not supply omitted bodies.
Do not reconstruct those bodies,
open their locators,
relist the corpus or invoke another input runner from the reader.
Do not impose the current selection census as a general DTO schema constant;
the owning root plan separately binds the frozen selection.

## Verification contract

Use freshly built decoder artifacts and cat-authored schema fixtures.
Cover every field family,
including malformed fields not consumed by initial planning.
Cover extra/missing keys,
discriminant drift,
duplicate identities,
relationship drift,
UTF-8/JSON refusal,
caller mutation,
byte-view overrides and detached/proxy inputs.
Diagnostics must not expose input text or native parser details.

The real retained Task47 artifact must decode through the built interface.
Its reader import closure must not acquire files,
spawn processes,
construct providers or transmit requests.
Canonical checks,
types,
hashes and round trips remain syntax/consistency evidence,
not semantic review or acquisition approval.

## Implementation checkpoint

The initial internal byte/JSON stage copies native byte views,
uses strict UTF-8 decoding,
and compares reserialized JSON against original copied bytes.
The byte comparison rejects a stripped BOM as well as duplicate keys and non-native spellings.
A dedicated inert build entry keeps its acquisition-free import closure independently inspectable.
The parsed value deliberately remains `unknown`.
Complete DTO decoding,
relationship validation,
final immutable projection and their qualification remain task63 work;
this internal stage is not a completed root-input reader.

`54a8bca9b` introduces that stage and its built-artifact controls.
R1 fresh normal/bootstrap builds,
types and the JSON/root/message-vocabulary tests pass.
Full-scope lint then reports thirteen warnings and no errors,
covering layout,
shadowing and hexadecimal spelling.
`76105d223` addresses those findings;
R2 verification is running with fresh builds before types and tests.
The proof roots and raw diagnostics are durable under package
`node_modules/.monochromatic/preparation-input-reader/`.
No completed decoder,
semantic qualification or plan materialization is inferred from this checkpoint.
