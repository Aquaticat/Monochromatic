# Translation repair handover snapshot: 2026-09-06, part 10

Part 10 of [Translation repair handover snapshot: 2026-09-06](translation-repair-handover-2026-09-06.md),
whose index lists every part in order.

## What to do next, continued

    hulicaijia31 launched 09:25 UTC on `.frozen-dist-eac0b67a8` (pid 669977,
    scope `pass-hulicaijia31`):
    read it for `request window is full` overflow lines,
    for no pacer wait longer than a few seconds
    holding a translate slice,
    and for the translate lane back near hulicaijia29's 25.7 min.
    HULICAIJIA31 READ (frozen `eac0b67a8`):
    SETTLED at 09:45 UTC 2026-09-26 in 19.3 min,
    about 2.81 USD;
    Hyper dry from the first reading (balance 0),
    so class one hundred forty-nine was NOT exercised live:
    the next run launched while Hyper reads wet is the one to read for `request window is full` lines;
    every hulicaijia30 check held;
    the scratch en_CA scan's `center`,
    `realize`,
    `mom` were false positives
    (a style attribute,
    "moment",
    Canadian -ize),
    corrected and proven by a positive control;
    recorded under "## hulicaijia31 read" in the pass log.
    HULICAIJIA30 READ (frozen `1f3d85c29`):
    SETTLED at 09:12 UTC 2026-09-26 in 100.6 min,
    about 2.38 USD plus Hyper's 208;
    class one hundred forty-eight never fired (Bedrock Gemma healthy,
    e2b 1.5 s mean);
    class one hundred forty-four not exercised again;
    the translate lane took 43.6 min because Hyper's 1,000-an-hour window filled by 08:04 UTC
    and one 1,640,012 ms pacer sleep held every Hyper call (class one hundred forty-nine);
    recorded under "## hulicaijia30 read" in the pass log.
    CLASS ONE HUNDRED FORTY-EIGHT BUILT (2026-09-26):
    a Bedrock Gemma call is cut at its card's measured `streamBoundMs`
    (60,000 ms on `google.gemma-4-e2b` and `google.gemma-4-26b-a4b`,
    `'unbounded'` elsewhere),
    and the router holds that provider out for that model for the model hold
    (`stream-bound.ts`,
    `stream-bound-hold.ts`,
    `provider-router.ts`,
    `bedrock-client.ts`);
    guard red first `2691bdf56`,
    fixed `1f3d85c29`,
    inventory `18d410df4`
    (the full suite was red at `1f3d85c29` on `message-names-only.unit.test.ts`;
    green at `18d410df4`,
    1149 PASS,
    0 FAIL),
    lint 0/0,
    types clean.
    hulicaijia30 launched 07:31 UTC on `.frozen-dist-1f3d85c29` (pid 3774525,
    scope `pass-hulicaijia30`):
    read it for `ran past the card's stream bound` lines and for class one hundred forty-four,
    which still needs an accepted `accuracy/addition` claim on chunk 69 to be exercised.
    HULICAIJIA29 READ (frozen `f31fd2ec5`):
    SETTLED at 07:09 UTC 2026-09-26 in 85.0 min,
    about 3.06 USD;
    every hulicaijia28 check held,
    footnote 7's note on the page;
    class one hundred forty-four NOT exercised (no issue filed on chunk 69;
    the slate kept the note 3 to 2);
    class one hundred forty-seven silent by design (the seven straight single quotes are the archive's JSX paths);
    class one hundred forty-eight found:
    Bedrock `google.gemma-4-e2b` at 219 to 263 s a stream from 06:05 to 06:55 UTC,
    24 deadline cuts at 360 s,
    rounds waiting on it for quorum with Synthetic and Hyper dry;
    recorded under "## hulicaijia29 read" in the pass log.
    XINGZ6013 READ (frozen `e387be2cf`):
    SETTLED at 04:32 UTC 2026-09-26 in 56.3 min;
    classes one hundred thirty-nine to forty-two live;
    class one hundred forty-five (a Han title as a link's whole text escaped the class ninety-eight floor,
    then the title pass doubled it) fixed in 9157004d2,
    guard dd88fd5b6;
    class one hundred forty-six (title-reference-ambiguous on slice 101 over several quote spans)
    fixed in 9157004d2 and d8d86b531;
    class one hundred forty-seven (a nested quotation shipped in straight single marks on a curly page)
    fixed in f4adc4c9f and f31fd2ec5,
    guard 09758edd6;
    full suites 1145 and 1146 PASS;
    recorded under "## XingZ6013 read" in the pass log.
    HULICAIJIA28 READ (frozen `e387be2cf`):
    SETTLED at 03:33 UTC 2026-09-26 in 24.4 min,
    about 2.83 USD;
    every hulicaijia27 check held,
    en_CA and register clean,
    footnote 7's note on the page (pinyin 烷 corrected to wán);
    class one hundred forty-four NOT exercised:
    gemma-4-26b-a4b-it filed the note as `accuracy/mistranslation`,
    accepted 3 to 1 (minimax-m3,
    gemma-4-26b-a4b-it,
    google.gemma-4-e2b for;
    deepseek-v4.1-flash against),
    so no dispute;
    the repair lane kept the note,
    the translate slate chose it 3 to 2,
    the lanes agreed,
    no contest;
    contest ballots carry `modelId` (223 of 223);
    recorded under "## hulicaijia28 read" in the pass log.
    HULICAIJIA27 READ (frozen `2472ec48e`):
    SETTLED at 03:02 UTC 2026-09-26 in 45.3 min,
    about 3.10 USD;
    every hulicaijia26 check held;
    footnote 7's note lost again,
    class one hundred forty-three NOT live:
    repair panel 3 to 2 (minimax-m3,
    gemma-4-26b-a4b-it,
    google.gemma-4-e2b for;
    deepseek-v4.1-flash,
    mercury-2.5 against),
    then the translate slate 4 to 0 (gemma-4-e2b,
    mercury-2.5,
    jev-1.13,
    minimax-m3) under the class one hundred eight dispute block,
    lanes agreed so no contest;
    recorded under "## Class one hundred forty-four" in the pass log.
    CLASS ONE HUNDRED FORTY-FOUR (2026-09-26):
    `archiveDisputeNote` bounded to narrative detail
    (`NARRATIVE_DETAIL_IS_NOT_APPARATUS`),
    a claimed gloss or `TRANSLATOR_NOTE_KIND` note sent back to the apparatus rule
    (guard `7869828fb`,
    fix `e387be2cf`,
    suite 1144 PASS).
    HULICAIJIA26 READ (frozen `0e0b05d0f`):
    SETTLED at 02:00 UTC 2026-09-26 in about 15 min,
    about 2.82 USD;
    every check held,
    class one hundred thirty-five live ("douhua" seven times,
    "Jiefangbei" on both lines);
    footnote 7's wordplay note lost (filed by deepseek-v4.1-flash,
    accepted by minimax-m3 and gemma-4-26b-a4b-it against Mercury 2.5,
    archive disputed,
    four of five contest ballots against it);
    recorded under "## Class one hundred forty-three" in the pass log.
    CLASS ONE HUNDRED FORTY-THREE (2026-09-26):
    `TRANSLATOR_NOTE_KIND` on the critic,
    panel,
    contest and apparatus wordings,
    `NARRATIVE_DETAIL_IS_NOT_APPARATUS` in place of "only what the ORIGINAL contradicts is an addition"
    (guard `4520367f0`,
    fix `2472ec48e`,
    suite 1144 PASS).
    Then `XingZ60` (run XingZ6013) to see classes one hundred thirty-nine to forty-two live:
    "—— Yuli [Paranoia]…" or the album kept on slice 98's credit,
    "by Jiecheng Tianzou Official" on the first credit,
    “Zero-Layer Prayer” in quotation marks on the second,
    with no English title left in 《》 anywhere on the page,
    and no straight prose quote on the page outside JSX and code ("take it slow",
    "doesn’t want to die").
    CLASS ONE HUNDRED FORTY-TWO (2026-09-26):
    `unifyQuoteStyle` curls each prose quote mark on every slice where the page's curly form outnumbers the straight
    (guard `c5a03ea2c`,
    fix `0e0b05d0f`,
    suite 1142 PASS plus the load-sensitive lane-contest grace case passing alone,
    replayed:
    XingZ6012 four blocks,
    lin10104 and shihai4h archives one apostrophe each).
    CLASS ONE HUNDRED FORTY-ONE (2026-09-26):
    `latinTitleFindings` refuses an English-only title set in 《》
    unless the replaced page writes it (guard `2999b2a45`,
    fix `8c8c7007b`,
    suite 1142 PASS,
    replayed over XingZ6012's credit line).
    LAUNCH IN A SCOPE (2026-09-26):
    hulicaijia21 died silently five minutes in when systemd-oomd killed the `claude-code-bash` cgroup it shared with a build;
    launch as `cd -- <pkg> && TRANSLATION_REPAIR_SLICE_OVERLAP=8 systemd-run --user --scope --unit=pass-<run> --quiet mise exec -- node <launch-pass.mjs> <run> <entry> <frozen-dir>`
    and confirm `/proc/<pid>/cgroup` names `pass-<run>.scope`.
    XINGZ6012 READ (frozen `c49ff687e`):
    SETTLED at 01:04 UTC 2026-09-26 in 32.0 min;
    class one hundred thirty-eight live (link and `[^9]` kept,
    no "Laizi");
    class one hundred thirty-nine (a page's `[album]` after the signer read into the name and deleted by the restore;
    `7292556b7`,
    suite 1140 PASS,
    replayed over slice 98)
    and class one hundred forty (「，作者」 rendered ",
    author";
    the rendering glossary refuses it,
    guard `186ad797a`,
    fix `5cb874a36`).
    XINGZ6011 READ (frozen `2d5113b7d`):
    INCOMPLETE at 00:26 UTC 2026-09-26 in 96.3 min,
    "would drop 1 source destination":
    the restore read 来自 as a signer and replaced the song credit,
    link and [^9] included,
    with "Laizi" (class one hundred thirty-eight,
    `c49ff687e`,
    guard `bffae3bce`,
    suite 1140 PASS).
    MAIN MERGED (owner,
    2026-09-26,
    "#563 is fixed in main branch.
    Merge main branch to this worktree's branch."):
    `7b34120a9` merges main `6c349a978`;
    the commit body names each conflict's resolution.
    After a merge that moves dependencies,
    run `mise run prepare:pnpm:install` only once no pass is running,
    then rebuild `oxlint-plugin/no-restricted-syntax`,
    `config/oxlint` and `dev-script/task-util`:
    a config built before the install bundles `@monochromatic-dev/module-logger` as an unresolved import and every lint run fails with "Failed to load JS plugin".
    Verified after both:
    the issue 563 repro keeps `[...text.slice(0, 3)]` through `--fix` (`unicorn/no-useless-spread` off,
    the typed project rule silent on a string),
    translation-repair suite 1140 PASS,
    toml-edit 41 PASS,
    types clean.
    HULICAIJIA20 READ (frozen `4641ff1d2`):
    SETTLED at 22:28 UTC 2026-09-25 in 81.9 min;
    class one hundred thirty-four live ("April 29",
    "May 4",
    "licorice",
    no "pharmaceutical sales representative",
    en_CA clean);
    classes one hundred thirty-five to thirty-seven found and built:
    豆花 seeded as "douhua" (`46731b86e`),
    `restoreArchiveNameCasing` (`76341f8e4`),
    `correctPinyinPage` (`2d5113b7d`,
    suite `suite-class137.log` 1139 PASS,
    no FAIL,
    replayed over the page:
    烷 alone).
    CLASS ONE HUNDRED THIRTY-FOUR (`4641ff1d2`,
    guards red first `acb5a9ccb`,
    suite `suite-class134.log` 1136 PASS,
    no FAIL):
    `canadianizePage` writes day-first dates month first and respells a closed list of lower-case words
    on every slice after the casing pass;
    the house policy names the date order and licorice;
    药代 seeded.
    OWNER 2026-09-25:
    en_CA covers "Translated pages only",
    not the repository's own prose.
    HULICAIJIA19 READ (frozen `6a24362ff`):
    SETTLED at about 10:03 UTC in 72.0 min;
    "29th April",
    "On 4 May" and "liquorice" on untouched slices,
    药代 as "pharmaceutical sales representative"
    (class one hundred thirty-four).
    SHI_YUMIAOYA35 READ (frozen `6a24362ff`):
    SETTLED at 09:23 UTC in 33.5 min;
    class one hundred thirty-three live ("her very first Progynova",
    "left her deeply traumatized"),
    en_CA scan clean.
    CLASS ONE HUNDRED THIRTY-THREE (`6a24362ff`,
    guard red first `47fbf2253`,
    suite `suite-class133.log` 1134 PASS,
    no FAIL):
    人生中的第一颗 and 留下了巨大的创伤 seeded in `WORDING_GLOSSARY`.
    SHI_YUMIAOYA34 READ (frozen `9bdeae9c6`):
    SETTLED at 08:45 UTC in 28.3 min,
    948 calls,
    about 0.23 USD by the meters;
    classes one hundred thirty-one and thirty-two live,
    the en_CA scan clean;
    two life-event calques found (class one hundred thirty-three).
    CLASS ONE HUNDRED THIRTY-TWO (`9bdeae9c6`,
    guard red first `53ddd36de`,
    suite `suite-class132b.log` 1133 PASS,
    no FAIL):
    the page is Canadian English,
    stated in `HOUSE_POLICY_BLOCK` and the package README ("English variety");
    shi_Yumiaoya33 on `fe56bffed` killed at 08:09 UTC for it.
    SHI_YUMIAOYA32 READ (frozen `6637865d6`):
    SETTLED at 08:02 UTC in 26.7 min,
    965 calls,
    about 0.23 USD by the meters;
    class one hundred thirty live (all nine renderings on the page,
    no refused form),
    every shi_Yumiaoya31 check clean;
    seven wording calques refused as class one hundred thirty-one (`fe56bffed`,
    guard red first `74322469d`,
    suite `suite-class131.log` 1132 PASS,
    no FAIL;
    the entries in `rendering-glossary-wording.ts`).
    SHI_YUMIAOYA31 READ (frozen `a719b81f6`):
    SETTLED at about 07:29 UTC in 30.6 min,
    981 calls,
    about 0.23 USD by the meters;
    class one hundred twenty-nine live ("had many causes",
    "Yumiao,
    as an exception,",
    "stopped trying",
    "edge of madness",
    "this vast world"),
    every shi_Yumiaoya30 check and the register check clean;
    glm-5.3 80 of 80 with Hyper wet;
    nine idiom calques refused as class one hundred thirty (`6637865d6`,
    guard red first `3774ee79a`,
    suite `suite-class130.log` 1131 PASS,
    no FAIL;
    class one hundred twenty-nine's entries moved to `rendering-glossary-phrasing.ts` for the line budget).
    SHI_YUMIAOYA30 READ (frozen `c432737d5`):
    SETTLED at 06:54 UTC in 25.1 min,
    881 calls,
    about 0.45 USD by the meters;
    classes one hundred twenty-six to twenty-eight live and the register check clean;
    five phrasing calques refused as class one hundred twenty-nine (`a719b81f6`,
    guard red first `a5be55ae8`,
    suite `suite-class129.log` 1130 PASS,
    no FAIL).
    glm-5.3 asked 82,
    usable 0:
    a Hyper-only seat with Hyper dry,
    refused at call time,
    not a class.
    The shi_Yumiaoya30 checks,
    kept for the next read:
    every shi_Yumiaoya27 check,
    then "head of year" or "grade director" (no "grade leader"),
    "underage trans girl" (no "minor trans"),
    "psychologically" or "emotionally" before "bullied",
    the ashes made into dice (no "ash dice"),
    "housemate" on both 同居者 lines (no "cohabitant"),
    "overdosing" on both OD lines (no "OD" or "ODing";
    owner 2026-09-25),
    "sailor uniform" (no "jk skirt")
    and "National College Entrance Examination" or "college entrance examination" (no "Gaokao");
    then the REGISTER CHECK (class one hundred twenty-eight):
    no chat shorthand or internet slang on the page
    (no OD,
    ODing,
    jk,
    TGT,
    MtF,
    gearhead,
    slacked off),
    every abbreviation a general reader would not know
    (SRS,
    GAHT,
    OST,
    POV,
    ACG) spelled out where it first appears,
    known abbreviations (HRT,
    ICU) and names in Latin letters kept.
    CLASS ONE HUNDRED TWENTY-EIGHT (owner 2026-09-25:
    "I'm not sure why you allowed the very informal terms like OD to go through."):
    built `c432737d5` (guard red first `194eca498`,
    suite `suite-class128.log` 1129 PASS,
    no FAIL).
    OD passed because the read treated the original's register as the authority
    and the house policy's community bullet keeps "an abbreviation local to the person's world";
    no rule named the register of the English.
    The new house-policy bullet reaches every writer and judge sheet.
    The same commit makes the archive-block-review-stage retention case anchor the first seat asked,
    since `rotatedBench` orders seats by a hash of the prompt and the longer policy had moved its named seat out of the quorum.
    SHI_YUMIAOYA29 KILLED (frozen `811d908a9`,
    pid 2915263) under always-kill-and-relaunch once class one hundred twenty-eight was underway.
    SHI_YUMIAOYA27 READ (frozen `13b633bad`):
    SETTLED at 05:57 UTC in 26.3 min,
    851 calls,
    about 0.41 USD by the meters;
    classes one hundred twenty-two to twenty-five live ("suddenly became a top student",
    "attempted to end her life in the early hours of January 16",
    "missed her chosen schools and ended up at a second-tier teachers' college",
    "this was her way of telling everyone");
    five more renderings refused as class one hundred twenty-six (`0468bf5bc`,
    guard red first `a2db36962`,
    suite `suite-class126.log` 1127 PASS,
    no FAIL).
    SHI_YUMIAOYA26 VOID:
    the freeze nested the build under `node/` inside a stale directory,
    so the pass ran an older build (see the handover's freeze paragraph and the pass log's shi_Yumiaoya26 heading);
    its page still showed "using this method to tell" and "slipped to a second-tier university",
    both refused since `13b633bad` (guards red first `e569be075`,
    `889811657`;
    suite `suite-class125b.log` 1126 PASS,
    no FAIL).
    SHI_YUMIAOYA25 READ (frozen `2fe4def37`):
    SETTLED at 03:26 UTC in 23.5 min,
    905 calls,
    about 0.43 USD by the meters;
    class one hundred twenty-four live ("she attempted suicide in the early hours of January 16."),
    classes one hundred twenty-two and twenty-three holding;
    two calques (滑档二本 "slid down into a second-tier admission slot",
    用这种方式 "using this way to tell"),
    class one hundred twenty-five built `67da525a2` (guard red first `052f6cffe`,
    suite `suite-class125.log` 1126 PASS,
    no FAIL).
    OWNER ANSWER 2026-09-25 on medication overuse the original does not call an attempt:
    "Leave it".
    SHI_YUMIAOYA24 READ (frozen `7e20bbee2`):
    SETTLED at 02:57 UTC 2026-09-25 in 24.5 min,
    885 calls,
    about 0.44 USD by the meters;
    classes one hundred twenty-two and twenty-three live ("she had taken medication before she died",
    no rooftop;
    "teachers' college",
    "suddenly became a top student");
    but "she swallowed a large amount of medication ... and attempted to end her life" for the survived January 16 attempt (class one hundred twenty-four,
    built `2fe4def37`,
    guard red first `fe230891b`,
    suite `suite-class124.log` 1125 PASS,
    no FAIL:
    the reader-protection bullet opens on a death or an attempt).
    "Magic Chewing Gum and interrgned" is both entries' English `name`,
    not a class.
    OPEN FOR THE OWNER:
    每日大量服用精神药物 ("took large amounts of psychiatric medication every day",
    then the ICU) is medication overuse the original does not call an attempt;
    the rule as written does not reach it.
    OWNER STANDING INSTRUCTIONS OF 2026-09-25:
    "From now on whenever you see anything that can be translated better do it."
    A rendering that reads badly is a class to fix (rendering glossary entry,
    policy clause or floor),
    never an observation left in a note.
    OWNER CORRECTION OF 2026-09-26,
    after the TianqiChen6665 read left three observations "not built":
    "Shouldn't you always immediately fix and restart?"
    Every observation from a read is fixed in the same turn (guard red first,
    fix,
    suite),
    then the running pass is killed and relaunched on the new frozen build;
    a read never ends on an unbuilt observation.
    "dropping "swallowing a large amount of medication" is fine.
    It's documented somewhere that not showing suicide methods therefore promoting replication is expected."
    Read every death and attempt passage against `src/house-policy.ts` reader protection;
    a method,
    substance,
    dose or place-as-means on the page is a class.
    SHI_YUMIAOYA23 READ (frozen `e57a2589c`):
    SETTLED at 01:49 UTC 2026-09-25 in 20.9 min,
    one attempt,
    917 seats,
    841 calls,
    about 0.35 USD by the meters;
    every shi_Yumiaoya22 check holds (4 headings,
    front matter equal,
    no TA,
    no error finish,
    no double blank line,
    the death paragraphs,
    the closing quote's two lines with the attribution once,
    "trans girl",
    Han only in the archive comments);
    the sedative detail of the original now on the page;
    the January 16 sentence drops 吞下大量药物 as shi_Yumiaoya14 did (an observation);
    glm-5.3 dark (72 seats,
    Hyper dry);
    no class.
    CUSPARIAKLSY15 READ (frozen `e57a2589c`):
    SETTLED at 01:27 UTC 2026-09-25 in 17.2 min,
    one attempt,
    380 seats,
    361 calls,
    about 0.09 USD by the meters;
    every CuspariaKLSY14 check holds (1 heading,
    front matter equal,
    no TA,
    no error finish,
    no double blank line,
    the life in the past,
    the gloss line put back by `name-gloss-restored`);
    the death paragraph carries every clause of the original with no medication detail (又 dropped again,
    an observation);
    the life list's mixed marker spacing is the archive's own;
    class one hundred seven live on slices 1 and 3;
    glm-5.3 dark (19 seats,
    Hyper dry);
    no class.
    ZHEERMAO13 READ (frozen `e57a2589c`):
    SETTLED at 01:08 UTC 2026-09-25 in 21.0 min,
    one attempt,
    877 seats,
    829 calls,
    about 0.30 USD by the meters;
    every zheermao12 check holds (2 headings,
    front matter equal,
    both labels one line,
    no TA,
    no error finish,
    no double blank line,
    1 translate overrun against zheermao12's 1);
    class one hundred seven live on slice 5 (three minor accuracy claims accepted,
    the repair text the stand-in);
    the casing pass silent (INFJ,
    the archive's one capital form,
    already in capitals);
    glm-5.3 dark all run (47 seats,
    Hyper-only,
    Hyper dry);
    no class.
    YINGYING11 READ (frozen `e57a2589c`):
    SETTLED at 00:46 UTC 2026-09-25 in 15.4 min,
    333 calls,
    about 0.09 USD by the meters;
    every yingying10 check holds,
    the casing pass silent (BUAA already in capitals);
    no class;
    observation:
    one abstention called the farewell's second person a house-rule breach,
    and the page reads "May you" as the original.
    MIKAELA17 READ (frozen `9ec838a01`):
    SETTLED at 00:22 UTC 2026-09-25 in 40.8 min,
    2,394 calls;
    every mikaela16 check holds;
    but slice 16 wrote "Xiawafang" where the archive writes XIAWAFANG in the body and its footnote (class one hundred twenty-one).
    CLASS ONE HUNDRED TWENTY-ONE BUILT (d12aa2ed7 and e57a2589c,
    guards red first 196a4fd6c and 990f5f68f,
    full suite `suite-class121b.log` 1122 PASS lines,
    no FAIL,
    replayed over the mikaela17 artifact):
    `corpus-run/archive-casing-restore.ts` restores an all-capitals word the archive writes that way at least twice and never otherwise,
    reading past heading lines,
    as the last page-assembly pass.
    DEVPASS (owner,
    2026-09-24):
    LLM Gateway DevPass is left out of the pipeline,
    the owner's choice after reading its terms (no apps,
    scripts or batch pipelines;
    translation named as excluded from 2026-10-15;
    no ZDR;
    no provider pinning);
    `LLMGATEWAY_DEVPASS_API_KEY` sits in the sops file unused (addendum in `doc/decision/translation-repair-openrouter-fallback.md`,
    `aff37b34b`).
    SYNTHETIC reset by the owner on 2026-09-24;
    the running XingZ6010 picked it up by its meters (151 Synthetic calls).
    XINGZ6010 READ (frozen `d73cb46b9`):
    SETTLED at 23:35 UTC 2026-09-24 in 64.9 min,
    one attempt,
    6,870 calls,
    2.49 USD Bedrock and 3.78 OpenRouter by the meters;
    every XingZ631 check holds (14 headings,
    2 links,
    9 definitions,
    3 TextRing,
    11 details,
    front matter equal,
    no TA,
    no error finish,
    no double blank line,
    DottedNumber II to VII,
    Jinxin glossed once);
    but `<h3 align = "Nonuple Reality">` (class one hundred twenty):
    the title unify wrote slice 98's credit title into a heading attribute spaced around its equals sign.
    CLASS ONE HUNDRED TWENTY BUILT (9ec838a01,
    guard red first c303b0287,
    full suite `suite-class120.log` 1121 PASS,
    no FAIL,
    replayed over the XingZ6010 artifact):
    `title-reference-marks.ts` reads back past blanks to an attribute's equals sign before taking a quoted span as prose.
    SHI_YUMIAOYA22 READ (frozen `d73cb46b9`):
    SETTLED at 22:29 UTC 2026-09-24 in 31.9 min,
    one attempt,
    1,011 seats,
    5 retry rounds,
    938 calls,
    0.13 USD Bedrock and 0.28 OpenRouter by the meters;
    class one hundred nineteen live on the page ("Yumiao was a very ordinary trans girl[^1]",
    "mentally bullied by an underage trans girl",
    no Han or pinyin outside the archive's comment);
    the floor did not fire (no candidate kept the Han),
    the glossary line did the work;
    every shi_Yumiaoya19 check holds;
    observation:
    one gate ballot misread the listed rendering "trans women" as forbidden,
    the gate chose right anyway;
    no class.
    shi_Yumiaoya21 on `5fd7d3dea` was killed at 21:57 UTC,
    2 min in,
    once `d73cb46b9` put the owner's reason into the glossary's why;
    shi_Yumiaoya20 on `79972da3d` was killed at 21:55 UTC,
    17 min in,
    under always-kill-and-relaunch once `5fd7d3dea` landed.
    CLASS ONE HUNDRED NINETEEN BUILT (79972da3d,
    guard red first 2f7dd5190,
    full suite `suite-class119.log` 1121 PASS,
    no FAIL):
    owner answer 2026-09-24 on 小药娘 and 药娘:
    "This term is pretty disrespectful though currently being used by some people in the community in a neutral way.
    We shouldn't assume that neutralness carries over to English.
    The best thing we can do here is just to say "trans woman" or "trans girl"."
    `COMMUNITY_GLOSSARY` seeds 药娘 with the renderings "trans girl",
    "trans woman",
    "trans women" and the refused forms yaoniang,
    yao-niang,
    yao niang (entries gain `refusedForms`);
    `communityTermFindings` (`translate-community-term.ts`),
    a source-carry floor after the title floor,
    refuses before any judge a candidate that keeps a glossary term the original carries in Han or writes a refused form in any casing,
    comments cut on both sides.
    OWNER CORRECTION 2026-09-24:
    "even when existing English translation itself keeps the term it shouldn't be kept."
    The owner's reason,
    same day:
    "because 小药娘 the term itself could be read as degratory,
    which is absolutely not what we want."
    The glossary's why says so (`d73cb46b9`).
    The page-kept exception is gone (`5fd7d3dea`,
    guard red first `2ba810b2f`,
    lint 0/0,
    types clean,
    full suite `suite-class119b.log` 1121 PASS,
    no FAIL).
    HULICAIJIA17 READ (frozen `0d8e463ef`):
    SETTLED at about 11:00 UTC 2026-09-24 in 28.4 min,
    one attempt,
    4,326 seats,
    154 retry rounds,
    3,477 calls,
    1.03 USD Bedrock and 1.63 OpenRouter by the meters;
    every hulicaijia16 check holds (13 headings,
    markers and 9 definitions as the archive,
    2 links,
    3 Sakura,
    front matter equal,
    no TA,
    no error finish,
    no double blank line),
    75 abstention lines,
    Jev 127 of 127;
    class one hundred eighteen holding (GLM-5.3-Flash 231 of 231 off Synthetic),
    the class ninety-seven floor excluded the archive's third-person incumbent once;
    Qwen3.8-27B 0 usable of 578 and glm-5.3 7 of 277 are router refusals with Synthetic and Hyper spent,
    not model failures;
    no class.
    SHI_YUMIAOYA19 READ (frozen `0d8e463ef`):
    SETTLED 10:29 UTC 2026-09-24 in 20.9 min,
    812 seats,
    811 calls,
    0.19 USD by the meters;
    every shi_Yumiaoya18 check holds;
    OWNER ANSWERED the 小药娘 question on 2026-09-24;
    built as class one hundred nineteen.
    CUSPARIAKLSY14 READ (frozen `0d8e463ef`):
    SETTLED 10:05 UTC 2026-09-24 in 21.6 min,
    401 seats,
    400 calls,
    0 retry rounds,
    0.07 USD by the meters;
    class one hundred eighteen live (no GLM-5.3-Flash stream on Synthetic,
    its first streams on Hyper while Synthetic read wet,
    longest gap 89 s against 179),
    class one hundred seventeen not exercised (the bench wrote the list loose),
    every CuspariaKLSY13 check holds;
    observation:
    又 dropped before the argument with her father;
    no class.
    CUSPARIAKLSY13 READ (frozen `3bb47c918`):
    SETTLED 09:15 UTC 2026-09-24 in 31.9 min,
    367 seats,
    363 calls,
    0.06 USD by the meters;
    every CuspariaKLSY12 check holds and the death paragraph carries 双方情绪爆发,
    又,
    抢救 and 再次得到消息 with no medication detail;
    but the archive's loose life list shipped tight (class one hundred seventeen),
    and one editor round plus its recovery round waited 355 s on GLM-5.3-Flash's cap-cut runaway on Synthetic (class one hundred eighteen).
    CLASS ONE HUNDRED SEVENTEEN BUILT (c796c5085,
    guard red first f0fe179c7,
    replayed over the real slice):
    `restoreListSpread` (`corpus-run/list-spread-restore.ts`),
    a page-assembly pass after the gloss lines,
    respaces a replaced slice's list to the archive's spacing when ordering and item count match,
    never tightening a list with spread items;
    finding `list-spread-restored`.
    CLASS ONE HUNDRED EIGHTEEN BUILT (0d8e463ef,
    guard red first 7cf6ec12b,
    full suite `suite-class118b.log` 1119 PASS with the load-sensitive lane-contest grace case failing under the parallel run and passing alone):
    GLM-5.3-Flash withheld from Synthetic on measured latency (74.5 s mean over 892 streams there against 8.6 s over 305 on Hyper) through the `synthetic-withheld` card hold and `SYNTHETIC_WITHHELD` in `reachOf`;
    Qwen3.8-27B and Kimi-K3 stay on Synthetic,
    faster there;
    the recovery round stays (67 percent of recoveries heard someone).
    ZHEERMAO12 READ (frozen `3bb47c918`):
    SETTLED 08:42 UTC 2026-09-24 in 21.6 min,
    917 seats,
    916 calls,
    0.24 USD by the meters;
    class one hundred sixteen live (1 translate overrun against 22,
    the translate lane 62 s against 616 with Kimi-K3 and glm-5.3 still asked),
    every zheermao11 check holds;
    no class.
    ZHEERMAO11 READ (frozen `c958640fb`):
    SETTLED 08:10 UTC 2026-09-24 in 30 min,
    857 seats,
    834 calls,
    7 retry rounds,
    0.19 USD by the meters;
    every zheermao9 check holds,
    the labels reworded by the archive block review to name the letter and the email thread,
    classes one hundred nine,
    fourteen and fifteen silent by design;
    but the translate lane took 616 s against 77:
    22 translate streams wrote a neighbouring picture's transcript into a picture-only passage and were cut by the produced volume bound,
    the Hyper reasoning seats (Kimi-K3 55.1 s mean,
    171 s longest) thinking 60 to 170 s first (class one hundred sixteen).
    CLASS ONE HUNDRED SIXTEEN BUILT (3bb47c918,
    guard red first 40721851c,
    full suite `suite-class116.log` 1119 PASS,
    no FAIL):
    `TRANSLATE_PICTURE_SCOPE_RULE` (`translate-wire.ts`) on the translator sheet whenever WHAT THE PICTURES HERE SAY is shown:
    the block is context,
    a picture's words belong only where the passage or its existing translation already carries them,
    a picture component renders as the ORIGINAL has it.
    YINGYING10 READ (frozen `f4d554838`):
    SETTLED 07:26 UTC 2026-09-24 in 682 s (Hyper wet,
    its latency),
    307 seats,
    307 calls,
    0 retry rounds,
    about 0.06 USD by the meters;
    class one hundred fourteen live (the [^2] title "Yingying",
    the archive's "Sakura" excluded from the slate by the floor,
    confirmed by replay),
    every yingying9 check holds;
    class one hundred fifteen found on the slate:
    gemma-4-e2b's candidate unwrapped the title link into words and a bare URL and passed every floor.
    CLASS ONE HUNDRED FIFTEEN BUILT (a7b7f3934,
    guard red first 5db1cc723,
    full suite `suite-class115.log` 1118 PASS,
    no FAIL,
    replayed over the real slice 3):
    `unwrappedLinkFindings` (`translate-unwrapped-link.ts`) joins the source-carry floors;
    the corpus census found no archive unwrapping a worded source link (119 of 141 kept,
    22 dropped).
    EXCLUSION LOGGED (c958640fb,
    suite `suite-log115.log`):
    the translate stage logs the findings that keep the archive off the slate.
    zheermao10 (a7b7f3934) killed 28 calls in under always-kill-and-relaunch.
    YINGYING9 READ (frozen `6dec56b0b`):
    SETTLED 06:52 UTC 2026-09-24 in 185 s,
    304 seats,
    241 calls,
    10 retry rounds,
    about 0.05 USD by the meters;
    class one hundred thirteen not exercised (all four checker rounds 2 of 3),
    every yingying8 check holds and "Geek Lab" now carries the hardcore video;
    but the [^2] title shipped the archive's "Sakura" for the declared "Yingying":
    two of three translate slate judges chose the archive's own text as "the archive's established rendering",
    and the repair lane's rewrite was reverted by the introduced-defect probe (class one hundred fourteen).
    CLASS ONE HUNDRED FOURTEEN BUILT (645ed9d62 and f4d554838,
    guard red first 98f24d35b,
    full suite `suite-class114b.log` 1117 PASS,
    no FAIL,
    replayed over the real slice 3):
    `declaredLinkNameFindings` (`translate-declared-link-name.ts`) joins the source-carry floors:
    where the original's link text carries a declared source name,
    the rendering's link text under the same href must carry the declared form (name projection);
    the pairs ride on the prepared document as `declaredNamePairs` into every validator call (translate incumbent,
    slate floor,
    repair turn,
    contest winner,
    standing verdict,
    lane offer,
    producers,
    polish).
    Open,
    not built:
    the repair lane's introduced-defect probe still reads a declared-name correction as a defect;
    the floor refuses its reverted text downstream.
    MIKAELA16 READ (frozen `a43c5d88d`):
    SETTLED 05:58 UTC 2026-09-24 in 20.6 min,
    2,483 seats,
    2,051 calls,
    0.74 USD by the meters;
    class one hundred twelve not exercised (the roster placed every block,
    section 2 merging sources 2 and 3 into target 2),
    the HRT passage on the page once,
    "That night,
    Spring,
    Mika,
    and I" as the archive;
    every mikaela11 check holds (the classmate line reads "a classmate of mine" so no possessive to curl);
    class one hundred nine live (eight re-seated proof rounds at 2 of 3 after Synthetic dried out at 05:47:59 UTC),
    class one hundred seven on slices 11,
    13,
    17,
    23,
    contest 26 of 33 differ,
    one unendorsed (9),
    60 abstention lines,
    Jev 78 of 78.
    CLASS ONE HUNDRED THIRTEEN BUILT (375a9b3e8 over 6dec56b0b;
    phase guards red first 24b9ab623,
    which withdrew the settle guard e003d4c1d;
    full suite `suite-class113b.log` 1116 PASS):
    ten refine rechecks from 05:51:51 UTC heard 1 of 3 on the chunk's bench because the refine stage never read the re-seat hook;
    `settleRefinedSlice` now reads the bench through `checkerBenchAtStage` right before the recheck (after the unchanged exit,
    so a slice whose rewrite changed nothing asks no hook) and runs the recheck and the rewrite probe on it,
    the hook threaded from the lane driver through `refineSettledSlices`,
    `runRefinePhase` and `settleRefinePhaseSlice`.
    Not exercised live yet.
    MIKAELA15 READ (frozen `caac222a6`):
    SETTLED 05:19 UTC 2026-09-24 in 10.5 min,
    2,116 seats,
    1,687 calls,
    0.75 USD by the meters;
    class one hundred eleven live end to end (`insertion-carried-folded (slice 11 into slice 10)`,
    no carried-evidence-lost stop,
    every mikaela11 check holds),
    but the HRT passage shipped twice:
    slice 10's stand-in through the fold and slice 13's span keeping the archive's "That was originally just a typical thing."
    (class one hundred twelve);
    class one hundred seven live on slices 13 and 24,
    contest 25 of 34 differ,
    all 15 checker rounds 2 of 3,
    slices 5 and 14 unendorsed,
    51 abstention lines,
    Jev 68 of 69.
    CLASS ONE HUNDRED TWELVE BUILT (a43c5d88d,
    guard red first 0c5ee4b6c,
    full suite `suite-class112.log` (1115 PASS;
    the one red case was the census decline fixture,
