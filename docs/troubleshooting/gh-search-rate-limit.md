# gh 2.93.0 `gh search` fans out one request per page, ignoring `--limit`, until primary search rate limit returns 403

A single `gh search` invocation with a small `--limit` can fire dozens of REST
search requests because the pagination loop follows the response `rel="next"`
link until either the requested item count is collected or the link runs out.
When pages come back with an empty `items` array while still advertising a
`next` link,
 the item counter never decrements,
 so the loop walks the entire
result set one page at a time.
 Each page is one request against GitHub's
primary search rate limit (30 requests per minute for authenticated users),
 so
one `gh search issues --limit 3` call can burn the whole minute budget and the
final request returns `HTTP 403: API rate limit exceeded`.

A second,
 separate gotcha surfaced during the same session and is documented in
the sibling section "Issue-search ghost counts and date-qualifier zeros on a
repo with Issues disabled".
 It is not a gh bug;
 it is a data-interpretation
trap,
 recorded so a future session does not chase it as a date-qualifier defect.

Verified 2026-06-02 against `gh version 2.93.0 (2026-05-27)` and cli/cli `main`
at commit `7f885723a9cb72cd4318eef3c831f8a7bb9d9093` (fresh shallow clone).

## Symptom

The user was searching `jdx/mise` for duplicate issues.
 A single command:

```bash
gh search issues --repo jdx/mise "rust" --limit 3 --json number,title
```

failed with (verbatim,
 token redacted by the harness):

```text
HTTP 403: API rate limit exceeded for user ID 66041952. If you reach out to GitHub Support for help, please include the request ID CED0:1920B4:69F87D:18B5A07:6A1F5E46 and timestamp 2026-06-02 22:50:46 UTC. For more on scraping GitHub and how it may affect your rights, please review our Terms of Service (https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) (https://api.github.com/search/issues?advanced_search=true&page=31&per_page=3&q=%28+rust+%29+repo%3Ajdx%2Fmise+type%3Aissue)
```

The failing request URL decodes to:

```text
https://api.github.com/search/issues?advanced_search=true&page=31&per_page=3&q=( rust ) repo:jdx/mise type:issue
```

A `--limit 3` query reaching `page=31` is the tell:
 one `gh search` invocation
fired roughly 31 search requests.
 The `GH_DEBUG=api` trace of that single
invocation shows exactly 31 `GET /search/issues` requests (pages 1 through 31,
each `per_page=3`) plus 31 `POST /graphql` requests;
 the first 30 search GETs
returned `200 OK` and `page=31` returned `403 Forbidden`.

The 403 response carries the primary-limit signature,
 not a secondary
(abuse) limit:

```text
< X-Ratelimit-Resource: search
< X-Ratelimit-Limit: 30
< X-Ratelimit-Remaining: 0
< X-Ratelimit-Used: 30
< X-Ratelimit-Reset: 1780440690
```

```json
{
  "message": "API rate limit exceeded for user ID 66041952. ...",
  "documentation_url": "https://docs.github.com/rest/overview/rate-limits-for-the-rest-api",
  "status": "403"
}
```

There is no `Retry-After` header and the body is not the secondary-limit string
("You have exceeded a secondary rate limit").
 This is the documented primary
search limit (30 per minute) being exhausted inside one invocation.

### An earlier hypothesis was wrong: this is the primary limit, not the secondary (abuse) limit

The session notes that led to this investigation hypothesized GitHub's
secondary (abuse) rate limit,
 reasoning that `gh api rate_limit` reported the
search resource at `30/30` immediately before and after the failures,
 so the
primary limit looked untouched.
 That reading is wrong.
 Two pieces of evidence
disprove it:

1.  The failing response is `X-Ratelimit-Resource: search`,
    `X-Ratelimit-Used: 30`,
     `X-Ratelimit-Remaining: 0`,
     with the primary-limit
    message and no `Retry-After`.
     The secondary limit returns a different body
    and a `Retry-After` header.
2.  Inside the failing run,
     the `X-Ratelimit-Remaining` header on the search
    responses drains `29, 28, 27, ... 1, 0` across the 30 successful pages,
     so
    the primary budget is visibly consumed by the fan-out itself.

`gh api rate_limit` showed `30/30` before and after because the primary search
limit is a per-minute window that reset between the two reads:
 the fan-out
consumed all 30 in about 3.6 seconds,
 then the window rolled over before the
"after" read.
 So a `30/30` reading from `gh api rate_limit` is not evidence the
next `gh search` will succeed;
 one invocation can drain the entire window at
once.

## Root cause

All citations are against cli/cli commit
`7f885723a9cb72cd4318eef3c831f8a7bb9d9093`.

### The pagination loop follows `next` links while items are still wanted, with no empty-page guard

`searcher.Issues` (and the identical `Code`,
 `Commits`,
 `Repositories` loops)
at `pkg/search/searcher.go:161-186` loops while `numItemsToRetrieve > 0` and
advances by following the response `Link: rel="next"` header:

```go
func (s searcher) Issues(query Query) (IssuesResult, error) {
	result := IssuesResult{}

	numItemsToRetrieve := query.Limit
	query.Limit = min(numItemsToRetrieve, maxPerPage)
	query.Page = 1
	for numItemsToRetrieve > 0 {
		page := IssuesResult{}
		link, err := s.search(query, &page)
		if err != nil {
			return result, err
		}

		numItemsToAdd := min(len(page.Items), numItemsToRetrieve)
		result.IncompleteResults = page.IncompleteResults
		result.Total = page.Total
		result.Items = append(result.Items, page.Items[:numItemsToAdd]...)
		numItemsToRetrieve = numItemsToRetrieve - numItemsToAdd

		query.Page = nextPage(link)
		if query.Page == 0 {
			break
		}
	}
	return result, nil
}
```

The counter only decreases by `numItemsToAdd = min(len(page.Items),
numItemsToRetrieve)` at `pkg/search/searcher.go:174,178`.
 When a page returns
`len(page.Items) == 0`,
 `numItemsToAdd` is `0`,
 so `numItemsToRetrieve` is
unchanged and the loop's only remaining exit is `nextPage(link) == 0`.

`nextPage` at `pkg/search/searcher.go:323-340` returns the next page number
whenever the `Link` header advertises a `rel="next"` entry:

```go
func nextPage(link string) (page int) {
	for _, m := range linkRE.FindAllStringSubmatch(link, -1) {
		if !(len(m) > 2 && m[2] == "next") {
			continue
		}
		p := pageRE.FindStringSubmatch(m[1])
		if len(p) == 3 {
			i, err := strconv.Atoi(p[2])
			if err == nil {
				return i
			}
		}
	}
	return 0
}
```

So if the search API returns pages with empty `items` while still sending a
`next` link,
 the loop walks page after page until the link finally stops,
 the
process is killed,
 or,
 as here,
 the primary search rate limit returns a 403
(which surfaces as an error from `s.search` at `pkg/search/searcher.go:169` and
aborts the loop).

`--limit` does not bound the number of requests.
 It defaults to 30 and is
validated to the `1..1000` range at `pkg/cmd/search/issues/issues.go:72-73,128`:

```go
cmd.Flags().IntVarP(&opts.Query.Limit, "limit", "L", 30, "Maximum number of results to fetch")
```

`--limit` becomes `per_page` (capped at 100) and the kept-item count,
 not a cap
on pages requested.
 With empty pages it provides no termination at all.

### Why the pages were empty here: the `jdx/mise` issue-search ghost index

For this specific reproduction,
 every page returned `total_count: 732` with an
empty `items` array and `search_type: "lexical"`:

```json
{
  "total_count": 732,
  "incomplete_results": false,
  "items": [],
  "search_type": "lexical"
}
```

The empty `items` are a server-side condition (see the sibling section:
 jdx/mise
has Issues disabled,
 so the advanced issue-search index serves stale ghost
counts it cannot hydrate into items).
 The gh client defect is independent of the
cause:
 any page that returns zero items while advertising a `next` link drives
the fan-out.
 The empty-page condition is the trigger;
 the missing empty-page
guard is the bug.

### Secondary amplifier: per-page GraphQL feature detection

`s.search` re-runs feature detection on every page for issue queries,
 at
`pkg/search/searcher.go:205-225`:

```go
if query.Kind == KindIssues {
	features, err := s.detector.SearchFeatures()
	...
}
```

`detector.SearchFeatures()` at
`internal/featuredetection/feature_detection.go:341` makes a GraphQL request to
read the `SearchType` enum (to decide whether to send `advanced_search=true`)
at `internal/featuredetection/feature_detection.go:409-410`:

```go
gql := api.NewClientFromHTTP(d.httpClient)
if err := gql.Query(d.host, "SearchType_enumValues", &searchTypeFeatureDetection, nil); err != nil {
```

It is not memoized across the pagination loop,
 so the 31-page issue search also
fired 31 `POST /graphql` requests.
 GraphQL has a separate,
 larger budget (5000
points per hour;
 the trace showed it draining only `4128 -> 4098`),
 so it is not
the rate-limit gate,
 but it doubles the request count for `gh search issues` and
is a real "hidden request" for issue searches.
 (`gh search code`/`commits`/
`repos` do not call `SearchFeatures`,
 so they have no GraphQL amplifier.
)

Note `gh search prs` also hits `/search/issues`:
 `pkg/cmd/search/prs/prs.go:24-25`
sets `Kind: search.KindIssues` with `Qualifiers{Type: "pr"}`,
 so PR search runs
the same loop and the same per-page feature detection.
 There is no
`/search/prs` REST endpoint.

## Verification

Versions under test:

-   `gh version 2.93.0 (2026-05-27)`.
-   cli/cli `main` at `7f885723a9cb72cd4318eef3c831f8a7bb9d9093`,
     fresh shallow
    clone on 2026-06-02.
     The investigation clone used for source citations was
    cloned at the same time from the same `main`.

### Failing case (reproduces the fan-out and the 403)

```bash
GH_DEBUG=api gh search issues --repo jdx/mise "rust" --limit 3 --json number,title 2>trace.log
# EXIT=1
grep -c '^> GET /search/issues' trace.log    # 31
grep -c '^> POST /graphql'       trace.log    # 31
grep -i '^< x-ratelimit-resource:' trace.log | sort | uniq -c   # 31 search, 31 graphql
grep '403 Forbidden' trace.log                # the page=31 response
```

Observed:
 31 `GET /search/issues` (pages 1 to 31,
 `per_page=3`),
 31
`POST /graphql`,
 search `X-Ratelimit-Remaining` draining `29 -> 0`,
 and the
`page=31` GET returning the primary-limit 403 above.
 `gh api rate_limit`
reported the search resource at `30/30` both immediately before and immediately
after (per-minute window reset).

### Working case (single request, returns items)

```bash
gh api -X GET search/issues -f q='repo:jdx/mise rust components' -f per_page=20 \
  --jq '{total_count, items_len: (.items|length), first: .items[0].title}'
# {"first":"fix(rust): store toolchain options on idiomatic requests","items_len":20,"total_count":52}
```

Exactly one `GET /search/issues`,
 no GraphQL,
 no pagination loop,
 items
returned.
 This raw call does not set `advanced_search=true`,
 so it does not take
the gh feature-detection path.

### Prototype fix (verified pre-patch failing, post-patch passing)

The minimal fix adds an empty-page guard to all four search loops in
`pkg/search/searcher.go`:
 when a page returns zero items,
 no progress toward the
limit is possible,
 so stop.
 The full diff (the four-hunk guard plus a regression
test) is at [gh-search-rate-limit.patch](gh-search-rate-limit.patch).

The guard added after `numItemsToRetrieve = numItemsToRetrieve - numItemsToAdd`
in each of `Code`,
 `Commits`,
 `Repositories`,
 `Issues`:

```go
		// A page with no items cannot advance us toward the requested limit.
		// The search API can report Total > 0 yet return an empty Items array
		// together with a rel="next" link (observed with the advanced issue
		// search lexical backend). Without this guard the loop follows next
		// links across the entire result set, ignoring the limit and
		// exhausting the per-minute search rate limit.
		if len(page.Items) == 0 {
			break
		}
```

The regression test `TestSearcherIssuesStopsOnEmptyPage`
(`pkg/search/searcher_emptypage_test.go` in the patch) registers a single
`search/issues` stub returning `total_count: 732`,
 `items: []`,
 and a
`rel="next"` link to page 2,
 then asserts the searcher makes only one request.
Verified in an isolated `golang:1.26` container (no ambient credentials,
 source
mounted read-write only for the disposable prototype clone):

```text
# pre-patch (unmodified searcher.go): the loop fans out to an unstubbed page 2
--- FAIL: TestSearcherIssuesStopsOnEmptyPage (0.00s)
    Received unexpected error: Get ".../search/issues?page=2&per_page=3&q=rust":
    no registered HTTP stubs matched
FAIL  github.com/cli/cli/v2/pkg/search

# post-patch (empty-page guard): stops after page 1, existing tests unaffected
--- PASS: TestSearcherIssuesStopsOnEmptyPage (0.00s)
--- PASS: TestSearcherIssues (all subtests)
--- PASS: TestSearcherIssuesAdvancedSyntax (all subtests)
ok    github.com/cli/cli/v2/pkg/search
```

The full `pkg/search` suite passes post-patch,
 so the guard does not regress the
real pagination paths (`paginates_results`,
 `collect_full_and_partial_pages`).

## Verified workarounds

### Use a single `gh api -X GET search/issues` request instead of `gh search`

```bash
# issues
gh api -X GET search/issues -f q='repo:jdx/mise rust components' -f per_page=20 --jq '.items[].number'
# pull requests (no /search/prs endpoint exists; add the type:pr qualifier)
gh api -X GET search/issues -f q='repo:jdx/mise rust type:pr' -f per_page=20 --jq '.items[].number'
```

This bypasses the pagination loop entirely:
 one request,
 no GraphQL feature
detection,
 no fan-out.
 Tradeoffs:
 you get a single page (at most `per_page=100`
items),
 so collecting more than 100 results means paginating deliberately by
incrementing `-f page=N`,
 at one primary-search request each (stay under 30 per
minute);
 you build the `q` string yourself rather than via gh's flags;
 and the
raw endpoint does not opt into advanced issue search,
 so its result shape can
differ from `gh search issues` (here,
 returning hydratable items rather than the
ghost-index empties).

### Read the primary search budget with `gh api rate_limit`, but do not trust it as a go-ahead

```bash
gh api rate_limit --jq '.resources.search'
# {"limit":30,"remaining":30,"reset":1780441772,"used":0}
```

This reports the primary search limit (30 per minute).
 Tradeoffs:
 it does not
surface the secondary (abuse) limit at all,
 and,
 more importantly for this bug,
the primary search window is per-minute and a single `gh search` invocation can
consume all 30 at once.
 A `30/30` reading does not mean the next `gh search`
will succeed.
 Use it to confirm you have a fresh window before a deliberately
paginated `gh api` loop,
 not as proof that a fan-out-prone `gh search` is safe.

## What does not work

-   **Looping or polling `gh search` (including retry-on-403).
    ** Each invocation
    re-triggers the same fan-out and can drain the whole minute budget;
     retrying
    on the 403 just waits for the per-minute reset and then burns the next 30 on
    the next invocation.
     Polling makes it strictly worse.
-   **Lowering `--limit`.
    ** `--limit` bounds kept items and `per_page`,
     not the
    number of requests.
     `--limit 3` still fired 31 requests here.
     Raising or
    lowering it does not change the empty-page fan-out.
-   **Trusting the `gh api rate_limit` search counter as a green light.
    ** As
    above,
     the per-minute window resets and a single invocation can consume it
    entirely,
     so `30/30` is not evidence the next `gh search` will complete.

## Draft upstream issue: a matching issue already exists, so comment, do not file

### Check for an existing issue (done 2026-06-02)

Searched the cli/cli tracker with single `gh api -X GET search/issues` requests
(not `gh search`,
 to avoid this very fan-out).
 The closest match is open:

-   [cli/cli#10426](https://github.com/cli/cli/issues/10426) "API rate limit when
    requesting 1000 code search results" (open;
     labels `bug`,
     `needs-triage`,
    `platform`).
     Same failure family:
     a single `gh search` invocation fans out
    one request per page and exhausts the per-minute primary search limit,
     with
    `gh api rate_limit` showing a full budget because of the window reset.
     Its
    trigger differs (`gh search code --limit 1000` legitimately needing ten
    `per_page=100` pages over the 10-per-minute code-search budget),
     but it is
    the same gh pagination-versus-rate-limit defect.
     In the thread,
     maintainer
    `@BagToad` notes the confusing "hidden request consuming quota",
     which for
    issue search is exactly the per-page GraphQL feature detection documented
    above.
-   [cli/cli#3292](https://github.com/cli/cli/issues/3292) "Does the CLI honor
    response headers for throttling and ratelimits?
    " (open) is the broad
    rate-limit-handling feature discussion (`--paginate-delay`,
     exit codes,
    backoff).
     Maintainer states it has not been dug into and asks reporters to
    categorize.
     Related but not the same defect.

Per repo policy and the troubleshooting-doc duplicate rule,
 a duplicate report
is itself a publicity incident:
 do not open a second issue.
 The contribution is
an additive comment on #10426 carrying what the thread lacks.

### Five-constraint audit (for the record)

1.  **Is it really upstream's fault?
    ** Yes,
     for the client behaviour.
     The
    pagination loop in `pkg/search/searcher.go` has no empty-page guard and
    re-runs feature detection per page.
     The empty-`items`-with-`next`-link
    response is GitHub's server,
     but the gh client should defend against it
    rather than fan out.
2.  **Can upstream fix it?
    ** Yes,
     trivially:
     the four-hunk guard in
    [gh-search-rate-limit.patch](gh-search-rate-limit.patch).
3.  **Are they supporting this use case?
    ** Yes.
     `gh search issues --limit` is a
    documented,
     first-class command and the pagination is their code.
4.  **Will they likely fix it?
    ** Soft yes.
     The search path is actively
    maintained (the in-progress advanced-issue-search migration).
     #10426 is open
    and labeled `bug` with no won't-fix signal;
     #3292 shows the team
    acknowledges rate-limit-handling gaps.
     No maintainer has declined a
    comparable fix.
5.  **Have we prototyped a minimal fix?
    ** Yes,
     verified pre-patch failing and
    post-patch passing with the full `pkg/search` suite green
    ([gh-search-rate-limit.patch](gh-search-rate-limit.patch)).

All five hold,
 but because #10426 already exists the fileable artefact is the
additive comment below,
 not a new issue.

### Additive comment posted to cli/cli#10426

Posted 2026-06-02 as
[cli/cli#10426 (comment)](https://github.com/cli/cli/issues/10426#issuecomment-4607753229).
The text below is the as-posted record.

~~~md
A related and arguably worse manifestation of this, on `gh search issues`
rather than `gh search code`, where even a tiny `--limit` fans out.

`gh version 2.93.0`, cli/cli `main` at `7f885723`.

Reproduction:

```
GH_DEBUG=api gh search issues --repo jdx/mise "rust" --limit 3 --json number,title
```

This fired 31 `GET /search/issues` (pages 1 to 31, `per_page=3`) and returned a
primary-limit 403 on page 31:

```
< X-Ratelimit-Resource: search
< X-Ratelimit-Limit: 30
< X-Ratelimit-Remaining: 0
< X-Ratelimit-Used: 30
```

Every successful page returned `total_count: 732` with an empty `items` array
(`search_type: "lexical"`) and a `rel="next"` link. In `pkg/search/searcher.go`
the loop decrements only by `min(len(page.Items), numItemsToRetrieve)`, so an
empty `items` array never decrements `numItemsToRetrieve`, and the loop follows
`nextPage(link)` across the whole result set. `--limit` bounds kept items and
`per_page`, not the number of requests.

Re: the "hidden request consuming quota" you noted, for issue search there is
one: `s.search` calls `s.detector.SearchFeatures()` on every page
(`searcher.go` issue branch), and `SearchFeatures` issues a `POST /graphql`
(`internal/featuredetection/feature_detection.go`), not memoized across the
loop. The same run fired 31 `POST /graphql` alongside the 31 search GETs.
(GraphQL has its own larger budget so it is not the gate here, but it is a real
per-page extra request for `gh search issues`/`prs`.)

A minimal guard that stops the loop when a page returns no items fixes the
fan-out for all four search kinds:

```go
if len(page.Items) == 0 {
    break
}
```

I verified this against `main` with a regression test that stubs a single empty
`items` page carrying a `rel="next"` link and asserts only one request is made;
pre-patch it fans out to an unstubbed page 2, post-patch it stops, and the full
`pkg/search` suite stays green.
~~~

## Issue-search ghost counts and date-qualifier zeros on a repo with Issues disabled (not a gh bug)

A separate gotcha surfaced while investigating the above,
 on the same repo.
 It
is recorded so a future session does not chase it as a date-qualifier defect.

### Observation

All via `gh api -X GET search/issues -f q='<QUERY>' -f per_page=1 --jq '.total_count'`
on 2026-06-02:

-   Non-date issue qualifiers return non-zero:
     `repo:jdx/mise is:issue is:closed`
    returns 1544.
-   Date-qualified recent issue queries return 0:
    `repo:jdx/mise is:issue created:>2026-05-20` returns 0,
    `... updated:>2026-05-20` returns 0,
    `... type:issue state:closed closed:>=2026-05-03` returns 0.

That looks like a broken date qualifier,
 but it is not.

### The date qualifier works; the data is a frozen ghost index

Disambiguating probes (each one `gh api -X GET search/issues` request):

-   Wide-open issue date ranges return the full counts,
     so the qualifier
    filters correctly:
     `is:issue created:>=2015-01-01` returns 1570 and
    `is:issue closed:>=2015-01-01` returns 1544 (matching the non-date control).
-   PR date queries return correct non-zero recent counts:
    `is:pr created:>2026-05-20` returns 149,
     `is:pr updated:>2026-05-20`
    returns 192.
-   Issue date boundaries:
     `is:issue created:>=2025-01-01` returns 98 and
    `updated:>=2025-01-01` returns 160,
     but every 2026 window
    (`created:>=2026-01-01`,
     `updated:>=2026-01-01`) returns 0.
-   `advanced_search=true` and `advanced_search=false` give the same counts.

So the date qualifier is sound;
 the issue index simply contains no 2026 records.
The reason is in the repo metadata:

```bash
gh api repos/jdx/mise --jq '{has_issues, open_issues_count}'
# {"has_issues":false,"open_issues_count":63}
gh api repos/jdx/mise/issues/1
# HTTP 410: Issues are disabled for this repo
```

`jdx/mise` has its Issues tab disabled.
 The advanced issue-search index retains
stale ghost records of the formerly-enabled issues:

-   It reports `total_count` (1570 total,
     1544 closed,
     732 for "rust"),
     frozen at
    the last indexed activity (2025;
     zero 2026 records).
-   It returns `items: []` for issue queries because the underlying issues are
    gone (410),
     so they cannot be hydrated.
     `gh api -X GET search/issues -f
    q='repo:jdx/mise is:issue' -f sort=created -f order=desc -f per_page=3`
    returns `total_count: 1570` with `items` length 0,
     whereas the same shape on
    `repo:cli/cli is:issue` returns items,
     and `repo:jdx/mise is:pr` returns
    items.
     The core (non-search) endpoint confirms it:
     every recent
    `repos/jdx/mise/issues` entry is a pull request,
     and there are zero non-PR
    issues.

This ghost index is also the server-side trigger for the fan-out documented
above:
 `gh search issues --repo jdx/mise` walks empty issue pages because the
issues are disabled.

### What this means in practice

-   A non-zero `total_count` from `search/issues` for `is:issue`/`type:issue`
    does not guarantee retrievable items.
     On a repo with Issues disabled the
    count is a ghost and `items` is empty.
-   Date-qualified zeros are not proof the date qualifier is broken.
     Confirm with
    a wide-open date range (must match the full count) and a PR date query (must
    match recent volume) before suspecting the qualifier.
-   To check recent issue reality,
     use the core endpoint and the repo's
    `has_issues` flag,
     not the search index.
     `has_issues: false` plus an
    `HTTP 410` from `repos/<owner>/<repo>/issues/<n>` means there are no live
    issues regardless of what `search/issues` counts report.

This is GitHub server-side behaviour (a stale search index for a disabled-issues
repo),
 not a gh CLI defect,
 so there is nothing to file against cli/cli for it.
