# Depot standalone linker experiment

## Scope and execution manifest

This experiment exercises a useful standalone agent workload through Depot's Sandbox SDK.
It compares the same compiled scanner inputs through `lld` and `mold`;
it does not select or adopt a replacement linker.

The source archive contains `package/cli/forbidden-strings` and its path dependency
`package/rust-module/forbidden-regex` from trial commit `d6deca5fa5`.
No host home directory,
repository mount,
or release credentials enter the sandbox.
The SDK control process reads the existing Depot login locally.
The cloud workload receives no Depot token.

Sandbox `pt4gd92356psxm9` reports Ubuntu 24.04.5,
2 vCPUs,
2,048 MiB memory,
and 150 GB disk despite the requested 100 GB.
The sandbox expires after 45 minutes and is explicitly stopped after artifact retrieval.
Compilation and linking stay inside this resource boundary.

Setup uploads the existing local `mise` executable and immutable source archive.
Ubuntu package installation provides `lld`,
`mold`,
and compiler prerequisites;
`mise` installs Rust into the disposable environment.
Dependency downloads use the package's existing Cargo lockfile.
The runner records resolved tool versions and help before invoking linker options.

The controlled phase retains the final compiler-driver arguments and temporary object inputs,
warms each linker,
measures repeated unchanged-input baselines,
then alternates the two linkers with the same output destination.
It checks the produced scanner against passing and failing disposable inputs.
Raw timings,
input hashes,
output hashes,
and consumer results are retrieved before cleanup.
Timing differences are interpreted against the unchanged-input spread.

## Status

The standalone sandbox and operating-system probe passed.
Tool provisioning and workload execution are in progress.
