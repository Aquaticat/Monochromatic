# Depot frozen Rust coverage research

## Research boundary

The coordinator transferred this area after the completed
[reuse campaign](depot-reuse-strategy-research.md).
The source remains `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
Main-worktree changes are documentation and evidence only;
executable harnesses use the retained,
solely owned `research/depot-reuse-20261018` worktree.

The cumulative conservative compute proxy begins at USD 1.407,
leaving USD 3.593 beneath the USD 5 ceiling.
At most two owned cloud jobs may run simultaneously.
Each new bounded profile must retain its declared resources,
published-rate reservation,
source/tool hashes and actual provider identifiers before results are compared.
No new Rust coverage allocation has been launched at this checkpoint.

## Source catalog checkpoint

An uncapped `rg --files --hidden --no-ignore --glob Cargo.toml package`
returns 23 manifests in the isolated frozen checkout.
The tracked immutable tree contains the same manifest paths and no root `Cargo.toml`.
Those are source inventory facts,
not passing test or build credit.

The first metadata pass stopped when Python 3.14's `tomllib` rejected
`package/desktop-app/ide/Cargo.toml:68` with
`Invalid initial character for a key part (at line 68, column 105)`.
That line uses an inline-table trailing comma.
The repository already documents this
[TOML version boundary](../troubleshooting/taplo-toml-1-1-inline-table-trailing-comma.md).
The inventory must use Cargo's actual parser before classifying that source as invalid.
The installed `cargo read-manifest --help` exposes a frozen,
offline manifest-reader invocation and marks it deprecated in favor of metadata.
Any use here is an inventory probe,
not a proposed production tooling replacement.

## Owned work queue

- Classify every standalone manifest,
  its actual Mise owners,
  source/dependency/toolchain hashes,
  targets and runtime prerequisites.
- Match prior exact-source evidence by its input hashes and command boundary before assigning carryover credit.
- Build and consume the current rust-analyzer-backed `monochromatic-lint` source,
  including its actual Nextest and executable consumers.
  The published `0.1.3` tool in the preceding campaign was a prerequisite,
  not current-source linter coverage.
- Exercise applicable active standalone crate owners through Nextest,
  retaining real failures,
  ignored cases and compilation prerequisites separately.
- Exercise `cli/forbidden-strings.fuzz`,
  `git-policy/cli.fuzz`,
  `linter/monochromatic-lint.fuzz`,
  `rust-module/forbidden-regex.fuzz` and `rust-module/jsonc-edit.fuzz`.
  Inspect the actual owning tasks and target bodies first;
  preserve the GNU target,
  AddressSanitizer,
  planted controls and explicit runtime limits.
- Hash committed seed corpora before and after;
  direct generated seeds,
  mutations and crash artifacts only into owned writable state.
- Reconcile raw command,
  source,
  artifact and cleanup receipts;
  lint and render the resulting documents before closing the campaign.

The separate platform investigation's `depot cargo` command configures local Cargo with sccache.
It does not introduce another remote compiler pool.
Its [wrapper source audit](../troubleshooting/depot-cargo-cache-wrapper.md)
also records authentication precedence and removal of inherited `SCCACHE_*` tuning.
Any use must preserve this campaign's isolated cache namespace and job-scoped credential boundary.
