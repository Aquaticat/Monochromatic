# Pinned installed Rust image makes the compiler part of reproducible fixture evidence.
FROM 62ba2f7ce22ba9bc501110d3452c7ae814fba367c46f7eea3629a79286353884
COPY vendor /work/vendor
COPY cargo-config /work/.cargo
COPY clippy.toml /work/clippy.toml
COPY jsonc-edit /work/package/rust-module/jsonc-edit
COPY monochromatic-lint /work/package/linter/monochromatic-lint
WORKDIR /work/package/linter/monochromatic-lint
# Semantic-backend consumer controls used symbol-free development builds under the same memory cap.
ENV CARGO_BUILD_JOBS=2 CARGO_PROFILE_DEV_DEBUG=0 CARGO_INCREMENTAL=0
CMD ["cargo", "test", "--offline", "--locked", "--all-targets", "--", "--test-threads=2"]
