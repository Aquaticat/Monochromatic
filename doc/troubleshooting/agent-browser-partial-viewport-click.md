# agent-browser 0.36.0: a partly visible download button has an off-screen click point

## Symptom

The Promise lesson's `download #download-reference <path>` command timed out:

```text
Operation timed out. The page may still be loading or the element may not exist.
```

The page was complete, the button existed, and its containing disclosure was open.
Process `proc_a208` had passed the chat and workshop checks before reaching this download.
The failure was not evidence that the download listener or generated file was broken.

## Root cause

Inspected release: `v0.36.0`, commit `eb05921bad874cd2a1b4fa5d1149f1ed26576cae`.
The read-only source clone is `~/temp/agent/agent-browser-quality-explorer-2026-09-06`.
Paths in this section are relative to that clone.

`cli/src/native/actions.rs:6722` defines `handle_download`.
It configures download handling, subscribes to events, then calls `interaction::click`.
`cli/src/native/interaction.rs:37` obtains the point from `resolve_element_center`:

```rust
// cli/src/native/interaction.rs
let (x, y, effective_session_id) = resolve_element_center(
```

The CSS-selector path in `cli/src/native/element.rs:763` generates this visibility test:

```javascript
// JavaScript emitted by cli/src/native/element.rs
const inView = (r) => r.width > 0 && r.height > 0 &&
    r.bottom > 0 && r.right > 0 &&
    r.top < (window.innerHeight || document.documentElement.clientHeight) &&
    r.left < (window.innerWidth || document.documentElement.clientWidth);
```

It scrolls only when that test fails, but subsequently chooses the rectangle's center:

```javascript
// JavaScript emitted by cli/src/native/element.rs
if (!inView(rect)) {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    rect = el.getBoundingClientRect();
}
const x = rect.x + rect.width / 2;
const y = rect.y + rect.height / 2;
```

The measured button rectangle after the failed command was:

- Top: `565.140625` CSS pixels.
- Height: `48` CSS pixels.
- Bottom: `613.140625` CSS pixels.
- Viewport height: `577` CSS pixels.

The rectangle intersects the viewport, so `inView` is true.
Its center is at `589.140625`, outside that viewport.
`document.elementFromPoint()` at the measured center returned no element.
The visibility predicate and the chosen interaction point answer different questions.

## Verification and workaround

Working catalog:

- `scrollintoview '#download-reference'` before the native download command.
- Read the resulting rectangle and assert that its center hits the intended element.
- The revised driver applies this to native clicks and downloads.
  `proc_28b9` passed the whole advanced suite, downloads, and an unfiltered empty-error check.
- `proc_f17b` reopened and exercised those downloaded files.

Failing catalog:

- The partially visible button in the default `1280 × 577` content viewport.
- Inferring a failed application listener from the tool's generic timeout.

Runnable local implementation:
`~/temp/agent/promises-revision/verify-advanced.mjs`, invoked by `mise run test:advanced`.
The additional hit check is:

```javascript
// In the target document, after scrollintoview.
const element = document.querySelector("#download-reference");
const rect = element.getBoundingClientRect();
element.contains(document.elementFromPoint(
  rect.x + rect.width / 2,
  rect.y + rect.height / 2
));
```

Tradeoff:
explicit scrolling changes viewport position.
It does not establish a general fix for fixed off-screen elements,
wrapped inline fragments, overlays, or every frame coordinate system.
Those inputs were not substituted for this measured button.

## What does not work

- Treating intersection with the viewport as proof that the rectangle's center is visible.
- Treating command submission as proof that the button received the click.
- Changing lesson download code to compensate for an off-screen input point.
- Classifying this as the wrapped-inline-element problem without measuring client rectangles.

## Upstream filing decision

Initial conjunctive searches returned no matches.
Broader issue searches for `scroll` and PR searches for `click` found related work.
The bodies and comments of [issue #1044][issue], [PR #1073][scroll-pr],
and [PR #1756][fragment-pr] were read in full.

The current source already has conditional scrolling.
The older wholly-off-screen report is not proof that this version lacks it.
The wrapped-inline PR concerns another geometry problem and is not treated as this incident's fix.

1.  Fault: the inspected CSS-selector predicate permits the measured off-screen center.
2.  Fixability: scrolling and point selection are implemented upstream;
    the related PR proposes changes at that boundary.
3.  Supported use: native clicks and downloads are documented commands.
4.  Contribution policy: no contribution file or issue/PR template exists in the inspected clone.
    `AGENTS.md` addresses AI contributors; a tracker search for `AI-generated` found no matching policy report.
5.  Direction: collaborator responses on PR #1073 support improving scroll-before-interaction behavior.
6.  Prototype: the consumer sequence was verified, not an upstream patch.
    PR #1073 is a candidate, not an independently verified remedy for this precise partial-visibility case.

The skill-relative `.out-of-scope/` directory was absent.
No new issue or comment is prepared or filed.
An upstream contribution would first require reproducing this bounded case against that candidate patch;
it must not be represented as an already verified upstream fix.
The local workaround does not depend on upstream acceptance.

[issue]: https://github.com/vercel-labs/agent-browser/issues/1044
[scroll-pr]: https://github.com/vercel-labs/agent-browser/pull/1073
[fragment-pr]: https://github.com/vercel-labs/agent-browser/pull/1756
