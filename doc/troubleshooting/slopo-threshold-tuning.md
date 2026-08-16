# Slopo 0.4.0: raising a threshold for one incidental match hides useful reports

## Symptom

Slopo reports the two `fix` callbacks in
`package/oxlint-plugin/stylistic/src/rule/block-body-newline.ts` as cluster
`6be7f9516c9d` with displayed score `0.96`.
The callbacks share Oxlint fixer scaffolding but use different ranges and indentation.
A global threshold increase can remove this report,
but it also removes unrelated reports that contain substantive shared behavior.

The effective repository configuration reported by `slopo show-config` is:

```text
similarity_threshold: 0.92
rerank_threshold: 0.94
body_node_count_threshold: 13
```

Against the copied current index and ignore file,
the baseline produced `355` clusters.
Changing only `similarity_threshold` to `0.97` produced `225` clusters.
Changing only `rerank_threshold` to `0.97` produced `288` clusters.
The target cluster disappeared in both probes.

## Root cause

This is expected threshold behavior,
not a Slopo defect.
The displayed score is insufficient for deciding a global cutoff because Slopo applies two
non-semantic filters and rounds report scores.

### Raw similarity is filtered before clustering

In [Slopo v0.4.0][slopo-release],
`src/slopo/analysis/command.py:34-53` finds raw-similarity pairs,
clusters those pairs,
reranks them,
and then applies the second threshold:

```python
pairs = find_similar_pairs(embeddings, cfg.similarity_threshold, _BLOCK_SIZE)
# ...
clusters = build_clusters(pairs)

reranked_pairs = rerank_all_clusters(clusters, pairs, units)
clusters = reorder_clusters(clusters, reranked_pairs)
clusters = filter_clusters(clusters, cfg.rerank_threshold)
```

`src/slopo/analysis/similarity.py:18-23` applies `similarity_threshold` directly to cosine similarity:

```python
block = matrix[start:end] @ matrix.T
rows, cols = np.where(block >= similarity_threshold)
```

Raising this threshold changes graph edges before clustering.
It can therefore split or remove clusters rather than merely trim the end of the report.

### Reranking rewards source proximity, not semantic confidence

`src/slopo/analysis/rerank.py:18-27` multiplies cosine similarity by a location boost:

```python
def rerank_pair_score(
    pair: SimilarPair,
    unit_a: UnitRecord,
    unit_b: UnitRecord,
) -> float:
    if unit_a.file_path == unit_b.file_path:
        b = boost.same_file(_line_distance(unit_a, unit_b))
    else:
        b = boost.cross_dir(path_hops(unit_a.file_path, unit_b.file_path))
    return pair.similarity * (1 + b)
```

For same-file units,
`src/slopo/analysis/boost.py:8,16-18` advances the boost in `250`-line steps:

```python
_SAME_FILE_STEP_LINES = 250

def same_file(line_distance: int) -> float:
    steps = line_distance // _SAME_FILE_STEP_LINES
    return _distance_boost(steps, _SAME_FILE_MAX_STEPS, _SAME_FILE_MAX_BOOST)
```

Cluster `6be7f9516c9d` has a `33`-line gap,
so it receives no location boost.
Its raw and reranked score is `0.962768257`.
A cutoff greater than that value removes it,
but the cutoff does not know why the similarity is incidental.

### Reports round scores

`src/slopo/analysis/report/markdown.py:92-95` formats scores to two decimal places:

```python
def _similarity_range(cluster: Cluster) -> str:
    if cluster.min_similarity == cluster.max_similarity:
        return f"{cluster.min_similarity:.2f}"
    return f"{cluster.min_similarity:.2f}-{cluster.max_similarity:.2f}"
```

The displayed `0.96` therefore does not identify the exact cutoff needed to suppress a pair.
It also cannot distinguish shallow scaffolding from useful shared behavior.

### Ignore hashes are the intended review mechanism

Slopo applies reviewed cluster hashes after thresholding and clustering at
`src/slopo/analysis/command.py:63-69`:

```python
ensure_ignore_file(cfg.ignore_file)

ignored = load_ignored(cfg.ignore_file)
if ignored:
    kept = [c for c in clusters if cluster_hash(c, units) not in ignored]
```

The upstream workflow explicitly says that not every similar pair is actionable and directs reviewers
to add discarded cluster hashes to `slopo.ignore.txt`
(`README.md:89-94`).
The repository already categorizes comparable tiny fixer matches under
`BOILERPLATE-TRIVIAL` in `slopo.ignore.txt:197-253`.

## Verification

Verified against:

- installed Slopo `0.4.0`,
   Python `3.14.6`,
   and SQLite `3.51.2`;
- upstream tag `v0.4.0`,
   commit `9b6296f2a6ab5e10cfdae7d6ed521f9bf3cb79fa`;
- copied repository index containing `8,528` code units and `8,309` embedded units;
- repository source and reports as of `2026-08-16`.

All threshold probes used a copied database,
a copied ignore file,
and separate report directories under a private throwaway directory.
They did not mutate the repository index or reports.

The probe configuration varied only these values:

```yaml
# Baseline
similarity_threshold: 0.92
rerank_threshold: 0.94

# Raw-similarity probe
similarity_threshold: 0.97
rerank_threshold: 0.94

# Rerank probe
similarity_threshold: 0.92
rerank_threshold: 0.97
```

The analysis command for each copied configuration was:

```bash
slopo --config /path/to/throwaway-config.yaml analyze
```

### Visible at current thresholds

These reports demonstrate that the low-score band contains both incidental scaffolding and substantive duplication:

- `0.962768257`,
   block-body opening and closing fixer callbacks:
  incidental framework shape;
- `0.964223504`,
   duplicate `resolveAddressFamily` implementations in
  `resolve_hosts.ts` and `resolve_storagebox_hosts.ts`:
  substantive shared behavior;
- `0.960972667`,
   duplicate checkbox and radio question CSS builders:
  substantive shared styling;
- `0.947156966`,
   duplicate attached-comment scans in `build-comments.ts` and `comments.ts`:
  substantive shared traversal;
- `0.940766573`,
   parallel JSON HTTP clients in `client-http.ts` and `exa-http.ts`:
  substantive transport behavior.

### Suppressed at a `0.97` threshold

Both `similarity_threshold: 0.97` and `rerank_threshold: 0.97` suppress every pair in the preceding catalog.
The raw-similarity probe removed `130` baseline clusters.
The rerank probe removed `67` baseline clusters.

The exact pair scores were calculated directly from the copied database embeddings with the same cosine formula and
boost functions used by Slopo.
The target pair was also absent from both generated report directories.

## Verified workarounds

### Dismiss the reviewed cluster hash

Add the following entry under `BOILERPLATE-TRIVIAL` in `slopo.ignore.txt`:

```text
# block-body opening/closing fixer stubs, different ranges and indentation
6be7f9516c9d
```

This removes only the reviewed cluster.
Its tradeoff is intentional:
editing either body or moving either path changes the hash,
so Slopo asks for review again.

### Raise thresholds only after labeled calibration

A global threshold can be appropriate if a reviewed sample shows that an entire score band lacks useful reports.
Calibrate both thresholds separately because they run at different pipeline stages.

The tradeoff is lower recall across the repository.
Changing `similarity_threshold` can also alter multi-unit cluster membership and therefore cluster hashes because it
filters graph edges before clustering.

### Raise the body-node threshold only for globally unwanted tiny units

`body_node_count_threshold` is a better-shaped control when the unwanted population is consistently tiny functions,
not merely low-scoring functions.
The target callbacks each contain `16` body nodes.

The tradeoff is that every smaller code unit disappears regardless of semantic value.
Slopo also requires re-indexing and re-embedding after this setting changes,
as documented in `README.md:104-120`.

## What does not work

### Treating the displayed score as semantic confidence

The score measures embedding proximity plus an optional location boost.
It is not a probability that refactoring is warranted.
Its two-decimal rendering also hides the exact cutoff.

### Raising a global threshold to dispose of one reviewed cluster

The `0.97` probes suppressed substantive resolver,
CSS,
comment traversal,
and HTTP transport pairs alongside the target fixer callbacks.
This trades a local review decision for repository-wide false negatives.

### Extracting a helper solely to silence the report

A helper would accept a fixer,
a range,
and indentation merely to wrap one `replaceTextRange` call.
It would add a shallow interface while coupling opening and closing boundary policies that can evolve independently.

## Upstream filing artifact

### Upstream filing decision

1. **Is it really upstream's fault?**
    No.
   Both threshold behavior and hash-based dismissal are documented Slopo workflows.
2. **Can upstream fix it?**
    No defect was identified.
   A semantic refactoring verdict cannot be derived from cosine similarity alone.
3. **Are they supporting this use case?**
    Yes.
   `README.md:89-94` explicitly expects reviewers to dismiss non-actionable clusters by hash.
4. **Would the repository welcome a contribution?**
    No restriction was found,
   but the repository contains no `CONTRIBUTING.md`,
    issue template,
    or pull request template.
5. **Will they likely fix it?**
    Not applicable because there is no defect or missing documented mechanism.
6. **Have we prototyped a minimal fix?**
    Not applicable because constraint one fails.

No matching threshold or reranking issue or pull request was found in open or closed tracker searches on
`2026-08-16`.
The repository has no matching `.out-of-scope/` exemption.
There is nothing additive to file upstream,
so no issue or comment draft is retained.

[slopo-release]: https://github.com/rafal-qa/slopo/releases/tag/v0.4.0
