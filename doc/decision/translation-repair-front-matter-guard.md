# Front-matter publication guard: structural checks only

Decided by the owner on 2026-09-02, in answer to the question whether a page whose metadata equals the
archive's should be refused, published when a panel chose the keep, or published outright. The owner's
answer was to the premise: "why are we caring about metadata being different vs Chinese source at all?"
Landed as commit `34e5c7ecd` in `package/module/translation-repair/src/corpus-run/front-matter-completeness.ts`.

## The rule

`assertFrontMatterComplete` refuses a page only on structural grounds:

- `missing-slice`: the preparation carries no metadata slice, or carries it anywhere but slice zero over
  exactly the two sides' front-matter bytes.
- `invalid-page`: the page's metadata does not parse, or breaks the identity rule (source name equal to
  alias requires the same on the page) or the contributor-attribution rule in
  `validateFrontMatterTranslation`.
- `directory-id-name`: the page's visible `name` is the entry's directory id while the source's is not,
  checked on the assembled page whether or not it equals the archive byte for byte. Narrowed by
  `6d85b619a` on a census of the pinned corpus: 23 of 92 archives name the directory, and 8 of them
  (Anilovr, Arita, ArtsEpiphany, Hangmster, keyword233, Mio, mone, s5ehfr9) do so in the source too,
  because the handle is the person's name; the page-only form of `34e5c7ecd` would have refused those
  eight forever.

Whether the lanes kept the archive's metadata or replaced it is not a question the guard asks. The lanes,
the lane contest and the consolidation gate judge the metadata slice like every other slice, and the
artifact keeps their records for the reading.

## What it replaces

The rule of 2026-08-28 (`69df7d881`, "review visible front matter", written for #269, archives whose
metadata was never translated and still named the directory id) refused any page whose metadata equalled
the archive's while the source's differed, reading that as nobody having reviewed the slice. Chinese and
English metadata always differ, so the trigger fired on every kept incumbent: it discarded the Carena0442
pass of 2026-09-02 after 94 minutes, and would have discarded the Toka_ls relaunch, whose consolidation
gate kept the archive six ballots to two with reasons.

Three commits that night (`daaf0ffa0`, `6f70a2085`, `1160ebb4c`) replaced the byte comparison with a
reading of which panel had chosen the keep (translate judges, every heard translator, lane contest,
consolidation slate, consolidation gate). They answered the question well, and the question only existed
because of the proxy. They were removed with the proxy. The reading of the Toka_ls run that motivated them
is in `doc/planning/translation-repair-toka-ls-reading-2026-09-02.md`; the night's record is in
`doc/planning/translation-repair-roster-calibration-2026-09-01.md`.

## Consequences

- A hold-starved judge indecision on the metadata slice publishes the archive's metadata as it stands, as
  it does for any other slice. The artifact records the indecision; the reading catches it.
- The directory-id refusal is wider than before in one direction and narrower in another: it fires on any
  assembled page whose visible name is the directory id, not only on a byte-equal keep, and it does not
  fire where the source names the person by that same handle. The 15 archives that show the directory id
  where the source has a name of its own (the #269 shape) stay refused until a lane renders the name.
- `FrontMatterCompletenessError` carries no decision detail any more; its message names the entry and the
  structural reason only.
