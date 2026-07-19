# Vetting report: PIT / Pitest (hcoles/pitest) for Kotlin mutation testing

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Date:
 2026-06-07
Standard applied:
 choosing-technology skill,
 FULL-VERIFICATION.
Clone:
 `gh repo clone hcoles/pitest /tmp/agent/pitest-vet -- --depth 1`
Head commit at clone:
 `559537512de9b3988ebd7112ee854462fdd1d868` (2026-06-01,
 Henry Coles).

## Verdict up front

PIT works on Kotlin and produces a meaningful mutation score,
 but its open-source
Kotlin support is a deliberately minimal "quick dirty hack" by the maintainer's own words.
Proper Kotlin handling (inline functions,
 intrinsic null-checks,
 when-exhaustiveness,
synthetic members,
 equivalent empty-return mutants) lives only in the paid Arcmutate
plugin,
 and PIT itself prints a build message nagging you to buy it.
For a repo that wants robust open-source Kotlin mutation testing without a commercial
license,
 PIT is usable but its Kotlin noise-filtering is weak and effectively upsold.

## 1. What was verified (FULL VERIFICATION)

Environment:
 bounded podman container,
 image `docker.io/library/eclipse-temurin:21-jdk`,
`--memory=6g --cpus=4`,
 project and Gradle build cache on disk under
`/var/tmp/pitest-kotlin-vet` (not tmpfs).
 Gradle 8.14.5 fetched inside the container and
extracted with the JDK `jar` tool (image has no `unzip`).

Project:
 minimal Gradle Kotlin (`kotlin("jvm") 2.1.20`) with the community Gradle plugin
`info.solidsoft.pitest 1.19.0`,
 pitest `1.25.3`,
 `pitest-junit5-plugin 1.2.2`,
 JUnit 5 /
kotlin.
test.
 One real-logic class `vet.PriceCalculator` (branching discount logic,
 a
score classifier,
 and a `greet(name: String)` to force a Kotlin `Intrinsics`
non-null parameter check) plus six tests.

Exact commands (inside container,
 see `run-in-container.sh`):

```bash
gradle --no-daemon --console=plain test     # sanity: BUILD SUCCESSFUL in 26s, 6 tests pass
gradle --no-daemon --console=plain pitest   # mutation run
```

Result (from `build/reports/pitest/mutations.xml` and PIT stdout):

```txt
>> Generated 16 mutations Killed 12 (75%)
>> Line Coverage (for mutated classes only): 7/8 (88%)
>> Mutations with no coverage 0. Test strength 75%
>> Ran 20 tests (1.25 tests per mutation)
Build messages:-
* Project uses kotlin, but the Arcmutate kotlin plugin is not present.
  (https://docs.arcmutate.com/docs/kotlin.html)
```

Per-mutator tally:
 ConditionalsBoundary 4 generated / 0 killed;
 NegateConditionals 6/6;
Math 3/3;
 EmptyObjectReturnVals 2/2;
 PrimitiveReturns 1/1.

The four survivors are all ConditionalsBoundary mutants on lines 11,
 13,
 and 18
(`quantity > 0`,
 `subtotal > 100`,
 `score >= 90`,
 `score >= 80`).
 These are genuine test
gaps (my tests never probe the exact boundary values),
 not Kotlin equivalent-mutant noise.
This is mutation testing working correctly on Kotlin bytecode.

Kotlin-noise observation:
 in this minimal example no equivalent-mutant junk surfaced.
The `Intrinsics.checkNotNullParameter` synthetic call in `greet` was not mutated
(the active default set produced no VoidMethodCall/removal mutant against it),
 and there
were no data-class/`copy`/`component` synthetic mutants because the class is not a data
class.
 The noise problem is real but only bites with richer Kotlin (data classes,
 inline
functions,
 exhaustive `when`,
 `lateinit`,
 sealed hierarchies);
 see section 2.

Conclusion for the disqualifying test:
 PIT can be built and run against Kotlin and yields
a usable killed/survived report.
 Not disqualified on the run.

## 2. Source audit of Kotlin handling

Mutation engine is Gregor,
 ASM-based bytecode rewriting (`asm` 9.9.1,
 shaded to
`org.pitest.reloc.asm`):

- `pitest/src/main/java/org/pitest/mutationtest/engine/gregor/GregorMutater.java:78-106`
  reads class bytes with `ClassReader`,
   drives `MutatingClassVisitor` with
  `ClassReader.EXPAND_FRAMES`,
   writes mutants with `ComputeClassWriter`.
- Mutators in `pitest/src/main/java/org/pitest/mutationtest/engine/gregor/mutators/`
  (Math,
   NegateConditionals,
   ConditionalsBoundary,
   ConstructorCall,
   returns/,
   etc.).
  Bytecode-level,
   so language-agnostic,
   which is exactly why Kotlin synthetic constructs
  leak through as junk.

Kotlin-specific code is small and explicitly labelled a stopgap:

- `pitest-entry/.../build/intercept/kotlin/KotlinFilter.java:14-52`.
   TSDoc reads
  "Quick dirty hack to filter out some of the junk mutations created for kotlin classes.
  "
  The entire heuristic is:
   drop mutations whose filename ends `.kt` and whose
  `lineNumber == 0` (line 51).
   The comment admits "This won't catch everything and will
  probably sometimes trigger when it shouldn't.
  " Feature `FKOTLIN`,
   on by default
  (`KotlinFilterFactory.java:21` `withOnByDefault(true)`).
- `pitest-entry/.../verify/KotlinVerifierFactory.java:32-51`.
   If Kotlin is on the
  classpath,
   Kotlin classes are being mutated,
   and the class
  `com.groupcdg.pitest.kotlin.KotlinFilterInterceptor` (the paid plugin) is absent,
   PIT
  emits the build message pointing at `https://docs.arcmutate.com/docs/kotlin.html`.
  The maintainer routes Kotlin users to the commercial add-on from inside the OSS tool.
- `ImplicitNullCheckFilter.java:33-46` only matches the Java `Object.getClass()` synthetic
  null-check pattern.
   It does NOT match Kotlin's `kotlin.jvm.internal.Intrinsics`
  null-check calls,
   so Kotlin intrinsic null-checks are not filtered by mainline PIT.
- README changelog history confirms long-standing but shallow Kotlin handling:
   "#260
  Initial support for mutating Kotlin code",
   "#1347 Auto add standard kotlin source dirs
  for maven projects",
   and "#1105 Aggregator resolves wrong file for out of package
  kotlin files with same name" (PIT "cannot guarantee to resolve the correct file" when a
  Kotlin filename occurs in more than one location).

What mainline PIT does NOT handle for Kotlin (confirmed by Arcmutate docs the source links
to,
 `https://docs.arcmutate.com/docs/kotlin.html`):
 inline-function mutant de-duplication,
intrinsic null-check junk removal,
 synthetic accessor / `lateinit` filtering,
`when`-exhaustiveness unmatched clauses,
 and equivalent empty-return mutants.
 All of these
are in the commercial plugin only.

Tests and CI:

- 591 Java test files.
   Kotlin filter is unit-tested at
  `pitest-entry/.../kotlin/KotlinFilterTest.java`,
   but only against synthetic
  `MutationDetails` with filename/line set by hand,
   never against real compiled Kotlin
  bytecode (no `.kt` fixtures compiled and mutated).
   Only 6 `.kt` files exist in the whole
  repo.
- CI:
   GitHub Actions (`.github/workflows/ci.yml`,
   `release.yml`,
   `snapshot.yml`) plus
  `azure-pipelines.yml` (mac + windows,
   JDK 11).
   No fuzzing harness.
   Mutation testing of
  PIT itself is not wired into the public CI in this tree.

Gradle plugin:
 there is NO Gradle plugin in hcoles/pitest (only `pitest-maven` and
`pitest-ant`).
 The Gradle plugin is a separate community project,
`szpak/gradle-pitest-plugin` (`info.solidsoft.gradle.pitest`),
 latest 1.19.0 (2026-03-29),
last commit 2026-04-07,
 maintained by Marcin Zajaczkowski.
 That is the one used in the
verification above and is itself actively maintained,
 but it is a third party,
 not the
pitest maintainer.

## 3. Maintenance signals (via gh)

- Stars 1828,
   forks 366,
   Apache-2.0,
   primary language Java,
   created 2014.
- Release cadence:
   very active.
   1.25.3 (2026-05-29) latest;
   1.25.0 through 1.25.3 all in
  the last two weeks of May 2026;
   1.24.
  x,
   1.23.
  x,
   1.22.
  x across spring 2026.
   Multiple
  releases per month.
- Last commit 2026-06-01 (six days before this report).
   68 commits since 2025-12-01.
- Maintainer concentration:
   single maintainer.
   `hcoles` (Henry Coles) has 1242
  contributions;
   the next contributors are lkwg82 (37),
   dependabot (37),
   Vampire (23),
  AlexElin (19),
   szpak (10).
   This is a classic bus-factor-of-one project.
- Issue and PR responsiveness:
   healthy for a low-volume mature tool.
   22 issues created and
  12 closed in the last ~12 months;
   39 PRs merged in the same window;
   319 open issues,
   14
  open PRs.
   Owner replies substantively and quickly (for example issue #1462 on
  defensive-copy filtering,
   where hcoles committed to a fix and shipped it;
   #1464 closed
  2026-06-04).
   Backlog is large but old,
   not a sign of abandonment.
- Conflict of interest worth flagging:
   the sole maintainer also sells the Arcmutate
  commercial plugins (arcmutate.
  com),
   and the OSS tool actively advertises them.
   Advanced
  Kotlin support is on the paid side of that line,
   which shapes how much OSS Kotlin
  polish to expect.

State:
 active releases,
 responsive single maintainer,
 large-but-triaged backlog.
 Not
abandoned.
 Single-maintainer bus factor and commercial-upsell incentive are the risks.

## 4. Alternatives considered, with rejection reasons

- Arcmutate commercial Kotlin plugin (`com.groupcdg.pitest.kotlin`,
   docs.
  arcmutate.
  com).
  This is the only thing that actually fixes Kotlin noise (inline functions,
   intrinsic
  null-checks,
   synthetic members,
   when-exhaustiveness,
   equivalent empty returns).
  Rejected as a default for this repo:
   it is closed-source and requires a paid license
  (`arcmutate-licence.txt` at project root or dynamic license retrieval),
   which violates
  the open-source-default constraint.
   Worth naming only as the labelled commercial
  exception if Kotlin mutation-noise becomes intolerable.
- Manual code review / hand-written assertion review in place of mutation testing.
  Rejected:
   not a like-for-like substitute.
   Manual review does not produce an objective,
  repeatable test-strength number,
   does not scale,
   and cannot systematically enumerate
  surviving mutants.
   It is a complement,
   not a replacement,
   and gives none of the
  CI-enforceable thresholds PIT provides.

Note:
 this repo is a TypeScript/JVM-free monorepo (StrykerJS is the JS mutation tool
already referenced in its docs).
 PIT/Arcmutate are only relevant if and when JVM/Kotlin
code is added here.
 For JavaScript/TypeScript,
 PIT is not applicable at all.

## 5. Bottom line

PIT is a healthy,
 actively released,
 single-maintainer JVM mutation engine that does run
on Kotlin and gives a correct mutation score (verified:
 16 mutations,
 12 killed,
 75%,
 four
genuine boundary survivors).
 Its open-source Kotlin support is intentionally a thin line-0
heuristic;
 the real Kotlin noise-handling is paywalled behind the same maintainer's
Arcmutate plugin,
 and PIT nags for it on every Kotlin run.
 Recommend PIT for JVM/Kotlin
mutation testing only with eyes open about that gap;
 do not expect clean Kotlin reports
from the free tier without tolerating some equivalent-mutant noise on richer Kotlin code.
