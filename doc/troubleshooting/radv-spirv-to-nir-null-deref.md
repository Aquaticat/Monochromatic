# RADV 26.1.5 dereferences the NULL `spirv_to_nir()` returns, turning an untranslatable shader into SIGSEGV

Mesa's RADV driver assigns the result of `spirv_to_nir()` and immediately writes through it.
When translation fails and the function returns NULL,
the calling process dies with `SIGSEGV` instead of receiving a failure `VkResult`.

vkd3d-proton 3.1.0 emits one SPIR-V module that RADV cannot translate
while running a Godot 4.7.1 game exported with the D3D12 rendering driver,
which makes that game quit silently a few seconds after launch.

Observed with the Steam game `Horse Magnifier` (appid `4585340`,
 buildid `24643098`).
The RADV defect itself is not title-specific,
but whether any other title reaches it depends on that title generating a module RADV rejects,
which was not tested beyond this one game.

A caveat that shapes the whole document.
Vulkan places the burden of submitting valid SPIR-V on the application,
and it does not define the result of the invalid calls shown here,
including whether the process survives them.
A clean `VkResult` is therefore hardening rather than a conformance requirement,
and that reading is this document's own rather than a quotation from the specification.

The narrower demonstrated fact is that RADV leaves an implemented failure return unchecked
and that invalid input reaches it.
A maintainer could reasonably answer that the caller carries a valid-input precondition
under which the NULL is unreachable,
 which is why this is filed as a hardening request.

## Symptom

The game launches,
 shows no window,
 and exits with status `3` roughly five seconds later.
Steam reports no error and shows no crash dialog.

The game's own Godot log stops immediately after graphics device creation
and never reaches engine startup:

```text
# compatdata/4585340/pfx/drive_c/users/steamuser/AppData/Roaming/Horse Magnifier/logs/godot.log
Godot Engine v4.7.1.stable.official.a13da4feb - https://godotengine.org
D3D12 12_0 - Forward+ - Using Device #0: AMD - AMD Radeon RX 7600 XT
```

A working run of the same build reaches engine startup and continues:

```text
Godot Engine v4.7.1.stable.official.a13da4feb - https://godotengine.org
Vulkan 1.4.354 - Forward+ - Using Device #0: AMD - AMD Radeon RX 7600 XT

PHYSICS ENGINE 2D: Rapier2D v0.8.28
```

With `PROTON_LOG=1`,
 the Proton log carries the only diagnostic:

```text
err:vulkan:vkCreateComputePipelines Exception 0xc0000005 in Unix call.
```

Wine's exception record identifies the access precisely.
`info[0]=1` means a write,
 and `info[1]=0x40` is the faulting address,
so this is a write through a NULL pointer at structure offset `0x40`:

```text
trace:seh:handle_syscall_fault code=c0000005 flags=0 addr=0x7fa066444240 ip=7fa066444240 tid=01b0
trace:seh:handle_syscall_fault  info[0]=0000000000000001
trace:seh:handle_syscall_fault  info[1]=0000000000000040
trace:seh:handle_syscall_fault  rax=0000000000000000 rbx=000055558a4552f0 rcx=00007fa088006c40
```

The unwound stack crosses out of Wine into the host Vulkan driver:

```text
warn:seh:handle_syscall_fault backtrace: --- Exception 0xc0000005 at 0x7fa066444240: libvulkan_radeon.so + 0x13e240.
warn:seh:dwarf_virtual_unwind backtrace: 0x7fa066421c6b: libvulkan_radeon.so + 0x11bc6b.
warn:seh:dwarf_virtual_unwind backtrace: 0x7fa066422294: libvulkan_radeon.so + 0x11c294.
warn:seh:dwarf_virtual_unwind backtrace: 0x7fa06642251a: libvulkan_radeon.so + 0x11c51a.
warn:seh:dwarf_virtual_unwind backtrace: 0x7fa06642273b: libvulkan_radeon.so + 0x11c73b.
warn:seh:dwarf_virtual_unwind backtrace: 0x7fa0bf41053f: winevulkan.so + 0x3253f.
```

## Root cause

### Step 1: vkd3d-proton emits a module that fails SPIR-V validation

Dumping every module vkd3d-proton generates for this game
(`VKD3D_SHADER_DUMP_PATH`,
 see "Verification")
yields 109 SPIR-V modules.
Exactly one is rejected by `spirv-val`:

```text
$ spirv-val --target-env vulkan1.3 d8693a43c4e96bff.spv
error: line 2887: block <ID> '2965[%2965]' exits the selection headed by <ID> '2880[%2880]',
       but not via a structured exit
  %2965 = OpLabel
```

A validator may stop at its first error,
so this is the only module `spirv-val` rejects and at least this violation is present in it.
It is not established that this is the module's only defect.

The module is a compute shader,
 matching the entry point that crashes:

```text
OpEntryPoint GLCompute %main "main" %gl_GlobalInvocationID
OpExecutionMode %main LocalSize 64 1 1
```

The reported defect is a jump out of an inner selection construct straight to an outer merge block.
Block `%2880` opens a selection that must merge at `%3009`:

```text
%2880 = OpLabel
        ...
        OpSelectionMerge %3009 None
        OpBranchConditional %737 %3003 %2881
```

Block `%2965` sits inside that selection but branches to `%2966`,
which is the merge block of the enclosing selection,
 bypassing `%3009`:

```text
%2965 = OpLabel
 %741 = OpPhi %10 %341 %2885 %1238 %2964
        ...
        OpBranch %2966
%3009 = OpLabel
        OpUnreachable
```

`%3009` survives only as `OpLabel` followed by `OpUnreachable`.
That is consistent with a structurizer having rerouted control flow to the outer merge
and left the inner merge stranded,
but the final control-flow graph could also be the product of a later optimization pass,
so this is evidence rather than proof of which pass produced it.

### Step 2: `spirv_to_nir()` fails and returns NULL

Mesa's SPIR-V front end returns NULL on translation failure.
This is implementation behavior read from the source rather than a documented API contract.
The failure paths are in `src/compiler/spirv/spirv_to_nir.c`,
including the `setjmp` landing pad that every `vtn_fail()` unwinds to
at `src/compiler/spirv/spirv_to_nir.c:7509`:

```c
/* src/compiler/spirv/spirv_to_nir.c:7501 */
struct vtn_builder *b = vtn_create_builder(words, word_count,
                                           stage, entry_point_name,
                                           options);

if (b == NULL)
   return NULL;

/* See also _vtn_fail() */
if (vtn_setjmp(b->fail_jump)) {
   ralloc_free(b);
   return NULL;
}
```

### Step 3: RADV dereferences the NULL without checking

In Mesa at tag `mesa-26.1.5` (commit `6a02618ccf6c5651ecb9cccbde571eb61fd73592`),
`src/amd/vulkan/radv_shader.c:541` calls `spirv_to_nir()`
and `src/amd/vulkan/radv_shader.c:543` immediately writes through the result:

```c
/* src/amd/vulkan/radv_shader.c:541 */
nir = spirv_to_nir(spirv, stage->spirv.size / 4, spec_entries, num_spec_entries, stage->stage, stage->entrypoint,
                   &spirv_options, &pdev->nir_options[stage->stage]);
nir->info.internal |= is_internal;
assert(nir->info.stage == stage->stage);
nir_validate_shader(nir, "after spirv_to_nir");
```

There is no NULL check between the call and the dereference.
`nir->info.internal |= is_internal` is a bitfield OR at offset `0x40` of `nir_shader`,
which compiles to exactly the faulting instruction:

```text
$ objdump --disassemble --start-address=0x13e240 --wide /usr/lib64/libvulkan_radeon.so
13e240:  44 08 50 40    or  %r10b,0x40(%rax)
```

With `rax` holding the NULL return,
 that instruction writes to address `0x40`,
matching `info[0]=1` (write) and `info[1]=0x40` (address) from the exception record.

The `assert` on the following line is not a safety net even in debug builds.
As written,
 `nir->info.internal` dereferences the NULL before execution ever reaches the assertion.
Even if that preceding write were removed,
evaluating the assertion's condition would itself dereference the NULL
rather than produce an assertion diagnostic.

### Resolving the stripped symbols

The shipped Terra build is stripped and its build-id
(`95992bc9dc5e7ae821f4d7a58fd0950239c8d7aa`) is not served by any debuginfod,
so the frame names come from a byte-pattern transfer.

The seven-byte instruction sequence at the fault is unique in both the installed 26.1.5 build
and the 26.1.6 build that Terra still ships debuginfo for:

```bash
# 440850404889c3 == "or %r10b,0x40(%rax); mov %rax,%rbx"
# one hit at 0x13e240 in 26.1.5, one hit at 0x13e6c0 in 26.1.6
addr2line --functions --exe libvulkan_radeon.so-26.1.6-3.fc44.x86_64.debug 0x13e6c0
# radv_shader_spirv_to_nir
# .../src/amd/vulkan/radv_shader.c:543
```

The standalone harness then produced a core dump that `coredumpctl` symbolized,
and its names and offsets agree with both the transfer above and the Proton backtrace:

```text
#0  0x00007fe78b12c240 radv_shader_spirv_to_nir     (libvulkan_radeon.so + 0x13e240)
#1  0x00007fe78b109c6b radv_compile_cs              (libvulkan_radeon.so + 0x11bc6b)
#2  0x00007fe78b10a294 radv_compute_pipeline_compile (libvulkan_radeon.so + 0x11c294)
#3  0x00007fe78b10a51a radv_compute_pipeline_create  (libvulkan_radeon.so + 0x11c51a)
#4  0x00007fe78b10a73b radv_CreateComputePipelines   (libvulkan_radeon.so + 0x11c73b)
```

These are not two independent resolutions of the stripped binary.
The byte-pattern transfer supplies the names;
the core dump shows the standalone harness reaches the same five frames Proton did.

### Two earlier readings were wrong

The first backtrace,
 taken with Steam's default layer set,
 contained a sixth frame:

```text
warn:seh:dwarf_virtual_unwind backtrace: 0x7fac7414cf46: libVkLayer_steam_fossilize.so + 0x92f46.
```

Steam's Fossilize layer hooks `vkCreateComputePipelines`,
and it was logging `Compute pipeline handle ... is not registered` seconds before the crash,
which made it look causal.
It is not.
It was only the caller.

A second reading blamed `VK_LAYER_LS_frame_generation`,
whose manifest at `/usr/local/share/vulkan/implicit_layer.d/VkLayer_LS_frame_generation.json`
declares `disable_environment` with no `enable_environment`,
which makes it eligible by default rather than opt-in.

Running with `VK_LOADER_LAYERS_DISABLE='~implicit~'` falsified both readings at once.
The crash was unchanged at byte-identical RADV offsets,
and the Fossilize frame disappeared from the backtrace,
which proves the variable took effect and that no implicit layer is required to trigger the fault.

The stronger claim,
 that no layer of any kind participates,
 is carried by the standalone harness.
It leaves `enabledLayerCount` at zero in its `VkInstanceCreateInfo`,
so it requests no explicit layers,
and running it under `VK_LOADER_LAYERS_DISABLE='~implicit~'` still segfaults
while the control module still returns `VkResult 0`.
`VK_INSTANCE_LAYERS` and `VK_LOADER_LAYERS_ENABLE` were unset throughout,
which only rules out layers injected through those variables.

## Verification

### Versions under test

- Mesa `mesa-vulkan-drivers-26.1.5-2.fc44.x86_64`,
   vendor Terra,
  build-id `95992bc9dc5e7ae821f4d7a58fd0950239c8d7aa`,
   `driverVersion` 109056005.
- Mesa source at tag `mesa-26.1.5`,
   commit `6a02618ccf6c5651ecb9cccbde571eb61fd73592`,
  from `https://gitlab.freedesktop.org/mesa/mesa.git`.
- Mesa `mesa-vulkan-drivers-26.1.6-3.fc44.x86_64`,
   `driverVersion` 109056006,
   also affected.
- Mesa `main` at commit `a384e13d8992ba5aba2eceb1745a1cf8dc196f79`,
   dated 2026-08-10,
  still contains the unchecked dereference at `src/amd/vulkan/radv_shader.c:539`.
- Proton Experimental build `1785947781`,
   `experimental-11.0-20260805`.
- vkd3d-proton `3.1.0`,
   build `2c7ba22c5326145`.
- Steam Linux Runtime `4.0.20260714.251823`,
   pressure-vessel `0.20260714.0`.
- Kernel `7.1.3-ogc5.1.fc44.x86_64`.
- GPU PCI `1002:7480`,
   which is the shared Navi 33 device id.
  RADV names it `AMD Radeon RX 7600 (RADV NAVI33)`
  while vkd3d-proton's D3D12 device reports `AMD Radeon RX 7600 XT`.
  Same card,
   two naming tables.

### Harness one: standalone, no Wine, no Steam

[radv-spirv-to-nir-null-deref.c](radv-spirv-to-nir-null-deref.c) creates a Vulkan device,
builds a pipeline layout,
 and calls `vkCreateComputePipelines` on a single SPIR-V module.

The module it is run against is hand-written rather than taken from the game.
[radv-spirv-to-nir-null-deref.spvasm](radv-spirv-to-nir-null-deref.spvasm)
reproduces the same structured control flow violation in a few dozen instructions,
and [radv-spirv-to-nir-null-deref-control.spvasm](radv-spirv-to-nir-null-deref-control.spvasm)
is the same shader with one operand changed:
the inner branch targets its own merge block instead of jumping out to the outer one.
That pair is the whole experiment.
Same shader,
 same harness,
 same driver,
 one branch target apart.

Because the harness only ever builds a compute pipeline,
it refuses non-compute modules up front:
handing it a vertex or fragment module makes `spirv_to_nir()` reject the stage mismatch
and return NULL,
 which crashes through the same unchecked dereference
and would otherwise be mistaken for a defect in the module.

Run from the repository root,
 building into a scratch path so nothing lands in the tree:

```bash
cd doc/troubleshooting
gcc -O0 -g -o "${HOME}/temp/agent/radv-spirv-null-repro" \
  radv-spirv-to-nir-null-deref.c -lvulkan
spirv-as --target-env vulkan1.3 radv-spirv-to-nir-null-deref.spvasm \
  -o "${HOME}/temp/agent/repro.spv"
spirv-as --target-env vulkan1.3 radv-spirv-to-nir-null-deref-control.spvasm \
  -o "${HOME}/temp/agent/control.spv"

spirv-val --target-env vulkan1.3 "${HOME}/temp/agent/repro.spv"    # rejects
spirv-val --target-env vulkan1.3 "${HOME}/temp/agent/control.spv"  # accepts

"${HOME}/temp/agent/radv-spirv-null-repro" "${HOME}/temp/agent/repro.spv"
"${HOME}/temp/agent/radv-spirv-null-repro" "${HOME}/temp/agent/control.spv"
```

`spirv-val` rejects the first module with the same error class the game shader produced:

```text
error: line 27: block <ID> '20[%20]' exits the selection headed by <ID> '17[%17]',
       but not via a structured exit
  %20 = OpLabel
```

The harness result on 26.1.5 and on 26.1.6:

```text
device: AMD Radeon RX 7600 (RADV NAVI33) (driver 109056005)
calling vkCreateComputePipelines...
Segmentation fault (core dumped)
```

The control module is the positive control and returns cleanly on both:

```text
device: AMD Radeon RX 7600 (RADV NAVI33) (driver 109056005)
calling vkCreateComputePipelines...
pipeline created: VkResult 0
```

The 109 modules dumped from the game behave the same way,
but none of them are committed here:
they are compiled shaders from a paid title,
and the hand-written pair reproduces the defect without redistributing them.

To test a Mesa build that is not installed system-wide,
rewrite `library_path` in `radeon_icd.x86_64.json` to an absolute path
and point the loader at it with `VK_DRIVER_FILES`.

### Harness two: the game under Proton

Reproduces the original failure end to end,
 and regenerates the shader dump.

```bash
cd '/var/mnt/encrypted/SteamLinux/steamapps/common/Horse Magnifier'
env STEAM_COMPAT_CLIENT_INSTALL_PATH="${HOME}/.local/share/Steam" \
    STEAM_COMPAT_DATA_PATH=/var/mnt/encrypted/SteamLinux/steamapps/compatdata/4585340 \
    SteamAppId=4585340 SteamGameId=4585340 \
    PROTON_LOG=1 PROTON_LOG_DIR=/tmp/protonlog \
    VKD3D_SHADER_DUMP_PATH='Z:\home\user\temp\agent\spirvdump' \
    "${HOME}/.local/share/Steam/steamapps/common/SteamLinuxRuntime_4/_v2-entry-point" \
    --verb=waitforexitandrun -- \
    "${HOME}/.local/share/Steam/steamapps/common/Proton - Experimental/proton" waitforexitandrun \
    './HorseMagnifier.exe'
```

### Modules that translate cleanly

The dump holds 109 modules:
 101 `GLCompute`,
 4 `Vertex`,
 and 4 `Fragment`.
Running the harness over all of them gives
100 compute modules that create a pipeline and return `VK_SUCCESS`,
one compute module that segfaults,
and 8 non-compute modules the harness refuses before touching Vulkan.

108 of the 109 modules pass `spirv-val --target-env vulkan1.3`.

Godot's Vulkan rendering driver does not go through vkd3d-proton's DXIL translation at all,
which is why the Vulkan backend never reaches this path.
The SPIR-V that Godot's own Vulkan backend generates was not dumped or validated.

### Modules that fail

One module,
 dumped as `d8693a43c4e96bff.spv`,
a `GLCompute` entry point with `LocalSize 64 1 1`.
It is the only module `spirv-val` rejects
and the only compute module that crashes the harness.

That it is also the module the game dies on is an inference,
 not a direct observation:
the game's device enables everything vkd3d-proton asks for,
so a capability or stage mismatch cannot explain the in-game crash,
and this is the only module in the set that RADV cannot translate on a fully featured device.

### What was not established

- The corresponding DXIL input was dumped alongside the SPIR-V but was not validated,
  and DXIL to SPIR-V conversion was not reproduced outside the game.
  Attributing the malformed control flow to vkd3d-proton's structurizer
  is therefore an attribution consistent with the evidence,
   not a demonstrated cause.
- Whether other Godot D3D12 titles generate a module RADV rejects was not tested.
- Whether every untranslatable module reaches this same crash was not tested.
  Two routes were observed:
   an invalid module,
   and a stage mismatch.

## Verified workarounds

### Force Godot's Vulkan rendering driver (applied)

Godot's official Windows export templates contain both a D3D12 and a Vulkan backend,
and the rendering driver is selectable at runtime.
Steam per-game launch options:

```text
%command% --rendering-driver vulkan
```

This removes vkd3d-proton from the pipeline entirely,
so no DXIL to SPIR-V translation happens and no rejected module is produced.
Verified by launching from Steam:
 the game reached its title screen,
rendered animated frames,
 and was still running when observation stopped
at 51 seconds,
 against roughly 5 seconds to exit before the change.
A separate manual run under the same launch argument ran for more than 5 minutes
before being terminated deliberately.

Tradeoffs.
The Vulkan and D3D12 backends are separate code paths in Godot,
so renderer-specific bugs and performance characteristics change,
and any game-side behaviour tuned against D3D12 is no longer what runs.
The setting is per game,
 so every affected title needs its own launch option.
Clearing the launch options field silently restores the crash.
Godot builds exported without the Vulkan backend cannot use this at all.

Menu navigation past the title screen was not confirmed.
Synthetic clicks reached the window but did not advance the scene,
and on this Wayland session an input-injection artifact cannot be told apart
from the game's own behaviour.

### Report the shader pair to the game's developer

The rejected SPIR-V and its `.dxil` input can be handed to the game's developer,
who is the only party able to correlate them back to a shader in their project.
Whether any source change on their side avoids the construct is not established here:
the responsible translation pass was never identified,
so prescribing a shader rewrite would be guesswork.

## What does not work

- Disabling Steam's shader pre-caching layer with
  `DISABLE_VK_LAYER_VALVE_steam_fossilize_1=1`.
  The crash is unchanged.
  Fossilize appears in the first backtrace only because it hooks the entry point.
- Disabling every implicit Vulkan layer with `VK_LOADER_LAYERS_DISABLE='~implicit~'`,
  which covers Fossilize,
   the Steam overlay,
   MangoHud,
   vkBasalt,
   OBS capture,
  gamescope WSI,
   Mesa device-select,
   and the Lossless Scaling frame-generation layer.
  The crash is unchanged at identical offsets.
- Deleting the `vkd3d-proton.cache` file from the game directory.
  The file is generated locally rather than shipped,
  and removing it reproduces the same crash at the same offset.
- Updating Mesa from 26.1.5 to 26.1.6.
  Measured with the standalone harness against the extracted 26.1.6 driver:
   still segfaults.
  The commit range `mesa-26.1.5..mesa-26.1.6` touches nothing in this path.
- Reading Mesa's issue tracker directly.
  `gitlab.freedesktop.org` is behind Anubis,
   which refused both `WebFetch`
  and `agent-browser`,
   so live maintainer discussion could not be checked.

## Upstream filing artifact

### Upstream filing decision

`.out-of-scope/` was checked before drafting.
No exemption covers Mesa,
 RADV,
 vkd3d-proton,
 Proton,
 or graphics drivers as a class,
so upstream tracking is in scope for this bug.

Duplicate search.
For vkd3d-proton,
 `gh search issues --repo HansKristian-Work/vkd3d-proton`
was run over both open and closed state for `spirv structured control flow` and for `godot`,
returning nothing.
The same command with the term `crash` returns results,
so the empty result is a real absence and not a broken query.
For Mesa,
 a web search surfaced
[mesa issue 4740](https://gitlab.freedesktop.org/mesa/mesa/-/issues/4740),
"the new spirv to nir compiler after 20.2 causes a null pointer which cashes the radv driver",
which reports the same class of NULL dereference from 2021.
Its body could not be read because Anubis blocked direct access,
so its resolution and any maintainer position are unverified.

Two candidate upstreams exist,
 and the audit lands differently for each.

#### Mesa and RADV: file the NULL-check fix

1.  Is it really upstream's fault?
    Soft yes.
    Vulkan puts the burden of valid SPIR-V on the application,
    so a crash on invalid input is arguably outside the contract,
    and this document does not claim a specification violation.
    Against that,
     Mesa's own `spirv_to_nir()` returns NULL on failure
    and RADV ignores it,
     which is an internal inconsistency independent of the input.
    The second route uses a validator-clean module with an invalid module-to-stage pairing.
    It broadens the reachable failure cases,
    but it is still invalid Vulkan usage rather than a failure on a valid call.
2.  Can upstream fix it?
    Yes.
    A NULL check that frees `spec_entries` and propagates the existing failure path is small.
3.  Are they supporting this use case?
    Partially.
    RADV makes no robustness promise against SPIR-V it cannot translate.
4.  Would the repo welcome our contribution?
    Likely,
     with one unverified area.
    `docs/submittingpatches.rst` documents the merge-request process,
    and no policy against outside or AI-assisted contributions exists anywhere in the tree
    at tag `mesa-26.1.5`.
    The live tracker could not be read because of Anubis,
    so a policy added after that tag would have been missed.
5.  Will they likely fix it?
    Unknown,
     which passes.
    Issue 4740 reported this class in 2021 and the dereference is still present in `main`,
    but no documented won't-fix,
     stated non-goal,
     or maintainer refusal was found.
    Silence is not a fail.
6.  Have we prototyped a minimal fix?
    Yes.
    See "Prototyped fix" below.

All six constraints hold for the compute path,
 so the Mesa draft is fileable on the merits.

Nothing has been filed.
Posting to an upstream tracker is an outward-facing action,
so it waits on the user's explicit authorization.
A future session must not read "fileable" as permission to post.

#### vkd3d-proton and dxil-spirv: draft kept, not fileable yet

1.  Is it really upstream's fault?
    Yes for the module:
     they emit SPIR-V that `spirv-val` rejects.
    Which pass produced the malformed graph is an attribution,
     not a demonstrated cause,
    as recorded under "What was not established".
2.  Can upstream fix it?
    Yes,
     somewhere in the DXIL to SPIR-V pipeline.
    Which pass is responsible,
     and whether it lives in vkd3d-proton or in dxil-spirv,
    is not established.
3.  Are they supporting this use case?
    Yes.
    Running D3D12 titles under Proton is the project's stated purpose,
    and the tracker carries many per-game crash reports.
4.  Would the repo welcome our contribution?
    Likely yes.
    The tracker is open and active,
     and per-game crash reports are routine there.
    No policy against outside or AI-assisted reports was found.
5.  Will they likely fix it?
    Plausible.
    No existing issue covers it and development is active.
6.  Have we prototyped a minimal fix?
    No.
    The fix belongs somewhere in the DXIL to SPIR-V pipeline,
    and the responsible pass was not identified,
     let alone patched.
    Prototyping it needs the DXIL input validated
    and the conversion reproduced outside the game first,
    neither of which was done.

Constraints 1 to 5 hold,
 so the draft is kept.
Constraint 6 is unmet,
 so it is marked do not file as-is.

### Prototyped fix for Mesa

Built from a disposable clone of `https://gitlab.freedesktop.org/mesa/mesa.git`
at tag `mesa-26.1.5`,
 commit `6a02618ccf6c5651ecb9cccbde571eb61fd73592`,
configured with `-Dvulkan-drivers=amd -Dgallium-drivers= -Dplatforms= -Dllvm=disabled`
and `-Dbuildtype=release -Db_ndebug=true`,
 inside a memory-capped and CPU-capped container.

```diff
--- a/src/amd/vulkan/radv_shader.c
+++ b/src/amd/vulkan/radv_shader.c
@@ -540,6 +540,10 @@ radv_shader_spirv_to_nir(struct radv_device *device, struct radv_shader_stage *s
       nir = spirv_to_nir(spirv, stage->spirv.size / 4, spec_entries, num_spec_entries, stage->stage, stage->entrypoint,
                          &spirv_options, &pdev->nir_options[stage->stage]);
+      if (!nir) {
+         free(spec_entries);
+         return NULL;
+      }
       nir->info.internal |= is_internal;
--- a/src/amd/vulkan/radv_pipeline_compute.c
+++ b/src/amd/vulkan/radv_pipeline_compute.c
@@ -106,6 +106,8 @@ radv_compile_cs(struct radv_device *device, struct radv_shader_stage *cs_stage,
    cs_stage->nir = radv_shader_spirv_to_nir(device, cs_stage, NULL, is_internal);
+   if (!cs_stage->nir)
+      return NULL;
@@ -222,6 +224,11 @@ radv_compute_pipeline_compile(const VkComputePipelineCreateInfo *pCreateInfo, st
    struct radv_shader_binary *cs_binary = radv_compile_cs(device, &cs_stage, keep_executable_info, keep_statistic_info,
                                                           pipeline->base.is_internal, &cs_dbg);
+   if (!cs_binary) {
+      result = VK_ERROR_UNKNOWN;
+      radv_pipeline_stage_finish(&cs_stage);
+      goto done;
+   }
    pipeline->base.shaders[MESA_SHADER_COMPUTE] =
       radv_shader_create(device, cache, cs_binary, skip_shaders_cache, &cs_dbg);
```

Scope.
This covers the compute path,
 which is the path that crashes here and the path the harness exercises.
The graphics caller at `src/amd/vulkan/radv_pipeline_graphics.c:2562`
and the ray-tracing caller at `src/amd/vulkan/radv_pipeline_rt.c:659`
assign the same function's result without a NULL check
and need equivalent treatment before the fix is complete upstream.
Threading a failure out of `radv_rt_spirv_to_nir`,
 which returns `void`,
 is the larger part of that work.

Verification command,
 run against each build with the harness from "Harness one":

```bash
VK_DRIVER_FILES=<icd pointing at the build> \
  "${HOME}/temp/agent/radv-spirv-null-repro" "${HOME}/temp/agent/repro.spv"
```

Before the patch,
 the self-built driver crashes exactly as the shipped one does:

```text
device: AMD Radeon RX 7600 (RADV NAVI33) (driver 109056005)
calling vkCreateComputePipelines...
Segmentation fault (core dumped)
```

A valid compute module against the same unpatched build returns `pipeline created: VkResult 0`,
which shows the build itself is sound rather than broadly broken.

After the patch,
 the same module returns an error instead of killing the process:

```text
device: AMD Radeon RX 7600 (RADV NAVI33) (driver 109056005)
calling vkCreateComputePipelines...
returned without crashing: VkResult -13
```

`-13` is `VK_ERROR_UNKNOWN`,
 which is what the patch propagates.
The valid compute module still returns `pipeline created: VkResult 0` against the patched build,
so the change does not regress the success path.

A more considered upstream patch might pick a different error code
and add a `vk_errorf` message naming the failing stage,
which is worth raising in review rather than deciding here.

### New-issue draft for Mesa

~~~md
Title: radv: NULL dereference when spirv_to_nir() fails, instead of returning an error

`radv_shader_spirv_to_nir()` assigns the result of `spirv_to_nir()` and writes through it
on the next line without a NULL check, so any SPIR-V module RADV cannot translate kills
the process instead of producing a VkResult.

src/amd/vulkan/radv_shader.c (tag mesa-26.1.5, and still present in main at a384e13d):

```c
nir = spirv_to_nir(spirv, stage->spirv.size / 4, spec_entries, num_spec_entries, stage->stage,
                   stage->entrypoint, &spirv_options, &pdev->nir_options[stage->stage]);
nir->info.internal |= is_internal;
```

`nir->info.internal |= is_internal` compiles to `or %r10b,0x40(%rax)`, so with a NULL return
the process takes SIGSEGV writing to address 0x40. The assert on the following line is not a
safety net: evaluating `nir->info.stage` dereferences `nir` too.

Reproduced on Mesa 26.1.5 and 26.1.6 (Radeon RX 7600, RADV NAVI33), and on a local
26.1.5 build configured with `-Dvulkan-drivers=amd -Dllvm=disabled -Db_ndebug=true`.

Minimal module, assembled with `spirv-as --target-env vulkan1.3` and passed to
`vkCreateComputePipelines`. `%inner_then` leaves the selection headed by `%outer_then`
without going through `%inner_merge`:

```
               OpCapability Shader
               OpMemoryModel Logical GLSL450
               OpEntryPoint GLCompute %main "main" %gid
               OpExecutionMode %main LocalSize 1 1 1
               OpDecorate %gid BuiltIn GlobalInvocationId
       %void = OpTypeVoid
     %fn_ty  = OpTypeFunction %void
       %uint = OpTypeInt 32 0
     %v3uint = OpTypeVector %uint 3
       %bool = OpTypeBool
 %ptr_in_v3u = OpTypePointer Input %v3uint
%ptr_in_uint = OpTypePointer Input %uint
     %uint_0 = OpConstant %uint 0
     %uint_1 = OpConstant %uint 1
        %gid = OpVariable %ptr_in_v3u Input
       %main = OpFunction %void None %fn_ty
      %entry = OpLabel
     %gid_xp = OpAccessChain %ptr_in_uint %gid %uint_0
      %gid_x = OpLoad %uint %gid_xp
 %outer_cond = OpIEqual %bool %gid_x %uint_0
               OpSelectionMerge %outer_merge None
               OpBranchConditional %outer_cond %outer_then %outer_merge
 %outer_then = OpLabel
 %inner_cond = OpIEqual %bool %gid_x %uint_1
               OpSelectionMerge %inner_merge None
               OpBranchConditional %inner_cond %inner_then %inner_merge
 %inner_then = OpLabel
               OpBranch %outer_merge
%inner_merge = OpLabel
               OpBranch %outer_merge
%outer_merge = OpLabel
               OpReturn
               OpFunctionEnd
```

Changing the `%inner_then` terminator to `OpBranch %inner_merge` makes the module valid,
and RADV then builds a pipeline from it normally. That one operand is the whole difference.

Backtrace:

```
#0  radv_shader_spirv_to_nir      (libvulkan_radeon.so + 0x13e240)
#1  radv_compile_cs               (libvulkan_radeon.so + 0x11bc6b)
#2  radv_compute_pipeline_compile (libvulkan_radeon.so + 0x11c294)
#3  radv_compute_pipeline_create  (libvulkan_radeon.so + 0x11c51a)
#4  radv_CreateComputePipelines   (libvulkan_radeon.so + 0x11c73b)
```

Two inputs reach it: a module that fails `spirv-val`, and a valid module whose execution
model does not match the pipeline being created (for example a Fragment module passed to
`vkCreateComputePipelines`). Both make `spirv_to_nir()` return NULL.

I understand the application is required to submit valid SPIR-V and that the driver is not
obliged to validate it, so this is a hardening request rather than a spec-conformance claim.
The inconsistency is that `spirv_to_nir()` already defines a NULL failure return that RADV
does not check.

A minimal patch for the compute path, built and verified as described above:

```diff
--- a/src/amd/vulkan/radv_shader.c
+++ b/src/amd/vulkan/radv_shader.c
@@ -540,6 +540,10 @@ radv_shader_spirv_to_nir(struct radv_device *device, struct radv_shader_stage *s
       nir = spirv_to_nir(spirv, stage->spirv.size / 4, spec_entries, num_spec_entries, stage->stage, stage->entrypoint,
                          &spirv_options, &pdev->nir_options[stage->stage]);
+      if (!nir) {
+         free(spec_entries);
+         return NULL;
+      }
       nir->info.internal |= is_internal;
--- a/src/amd/vulkan/radv_pipeline_compute.c
+++ b/src/amd/vulkan/radv_pipeline_compute.c
@@ -106,6 +106,8 @@ radv_compile_cs(struct radv_device *device, struct radv_shader_stage *cs_stage,
    cs_stage->nir = radv_shader_spirv_to_nir(device, cs_stage, NULL, is_internal);
+   if (!cs_stage->nir)
+      return NULL;
@@ -222,6 +224,11 @@ radv_compute_pipeline_compile(const VkComputePipelineCreateInfo *pCreateInfo, st
    struct radv_shader_binary *cs_binary = radv_compile_cs(device, &cs_stage, keep_executable_info, keep_statistic_info,
                                                           pipeline->base.is_internal, &cs_dbg);
+   if (!cs_binary) {
+      result = VK_ERROR_UNKNOWN;
+      radv_pipeline_stage_finish(&cs_stage);
+      goto done;
+   }
    pipeline->base.shaders[MESA_SHADER_COMPUTE] =
       radv_shader_create(device, cache, cs_binary, skip_shaders_cache, &cs_dbg);
```

The graphics caller (radv_pipeline_graphics.c:2562) and the ray-tracing caller
(radv_pipeline_rt.c:659) need the same treatment, and `radv_rt_spirv_to_nir` returns void so it
needs a way to signal failure. Happy to extend the patch to cover those if that shape is wanted.

Disclosure: this report was prepared with AI assistance. A human verified the reproduction,
the source trace, the local patched and unpatched builds, and the backtrace.
~~~

### New-issue draft for vkd3d-proton (do not file as-is)

~~~md
Title: Unstructured SPIR-V emitted for a Godot 4.7 D3D12 compute shader is rejected by spirv-val

vkd3d-proton 3.1.0 (build 2c7ba22c5326145, Proton Experimental experimental-11.0-20260805)
generates one compute SPIR-V module that fails `spirv-val`. RADV then crashes translating it,
though that crash is separately a driver robustness bug.

Affected title: `Horse Magnifier` (Steam appid 4585340, buildid 24643098), a Godot Engine
4.7.1 game exported with the D3D12 rendering driver. The game exits with status 3 about five
seconds after launch, with no error dialog.

## Validation error

Dumping with `VKD3D_SHADER_DUMP_PATH` produces 109 modules. Exactly one is rejected:

```
$ spirv-val --target-env vulkan1.3 d8693a43c4e96bff.spv
error: line 2887: block <ID> '2965[%2965]' exits the selection headed by <ID> '2880[%2880]',
       but not via a structured exit
  %2965 = OpLabel
```

The module is `OpEntryPoint GLCompute %main` with `OpExecutionMode %main LocalSize 64 1 1`.

## The malformed region

Block `%2880` opens a selection that must merge at `%3009`:

```
%2880 = OpLabel
        ...
        OpSelectionMerge %3009 None
        OpBranchConditional %737 %3003 %2881
```

Block `%2965` is inside that selection but branches to `%2966`, the merge block of the
enclosing selection, bypassing `%3009`:

```
%2965 = OpLabel
        ...
        OpBranch %2966
%3009 = OpLabel
        OpUnreachable
```

`%3009` survives only as `OpLabel` followed by `OpUnreachable`.

I have not validated the corresponding DXIL input or reproduced the conversion outside the
game, so I cannot say which pass produced this graph. The `.dxil` and `.spv` from the dump
are available on request.

## Workaround

Forcing Godot's Vulkan rendering driver (`--rendering-driver vulkan`) avoids vkd3d-proton
entirely. The game then launches, reaches its title screen and renders animated frames,
where before it exited after about five seconds. Play beyond the title screen was not tested.

Disclosure: this report was prepared with AI assistance. A human verified the reproduction,
the validator output, and the workaround.
~~~
