# Shared input content pages

The input ledger preserves original occurrences and complete immutable text.
Sharing text alone does not share the arrays that describe each snapshot.
The configured replay heap reaches those arrays through the manager's constructed-input reader,
the content store's `contents` map,
and each content reader's `chunks` closure.

The isolated sequence probe retains changing versions of a JSON catalog.
With 24 versions and 16,000 entries,
the original implementation retains 24,589,536 bytes.
Identical-input controls retain 1,091,016 and 1,029,504 bytes,
a spread of 61,512 bytes.
Every reconstructed version matches its original SHA-256 digest.
The changing-input case fails the eight-MiB additional-storage regression budget.
Receipt: `content-sequence-before.log` in the session's private verification directory.

`input-content-pieces.ts` owns detached chunks and immutable pages of at most 256 chunk references.
Complete versions retain page references.
Unchanged pages reuse their reference arrays as well as their text.
JSON arrays of original ordinals establish exact structural equality at both levels.
The existing UTF-8 digest remains metadata,
so distinct unpaired UTF-16 surrogates with identical UTF-8 digests remain distinct.

`input-content.ts` owns content-reader reuse and the original source/accessor identity check.
The reader reconstructs the original code units from pages without retaining its temporary serialization.
Source publications and occurrences remain independent of representation sharing.
Storage sharing grants no permission or instruction authority.

Fresh types,
exact-content and streaming consumers,
the sequence-capacity regression,
and a configured replay remain required after this checkpoint.
