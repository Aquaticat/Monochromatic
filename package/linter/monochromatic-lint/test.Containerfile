# Pinned installed Rust image makes the compiler part of reproducible fixture evidence.
FROM 62ba2f7ce22ba9bc501110d3452c7ae814fba367c46f7eea3629a79286353884
COPY jsonc-edit /work/package/rust-module/jsonc-edit
COPY monochromatic-lint /work/package/linter/monochromatic-lint
WORKDIR /work/package/linter/monochromatic-lint
ENV CARGO_BUILD_JOBS=2
CMD ["cargo", "test", "--offline", "--locked", "--all-targets", "--", "--test-threads=2"]
