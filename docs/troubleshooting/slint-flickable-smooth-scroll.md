# Slint Flickable smooth-scrolls touchpad gestures but not the mouse wheel until release 1.16.1; the wheel fix is merged upstream but unreleased

Slint 1.16.1's `Flickable` has momentum (fluent) scrolling,
 but only for
touchpad and touchscreen gestures.
 Discrete mouse-wheel events jump
instantly with no animation.
 The mouse-wheel animation exists upstream
(slint-ui/slint#11338,
 merged 2026-04-15) but diverged from the 1.16 release
line,
 so it is absent from every published release through 1.16.1
(2026-04-23) and ships only on master.
 `music-player` pins a Slint master
revision to get it.

## Symptom

Scrolling the queue list:

- With a touchpad or touchscreen:
   the list glides and keeps moving after the
  fingers lift (momentum),
   then decelerates.
   This is present in 1.16.1.
- With a mouse wheel:
   each wheel notch moves the list by a fixed step
  instantly,
   with no easing or momentum.
   The list snaps to the new position
  on every notch.
   This is the behaviour 1.16.1 ships.

There is no `smooth-scroll` property to set.
 Searching the 1.16.1 source for
`smooth-scroll` / `smooth_scroll` returns nothing,
 and the `Flickable`
builtin exposes only `viewport-*`,
 `interactive`,
 and the `flicked` callback
(`internal/compiler/builtins.slint:181-189`).

## Root cause

Momentum scrolling lives in the `Flickable` item's native Rust code,
 not in
markup.
 It is automatic,
 with no opt-in property.

The animation is driven by `FlickableDataInner::animate`,
 which runs a
constant-deceleration physics simulation on `viewport_y`
(`internal/core/items/flickable.rs:490-532` in tag `v1.16.1`):

```rust
let animation_y = physics_simulation::ConstantDecelerationParameters::new(
    dist.y as f32 / (millis as f32 / 1000.),
    DECELERATION,
);
viewport_y.set_physic_animation_value(limit.y_length(), animation_y);
```

`animate` is called only from `TouchPhase::Ended`,
 and it requires a recent
move sample with non-zero velocity within `MAX_DURATION` (100ms).
 Touchpads
and touchscreens emit a `Started` / `Moved` / `Ended` phase sequence carrying
that velocity,
 so they get the fling.
 A discrete mouse wheel does not produce
that phase sequence with velocity,
 so in 1.16.1 the `TouchPhase::Moved` arm
sets the viewport directly with no animation
(`internal/core/items/flickable.rs:459-470`,
 tag `v1.16.1`):

```rust
TouchPhase::Moved => {
    // ...
    self.position_time_rb.push(crate::animations::current_tick(), new_pos);
    viewport_x.set(new_pos.x_length());
    viewport_y.set(new_pos.y_length());
    self.last_scroll_event = Some((crate::animations::current_tick(), position));
}
```

The mouse-wheel animation was added later in slint-ui/slint#11338
("fix:
 animate wheel scrolling",
 merged 2026-04-15,
 closes issue #11312
"Flickable:
 Implement scroll animation also for mouse wheel events").
 It
animates the wheel case with a fixed 180ms cubic-bezier easing when there is
no fling velocity,
 using the property's native animated set
(diff of `internal/core/items/flickable.rs` in that PR):

```rust
const WHEEL_SCROLL_DURATION: i32 = 180;
const WHEEL_SCROLL_EASING: EasingCurve = EasingCurve::CubicBezier([0.0, 0.0, 0.58, 1.0]);
// ...
let animation = Self::wheel_scroll_animation();
viewport_x.set_animated_value(new_pos.x_length(), animation.clone());
viewport_y.set_animated_value(new_pos.y_length(), animation);
```

That commit (`ce79e9393`) is not an ancestor of `v1.16.1`.
 The GitHub compare
`v1.16.1...ce79e9393` reports `status: diverged, ahead_by: 1, behind_by: 55`:
the 1.16 release line branched before the wheel fix,
 so the fix is on master
only.
 Cargo reports the master crates as version `1.17.0`,
 so the fix lands in
the 1.17 release.
 Grepping the `v1.16.1` clone for the PR's markers
(`WHEEL_SCROLL_DURATION`,
 `wheel_scroll_animation`,
 `set_animated_value` in
`flickable.rs`) returns nothing,
 confirming its absence.

### Why the custom scrollbar still tracks the animation

`music-player` binds its custom scrollbar to the viewport with a two-way
binding (`value <=> flick.viewport-y` in `ui/app.slint`).
 The native physics
animation (1.16.1) and the native wheel animation (#11338) both install their
animated binding via `Property::set_binding`,
 which honours the existing
binding's `intercept_set_binding`
(`internal/core/properties.rs:642-652`).
 A two-way binding's
`intercept_set_binding` redirects the incoming binding onto the shared
`common_property`
(`internal/core/properties/two_way_binding.rs:26-29`),
 so the animation lands
on the common property that both `viewport-y` and the scrollbar `value` read.
The thumb therefore animates in lockstep with the content;
 the two-way
binding does not block smooth scrolling.

## Verification

Version under test:
 Slint `v1.16.1`,
 clone grafted at commit
`e9c1ca295f9356af71f1e251c287de18406b46f6` (tag `v1.16.1`),
 at
`/tmp/agent/slint-1161-wrap`.
 Upstream metadata read with `gh api` against
`slint-ui/slint` on 2026-06-01.

What works in 1.16.1:

- Touchpad / touchscreen momentum scrolling on any `Flickable` (and any
  `ScrollView` / `ListView`,
   which wrap a `Flickable`).
   No property needed.

What does not animate in 1.16.1:

- Mouse-wheel scrolling.
   Each notch is an instant step.

Upstream state of the wheel fix on 2026-06-01:

- slint-ui/slint#11338 merged to master 2026-04-15 (merge commit
  `ce79e9393`).
- Latest published release:
   `v1.16.1` (2026-04-23).
   No newer release exists.
- `ce79e9393...master` reports `ahead_by: 683, behind_by: 0`,
   so master HEAD
  (`85e3eb76`,
   2026-06-01) contains the fix.

## Verified workaround

Pin Slint to a master revision that contains #11338.
 `music-player`'s
`Cargo.toml` pins both `slint` and `slint-build` to rev `85e3eb76` (master
HEAD on 2026-06-01,
 which Cargo resolves as slint `1.17.0`) with a
justification comment.
 That revision requires rustc 1.92 or newer,
 above
Fedora 41's packaged 1.91.1,
 so the `Containerfile` installs the Rust
toolchain with rustup (current stable,
 rustc 1.96 at last rebuild) instead of
the distro `rust` package.
 The experimental builtins flag the app already sets
for `FlexboxLayout` (`SLINT_ENABLE_EXPERIMENTAL_FEATURES=1` in the
`Containerfile`) is unrelated to scrolling and continues to apply;
 the jump
from 1.16.1 to 1.17.0 compiles `ui/app.slint` (FlexboxLayout included) clean
under `cargo clippy --release -- -D warnings`.

Trade-offs:

- Building from git compiles the Slint crates from source instead of using a
  crates.
  io artifact,
   so the first build after the bump is slower and needs
  network access inside the build container.
- Master is ahead of the last release by hundreds of commits,
   so unreleased
  changes (including experimental-API drift in `FlexboxLayout`) ride along.
  The pin is a fixed rev,
   not `branch = "master"`,
   so the exact Slint commit
  is fixed and `cargo update` cannot move it.
   Cargo.
  lock is gitignored repo-wide
  (`*.lock`),
   so the rev pin,
   not a committed lockfile,
   is what fixes Slint;
  non-Slint transitive deps still resolve to latest-compatible semver.

Revert condition:
 once a Slint release that includes #11338 ships (a minor
above 1.16,
 or a 1.16.
x backport if upstream cherry-picks it),
 drop the git
pin and return `slint` / `slint-build` to a crates.
io `version` requirement.

## What does not work

- A `smooth-scroll` property:
   none exists in 1.16.1.
   The PR that proposed an
  opt-out `smooth-scroll` property on `Flickable` and `ScrollView`
  (slint-ui/slint#9440) was closed unmerged;
   the maintainer closed it with
  "We now have smooth scrolling" once the property-less physics path landed.
- A markup `animate viewport-y { ... }` on the `Flickable`:
   it does not smooth
  the mouse wheel.
   A markup `animate` only wraps assignments made through the
  generated component accessor (`internal/compiler/generator/rust.rs:2306-2311`
  emits `set_animated_value` at the generated set site).
   The `Flickable` sets
  `viewport-y` from its own native Rust handler,
   bypassing the generated
  accessor,
   so the markup animation never sees the wheel-driven change.
- Relying on the std `ScrollView` instead of the custom Flickable:
   the fluent
  `ScrollView` adds no scroll animation of its own
  (`internal/compiler/widgets/fluent/scrollview.slint`);
   it inherits exactly
  the same `Flickable` behaviour,
   so it is no smoother than the custom
  scrollbar on a mouse wheel.

## Why we do not file this upstream

Per the troubleshooting-doc 5-constraint check,
 this would be filed only if
all five held.
 They do not,
 because the fix already exists upstream:

1. Upstream's behaviour?
    Yes,
    the missing mouse-wheel animation was upstream
   behaviour,
    now intentionally changed.
2. Can upstream fix it?
    Already fixed in #11338.
3. Supporting the use case?
    Yes;
    issue #11312 requested it and was accepted
   and closed by the fix.
4. Will they fix it?
    Already merged;
    pending release.
5. Prototyped a minimal fix?
    Not applicable;
    upstream's own merged change is
   the fix.

There is nothing to report:
 the only open item is the release timing,
 which
is upstream's to schedule.
 The local action is the git pin above plus the
revert condition,
 not a new issue.
