# RADV 26.1.5 segfaults in `radv_shader_spirv_to_nir` when vkd3d-proton emits unstructured SPIR-V

Mesa's RADV driver dereferences the NULL that `spirv_to_nir()` returns on failure,
so any Vulkan application that submits a SPIR-V module RADV cannot translate
dies with `SIGSEGV` instead of receiving a `VkResult`.

vkd3d-proton 3.1.0 emits one such module when translating a Godot 4.7.1 D3D12 compute shader,
which makes Godot games exported with the D3D12 rendering driver quit silently a few seconds after launch.

Observed with the Steam game `Horse Magnifier` (appid `4585340`, buildid `24643098`),
but nothing in the failure is specific to that title.

## Symptom

The game launches, shows no window, and exits with status `3` roughly five seconds later.
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

With `PROTON_LOG=1`, the Proton log carries the only diagnostic:

```text
err:vulkan:vkCreateComputePipelines Exception 0xc0000005 in Unix call.
```

Wine's exception record identifies the access precisely.
`info[0]=1` means a write, and `info[1]=0x40` is the faulting address,
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

### Step 1: vkd3d-proton emits SPIR-V that violates structured control flow

Dumping every module vkd3d-proton generates for this game
(`VKD3D_SHADER_DUMP_PATH`, see "Verification")
yields 109 SPIR-V modules.
Exactly one fails validation:

```text
$ spirv-val --target-env vulkan1.3 d8693a43c4e96bff.spv
error: line 2887: block <ID> '2965[%2965]' exits the selection headed by <ID> '2880[%2880]',
       but not via a structured exit
  %2965 = OpLabel
```

That module is a compute shader, which matches the entry point that crashes:

```text
OpEntryPoint GLCompute %main "main" %gl_GlobalInvocationID
OpExecutionMode %main LocalSize 64 1 1
```

The defect is a jump out of an inner selection construct straight to an outer merge block.
Block `%2880` opens a selection that must merge at `%3009`:

```text
%2880 = OpLabel
        ...
        OpSelectionMerge %3009 None
        OpBranchConditional %737 %3003 %2881
```

Block `%2965` sits inside that selection but branches to `%2966`,
which is the merge block of the enclosing selection, bypassing `%3009` entirely:

```text
%2965 = OpLabel
 %741 = OpPhi %10 %341 %2885 %1238 %2964
        ...
        OpBranch %2966
%3009 = OpLabel
        OpUnreachable
```

The stranded `%3009` block, reduced to `OpLabel` followed by `OpUnreachable`,
is the signature of a structurizer that rerouted control flow to an outer merge
and left the inner merge unreachable.

### Step 2: `spirv_to_nir()` rejects the module and returns NULL

Mesa's SPIR-V front end refuses to translate the construct and returns NULL.
The return value is documented as nullable by its own failure paths in
`src/compiler/spirv/spirv_to_nir.c`.

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

With `rax` holding the NULL return, that instruction writes to address `0x40`,
matching `info[0]=1` (write) and `info[1]=0x40` (address) from the exception record.

The `assert` on the following line would have caught the NULL,
but Mesa release builds compile with `NDEBUG`, so it is absent from the shipped driver.

### Confirming the symbol names

The shipped Terra build is stripped and its build-id
(`95992bc9dc5e7ae821f4d7a58fd0950239c8d7aa`) is not served by any debuginfod,
so the frames were resolved two independent ways that agree.

The seven-byte instruction sequence at the fault is unique in both the installed 26.1.5 build
and the 26.1.6 build that Terra still ships debuginfo for,
which lets the symbol transfer across builds:

```bash
# 440850404889c3 == "or %r10b,0x40(%rax); mov %rax,%rbx"
# one hit at 0x13e240 in 26.1.5, one hit at 0x13e6c0 in 26.1.6
addr2line --functions --exe libvulkan_radeon.so-26.1.6-3.fc44.x86_64.debug 0x13e6c0
# radv_shader_spirv_to_nir
# .../src/amd/vulkan/radv_shader.c:543
```

The standalone harness then produced a real core dump whose frames match
the Proton backtrace offset for offset:

```text
#0  0x00007fe78b12c240 radv_shader_spirv_to_nir     (libvulkan_radeon.so + 0x13e240)
#1  0x00007fe78b109c6b radv_compile_cs              (libvulkan_radeon.so + 0x11bc6b)
#2  0x00007fe78b10a294 radv_compute_pipeline_compile (libvulkan_radeon.so + 0x11c294)
#3  0x00007fe78b10a51a radv_compute_pipeline_create  (libvulkan_radeon.so + 0x11c51a)
#4  0x00007fe78b10a73b radv_CreateComputePipelines   (libvulkan_radeon.so + 0x11c73b)
```

### Two earlier readings were wrong

The first backtrace, taken with Steam's default layer set, contained a sixth frame:

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
declares `disable_environment` with no `enable_environment`
and therefore loads into every Vulkan application.

Running with `VK_LOADER_LAYERS_DISABLE='~implicit~'` falsified both readings at once.
The crash was unchanged at byte-identical RADV offsets,
and the Fossilize frame disappeared from the backtrace,
proving the variable took effect and that no layer participates in the fault.

## Verification

### Versions under test

- Mesa `mesa-vulkan-drivers-26.1.5-2.fc44.x86_64`, vendor Terra,
  build-id `95992bc9dc5e7ae821f4d7a58fd0950239c8d7aa`, `driverVersion` 109056005.
- Mesa source at tag `mesa-26.1.5`, commit `6a02618ccf6c5651ecb9cccbde571eb61fd73592`,
  from `https://gitlab.freedesktop.org/mesa/mesa.git`.
- Mesa `mesa-vulkan-drivers-26.1.6-3.fc44.x86_64`, `driverVersion` 109056006, also affected.
- Proton Experimental build `1785947781`, `experimental-11.0-20260805`.
- vkd3d-proton `3.1.0`, build `2c7ba22c5326145`.
- Steam Linux Runtime `4.0.20260714.251823`, pressure-vessel `0.20260714.0`.
- AMD Radeon RX 7600, `RADV NAVI33`, PCI `1002:7480`, kernel `7.1.3-ogc5.1.fc44.x86_64`.

### Harness one: standalone, no Wine, no Steam

[radv-spirv-to-nir-null-deref.c](radv-spirv-to-nir-null-deref.c) creates a Vulkan device,
builds a pipeline layout covering the module's three descriptor sets,
and calls `vkCreateComputePipelines` on a single SPIR-V module.
[radv-spirv-to-nir-null-deref.spv](radv-spirv-to-nir-null-deref.spv) is the offending module.

Run from the repository root, building into a scratch path so nothing lands in the tree:

```bash
gcc -O0 -g -o "${HOME}/temp/agent/radv-spirv-null-repro" \
  doc/troubleshooting/radv-spirv-to-nir-null-deref.c -lvulkan
"${HOME}/temp/agent/radv-spirv-null-repro" doc/troubleshooting/radv-spirv-to-nir-null-deref.spv
```

Result on 26.1.5 and on 26.1.6:

```text
device: AMD Radeon RX 7600 (RADV NAVI33) (driver 109056005)
calling vkCreateComputePipelines...
Segmentation fault (core dumped)
```

Any valid module from the same dump is the positive control and returns cleanly:

```text
device: AMD Radeon RX 7600 (RADV NAVI33) (driver 109056005)
calling vkCreateComputePipelines...
survived: VkResult 0 (expected a clean error, not a crash)
```

To test a Mesa build that is not installed system-wide,
rewrite `library_path` in `radeon_icd.x86_64.json` to an absolute path
and point the loader at it with `VK_DRIVER_FILES`.

### Harness two: the game under Proton

Reproduces the original failure end to end, and regenerates the shader dump.

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

108 of the 109 dumped SPIR-V modules pass `spirv-val --target-env vulkan1.3`
and compile through `vkCreateComputePipelines` without incident.
Godot's Vulkan rendering driver produces no invalid module at all,
which is why the Vulkan backend never triggers this path.

### Modules that fail

One module, dumped as `d8693a43c4e96bff.spv`,
a `GLCompute` entry point with `LocalSize 64 1 1`.
It is the only structured-control-flow violation in the set,
and it is the module being compiled when the process dies.

## Verified workarounds

### Force Godot's Vulkan rendering driver (applied)

Godot's official Windows export templates contain both a D3D12 and a Vulkan backend,
and the rendering driver is selectable at runtime.
Steam per-game launch options:

```text
%command% --rendering-driver vulkan
```

This removes vkd3d-proton from the pipeline entirely,
so no DXIL to SPIR-V translation happens and no invalid module is produced.
Verified by launching from Steam: the game reaches its title screen,
renders animated frames, and stays alive indefinitely
where it previously exited after roughly five seconds.

Tradeoffs.
The Vulkan and D3D12 backends are separate code paths in Godot,
so renderer-specific bugs and performance characteristics change,
and any game-side behaviour tuned against D3D12 is no longer what runs.
The setting is per game, so every affected title needs its own launch option.
Clearing the launch options field silently restores the crash.
Godot builds exported without the Vulkan backend cannot use this at all.

### Report the shader to the game's developer

The invalid SPIR-V is generated from one specific Godot compute shader.
Restructuring that shader upstream in the game would avoid the construct.
This is only actionable by the game's developer and is listed for completeness.

## What does not work

- Disabling Steam's shader pre-caching layer with
  `DISABLE_VK_LAYER_VALVE_steam_fossilize_1=1`.
  The crash is unchanged.
  Fossilize appears in the first backtrace only because it hooks the entry point.
- Disabling every implicit Vulkan layer with `VK_LOADER_LAYERS_DISABLE='~implicit~'`,
  which covers Fossilize, the Steam overlay, MangoHud, vkBasalt, OBS capture,
  gamescope WSI, Mesa device-select, and the Lossless Scaling frame-generation layer.
  The crash is unchanged at identical offsets.
- Deleting the `vkd3d-proton.cache` file from the game directory.
  The file is generated locally rather than shipped,
  and removing it reproduces the same crash at the same offset.
- Updating Mesa from 26.1.5 to 26.1.6.
  Measured with the standalone harness against the extracted 26.1.6 driver: still segfaults.
  The commit range `mesa-26.1.5..mesa-26.1.6` touches nothing in this path,
  and the unchecked dereference is still present in Mesa `main` today
  at `src/amd/vulkan/radv_shader.c:539`.
- Reading Mesa's issue tracker directly.
  `gitlab.freedesktop.org` is behind Anubis, which refused both `WebFetch`
  and `agent-browser`, so live maintainer discussion could not be checked.

## Upstream filing artifact

### Upstream filing decision

`.out-of-scope/` was checked before drafting.
No exemption covers Mesa, RADV, vkd3d-proton, Proton, or graphics drivers as a class,
so upstream tracking is in scope for this bug.

Two candidate upstreams exist, and the audit lands differently for each.

Duplicate search.
For vkd3d-proton, `gh search issues --repo HansKristian-Work/vkd3d-proton`
was run over both open and closed state for `spirv structured control flow` and for `godot`,
returning nothing.
The same command with the term `crash` returns results,
so the empty result is a real absence and not a broken query.
For Mesa, a web search surfaced issue `4740`,
"the new spirv to nir compiler after 20.2 causes a null pointer which cashes the radv driver",
which reports the same class of NULL dereference from 2021.
The issue body could not be read because Anubis blocked direct access,
so its resolution and any maintainer position are unverified.

#### Mesa and RADV: do not file

1.  Is it really upstream's fault?
    Soft yes.
    Vulkan requires applications to submit valid SPIR-V and permits drivers to assume validity,
    so a crash on invalid input is arguably outside the contract.
    Against that, Mesa's own `spirv_to_nir()` defines a NULL failure return
    that RADV then ignores, which is an internal inconsistency regardless of the input.
2.  Can upstream fix it?
    Yes.
    A NULL check that frees `spec_entries` and returns the existing failure path is small.
3.  Are they supporting this use case?
    Partially.
    RADV makes no robustness promise against invalid SPIR-V.
4.  Would the repo welcome our contribution?
    Unverified.
    `docs/submittingpatches.rst` documents the merge-request process,
    and no AI-assistance policy exists anywhere in the tree at tag `mesa-26.1.5`,
    but the live tracker and any recent policy could not be read because of Anubis.
5.  Will they likely fix it?
    Leaning no.
    Issue `4740` reported this class in 2021,
    and the unchecked dereference is still present in `main` today.
    That is the "actively leaning no" signal the constraint asks for.
6.  Have we prototyped a minimal fix?
    No.
    Verifying a Mesa patch requires building Mesa, which was not attempted.

Constraint 5 leans no and constraint 6 is unmet, so nothing is filed against Mesa.

#### vkd3d-proton and dxil-spirv: draft kept, not fileable yet

1.  Is it really upstream's fault?
    Yes.
    They emit SPIR-V that fails `spirv-val`.
2.  Can upstream fix it?
    Yes, in the dxil-spirv structurizer.
3.  Are they supporting this use case?
    Yes.
    Running D3D12 titles under Proton is the project's stated purpose,
    and the tracker carries many per-game crash reports.
4.  Would the repo welcome our contribution?
    Likely yes.
    The tracker is open and active, and per-game crash reports are routine there.
    No policy against outside or AI-assisted reports was found.
5.  Will they likely fix it?
    Plausible.
    No existing issue covers it and development is active.
6.  Have we prototyped a minimal fix?
    No.
    The fix belongs in the dxil-spirv control-flow structurizer,
    which was not prototyped.

Constraints 1 to 5 hold, so the draft is kept.
Constraint 6 is unmet, so it is marked do not file as-is.
A future session that prototypes a structurizer fix can file the draft unchanged.

### New-issue draft for vkd3d-proton (do not file as-is)

~~~md
Title: Unstructured SPIR-V emitted for a Godot 4.7 D3D12 compute shader crashes RADV

Labels: bug

vkd3d-proton 3.1.0 (build 2c7ba22c5326145, Proton Experimental experimental-11.0-20260805)
generates one compute SPIR-V module that fails `spirv-val`, which crashes Mesa RADV
during `vkCreateComputePipelines`.

Affected title: `Horse Magnifier` (Steam appid 4585340, buildid 24643098),
a Godot Engine 4.7.1 game exported with the D3D12 rendering driver.
The game exits with status 3 about five seconds after launch, with no error dialog.

## Validation error

Dumping with `VKD3D_SHADER_DUMP_PATH` produces 109 SPIR-V modules.
Exactly one fails validation:

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

Block `%2965` is inside that selection but branches to `%2966`,
the merge block of the enclosing selection, bypassing `%3009`:

```
%2965 = OpLabel
 %741 = OpPhi %10 %341 %2885 %1238 %2964
        ...
        OpBranch %2966
%3009 = OpLabel
        OpUnreachable
```

`%3009` is left as `OpLabel` followed by `OpUnreachable`,
which suggests the structurizer rerouted control flow to the outer merge
and left the inner merge stranded.

## Resulting driver crash

Mesa's `spirv_to_nir()` returns NULL for this module, and RADV dereferences it
without checking at `src/amd/vulkan/radv_shader.c:543` (tag `mesa-26.1.5`),
so the process takes SIGSEGV writing to address 0x40 rather than getting a VkResult.

Reproducible standalone with no Wine or Steam involved, on Mesa 26.1.5 and 26.1.6,
AMD Radeon RX 7600 (RADV NAVI33): a minimal program that calls
`vkCreateComputePipelines` on the dumped module segfaults, while every other
module from the same dump returns `VK_SUCCESS`.

The driver crash is arguably Mesa's to harden, but the invalid module is the trigger.

## Workaround

Forcing Godot's Vulkan rendering driver (`--rendering-driver vulkan`) avoids vkd3d-proton
entirely and the game runs normally.

## Suggested fix

In the dxil-spirv control-flow structurizer, the branch from `%2965` should target
the innermost enclosing merge (`%3009`) and let that construct fall through to `%2966`,
rather than branching directly to the outer merge and leaving `%3009` unreachable.

Disclosure: this report was prepared with AI assistance. A human verified the
reproduction, the SPIR-V validation output, the source trace, and the workaround.
~~~
