# What:  baked image that runs mutation testing for forbidden-regex.
# Why:   cargo-mutants compiles and runs MUTATED source, i.e. arbitrary and
#        unpredictable code, which must never execute on the host. This image is the
#        disposable sandbox; the `test:mutation` mise task runs cargo-mutants only here.
# A recent stable Rust satisfies edition 2024 and builds the crate's stable-only deps.
FROM docker.io/library/rust:1

# Bake cargo-mutants so a run is one `podman run` with no in-container install step.
# `--locked` pins its own dependency versions for a reproducible tool build.
RUN cargo install cargo-mutants --locked
