# Qt 6.11.1 QML SIGSEGV on teardown in QQmlDelegateModelItem::destroyObjectLater with nested async-Loader reuseItems ListViews

A QML scene built from nested `ListView`s with `reuseItems: true`, whose delegates are
wrapped in asynchronous `Loader`s (the shape a virtualized column-strip file manager
needs, see [qt-qml-listview-fast-scroll-recycling.md](qt-qml-listview-fast-scroll-recycling.md)),
crashes with SIGSEGV on application teardown. The run itself is fine at a steady 60 fps;
the segfault happens only on shutdown, inside Qt's reusable-delegate pool drain.

This doc is being kept live while the fix (present in Qt 6.12) is built and tested;
sections marked "pending build" are updated when that completes.

## Symptom

- The app (or the standalone `qml` runtime) exits with SIGSEGV, `rc=139`, `core dumped`,
  during teardown at application quit, not during the run.
- Reproduces headless (no display), so it is teardown logic, not rendering:
  `QT_QPA_PLATFORM=offscreen qml strip-virtualization.qml` still segfaults on exit.
- Trigger shape: nested `ListView`s with `reuseItems: true` whose pane content is built
  by asynchronous `Loader`s. Without `reuseItems` there is no crash (but fast scroll
  stutters to 32 to 35 fps). With `reuseItems` the run holds 60 fps and then crashes on
  quit.
- Backtrace (Fedora release build, symbols from the system libraries):

```text
#0  QQmlDelegateModelItem::destroyObjectLater            (libQt6QmlModels.so.6)
#1  QQmlDelegateModelPrivate::destroyCacheItem
#2  QQmlReusableDelegateModelItemsPool::drain
#3  QQmlDelegateModelPrivate::~QQmlDelegateModelPrivate
#5  QQmlDelegateModel::~QQmlDelegateModel
#6  QQuickItemView::~QQuickItemView                       (libQt6Quick.so.6)
#7  QQuickListView (QQmlPrivate::QQmlElement<...>::~)
#8  QObjectPrivate::deleteChildren                        (libQt6Core.so.6)
#10 QQuickLoader (QQmlElement<...>::~)                    (a Loader being destroyed)
#13 QQuickRectangle (QQmlElement<...>::~)
#16 QQuickItem (QQmlElement<...>::~)                      (the column delegate)
#19 LoaderApplication::~LoaderApplication                 (qml runtime root)
#20 main
```

## Root cause

The recursive teardown reaches an inner `ListView`, whose delegate model drains its
reuse pool, and the pool drain dereferences an already-freed delegate object. Walking
the chain in `qtdeclarative` v6.11.1 (`src/qmlmodels/qqmldelegatemodel.cpp`):

The delegate-model destructor unconditionally drains the reuse pool:

```cpp
// qqmldelegatemodel.cpp:182
QQmlDelegateModelPrivate::~QQmlDelegateModelPrivate()
{
    qDeleteAll(m_finishedIncubating);

    // Free up all items in the pool
    drainReusableItemsPool(0);
}
```

`drainReusableItemsPool(0)` releases every pooled item through `destroyCacheItem`:

```cpp
// qqmldelegatemodel.cpp:1142
void QQmlDelegateModelPrivate::drainReusableItemsPool(int maxPoolTime)
{
    m_reusableItemsPool.drain(maxPoolTime, [this](QQmlDelegateModelItem *cacheItem){ destroyCacheItem(cacheItem); });
}
```

`destroyCacheItem` calls `destroyObjectLater` on any item that still has an object:

```cpp
// qqmldelegatemodel.cpp:637
void QQmlDelegateModelPrivate::destroyCacheItem(QQmlDelegateModelItem *cacheItem)
{
    if (QObject *object = cacheItem->object()) {
        emitDestroyingItem(object);
        cacheItem->destroyObjectLater();
    }
    ...
```

`destroyObjectLater` reads the object's `QQmlData` and tears down its context:

```cpp
// qqmldelegatemodel.cpp:2574
void QQmlDelegateModelItem::destroyObjectLater()
{
    Q_ASSERT(m_object);
    Q_ASSERT(m_contextData);

    QQmlData *data = QQmlData::get(m_object);
    Q_ASSERT(data);
    if (data->ownContext) {
        data->ownContext->clearContext();
        data->ownContext->deepClearContextObject(m_object);   // <- fault
        data->ownContext.reset();
        data->context = nullptr;
    }
    ...
```

In a release build the `Q_ASSERT`s are compiled out. When the outer column delegate (an
async-`Loader`-wrapped `Item`) is destroyed by `QObject::deleteChildren` during the
recursive app-exit teardown, the inner `ListView`'s reuse pool still holds pooled
delegate items whose backing object and context have already been freed by that same
recursive destruction. The pool drain then runs `QQmlData::get(m_object)` and
`ownContext->...` over freed memory, giving the use-after-free SIGSEGV. The function
already carries a `QTBUG-87228` comment about app-exit destruction, so this exact path
has prior teardown-bug history.

Refuted hypotheses (do not re-derive these):

- "It is `reuseItems` alone." Disproven: a single `ListView` with `reuseItems` and a
  100000-row model (`min1.qml`) tears down cleanly, `rc=0`.
- "It is any 2-level nesting." Disproven: a horizontal `ListView` of columns, each a
  vertical `ListView` (`min2.qml`, `reuseItems` on both), also tears down cleanly,
  `rc=0`. The crash needs the deeper structure with async `Loader`-wrapped nested
  ListViews, as in the full harness.

## Verification

- Version under test: `qt6-qtdeclarative-6.11.1-2.fc44`. Source cross-checked against
  `qt/qtdeclarative` tag `v6.11.1` (`qqmldelegatemodel.cpp` blob
  `52d9db5da0c5db0207f40bf4b3b6b1310d7cdc20`).
- Harness: `packages/desktop-app/file-manager-qt/bench/strip-virtualization.qml`.
  Headless repro:

```sh
QT_QPA_PLATFORM=offscreen QT_FORCE_STDERR_LOGGING=1 \
  QT_LOGGING_RULES="*.debug=false;qml.debug=true" \
  /usr/lib64/qt6/bin/qml strip-virtualization.qml   # -> Segmentation fault (rc 139) on exit
```

- Crash-threshold catalog (all headless, `QT_QPA_PLATFORM=offscreen`):
  - Clean teardown, `rc=0`: single `ListView` + `reuseItems` + 100000 rows (`min1.qml`).
  - Clean teardown, `rc=0`: 2-level columns-of-row-lists + `reuseItems` (`min2.qml`).
  - SIGSEGV, `rc=139`: 3-level columns to panes to rows with async `Loader`-wrapped
    nested ListViews + `reuseItems` (the full harness).
  - Clean teardown, `rc=0`, with `reuseItems: false`: no crash, but fast-scroll fps
    stutters to 32 to 35 (fails the 60 fps requirement).

## The fix is upstream in Qt 6.12

The crash-site code changed between v6.11.1 and 6.12. In `destroyObjectLater`, v6.11.1's

```cpp
data->ownContext->clearContext();
```

is replaced in tag `v6.12.0-beta1` (and `dev`) by

```cpp
data->ownContext->emitDestruction();
data->ownContext->clearExpressions();
```

`emitDestruction()` exists in 6.11.1, but `clearExpressions()` does not: it is a new
`QQmlContextData` method introduced with a 6.12 teardown refactor (the dev commit
"QtQml: Split ~QQmlContextData() into smaller parts"). So this is not a one-line 6.11.1
backport; it rides that refactor. Whether 6.12 actually removes the crash is being
confirmed by building 6.12 and running the same headless repro (pending build).

## Verified workarounds

- Flatten the structure (verified, `rc=0`). A plain 2-level column view (a horizontal
  `ListView` of columns, each column a single vertical row `ListView`), with
  `reuseItems` on both and no async `Loader` wrapping, keeps recycling performance and
  tears down cleanly. Tradeoff: pane-type selection (image preview vs directory list)
  cannot use a naive async `Loader`; use a `DelegateChooser`, or a single delegate that
  holds both an `Image` and a row list and toggles visibility. Whether that avoids the
  crash with mixed pane types is still to be confirmed.
- Disable `reuseItems` (verified, `rc=0`). No crash, but fast-scroll fps stutters to 32
  to 35. Tradeoff: fails the 60 fps requirement, so not viable on its own.
- Update to Qt 6.12 (pending build). The teardown code is changed there; confirmation
  pending the build test above.

## What does not work

- `reuseItems: true` is required for 60 fps fast scroll (without it, 32 to 35 fps) but
  is exactly what triggers the teardown crash in the nested async-`Loader` structure.
- A larger `cacheBuffer` does not help: it made the fast-scroll warmup dip worse (17 fps)
  and did not prevent the teardown crash.

## Upstream filing decision

Pending the 6.12 build test. Preliminary read of the six constraints:

- Constraint 1 (upstream's fault): yes, the fault is entirely inside Qt's
  `QQmlReusableDelegateModelItemsPool::drain` teardown path; no app C++ is in the trace.
- Constraint 2 (can upstream fix it): yes, and it appears they already did, via the
  `QQmlContextData` teardown split in 6.12.
- Constraints 3 to 5: to be filled after confirming the 6.12 behavior and searching
  `bugreports.qt.io` for an existing report of this exact backtrace.
- Constraint 6 (minimal fix prototype): the upstream change is identified; a local
  prototype/backport is blocked on the new `clearExpressions()` method, so the prototype
  is the 6.12 build itself. Result pending.

If the 6.12 build removes the crash, the outcome is "already fixed upstream in 6.12; no
new issue; update or backport," and this section records that rather than a new-issue
draft. `bugreports.qt.io` duplicate search and the `.out-of-scope/` check are done
before any filing.

## Related

- [qt-qml-listview-fast-scroll-recycling.md](qt-qml-listview-fast-scroll-recycling.md):
  why `reuseItems` is required (60 fps vs 11 fps), and the benchmark harness.
