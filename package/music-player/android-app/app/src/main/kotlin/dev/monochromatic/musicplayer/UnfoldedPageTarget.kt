// What:     `package dev.monochromatic.musicplayer` places this pure presentation model
//           beside `PlayerUiState`, with no Android or Compose dependency.
// Why:      Host JVM tests can verify unfolded folder and letter navigation without a device.
//
// In TS you'd write (pseudocode):
// ```ts
// // The file path supplies module identity.
// ```
package dev.monochromatic.musicplayer

// What:     `internal data class UnfoldedPageTarget` declares an immutable value record with
//           structural equality. `internal` exposes it only inside this Gradle module;
//           siblings include file-private `private` and unrestricted `public` visibility.
// Why:      Folder rendering and tests need each visible label paired with its real page index,
//           including duplicate labels whose identities differ.
//
// In TS you'd write (pseudocode):
// ```ts
// type UnfoldedPageTarget = Readonly<{ pageIndex: number; label: string }>;
// ```
/** Carries one unfolded folder target's stable page index and visible label. */
internal data class UnfoldedPageTarget(
    /** Page position forwarded unchanged to [PlayerController.selectPage]. */
    val pageIndex: Int,
    /** Human-readable folder label from pagination. */
    val label: String,
)

// What:     `internal fun unfoldedFolderTargets(state: PlayerUiState): List<UnfoldedPageTarget>`
//           declares a module-visible pure function returning a read-only generic list.
//           `List<T>` is a non-mutating view; siblings include mutable `MutableList<T>`, fixed
//           `Array<T>`, and unordered `Set<T>`. A read-only list preserves pagination order.
// Why:      One place converts identity-preserving page indices into renderable folder targets.
//
// In TS you'd write (pseudocode):
// ```ts
// function unfoldedFolderTargets(state: PlayerUiState): readonly UnfoldedPageTarget[];
// ```
/** Returns valid folder pages in pagination order while ignoring stale indices defensively. */
internal fun unfoldedFolderTargets(state: PlayerUiState): List<UnfoldedPageTarget> {
    // What:     `return state.folderPageIndices.mapNotNull { ... }` transforms every recorded
    //           folder index and removes null results. The `{ pageIndex -> ... }` trailing lambda
    //           is Kotlin's callback syntax, comparable to a TS arrow function.
    // Why:      A transient mismatched snapshot must omit an invalid target instead of indexing
    //           outside `pageLabels` and crashing the screen.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return state.folderPageIndices.flatMap((pageIndex) => {
    //   const label = state.pageLabels[pageIndex];
    //   return label === undefined ? [] : [{ pageIndex, label }];
    // });
    // ```
    return state.folderPageIndices.mapNotNull { pageIndex ->
        // `getOrNull` returns null instead of throwing for a stale index.
        /** Holds one valid folder label retained by this mapping callback. */
        val label: String = state.pageLabels.getOrNull(pageIndex) ?: return@mapNotNull null
        // Construct one immutable target retained by `mapNotNull`.
        UnfoldedPageTarget(pageIndex = pageIndex, label = label)
    }
}

// What:     `internal fun unfoldedLetterTargets(state: PlayerUiState): List<String>` declares
//           a pure function returning ordered writing-system labels. Kotlin `String` is immutable
//           UTF-16 text; sibling `Char` holds one code unit. `String` matches Compose text input.
// Why:      The 48dp rail needs each folder initial or root bucket once, independent of duplicate
//           folder and root-page captions.
//
// In TS you'd write (pseudocode):
// ```ts
// function unfoldedLetterTargets(state: PlayerUiState): readonly string[];
// ```
/** Returns distinct uppercase folder initials and root-bucket labels with `#` last. */
internal fun unfoldedLetterTargets(state: PlayerUiState): List<String> {
    // What:     `val folderIndices: Set<Int> = state.folderPageIndices.toSet()` copies indices
    //           into a read-only set. `Set<T>` provides membership by value; siblings include
    //           ordered `List<T>` and mutable `MutableSet<T>`. A set avoids repeated linear scans.
    // Why:      Every page classification below asks whether its index denotes a folder.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const folderIndices = new Set(state.folderPageIndices);
    // ```
    /** Holds folder membership for repeated page-kind checks. */
    val folderIndices: Set<Int> = state.folderPageIndices.toSet()
    // What:     `val labels: List<String> = state.pageLabels.mapIndexedNotNull { ... }` maps each
    //           page with its numeric index and removes null results. The result remains ordered.
    // Why:      Folder pages contribute their first character; root pages contribute their
    //           already-bucketed label; empty folder labels contribute nothing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const labels = state.pageLabels.flatMap((label, index) => {
    //   const value = folderIndices.has(index) ? label[0] : label;
    //   return value === undefined ? [] : [value.toUpperCase()];
    // });
    // ```
    /** Holds one normalized rail label per classified page before deduplication. */
    val labels: List<String> = state.pageLabels.mapIndexedNotNull { index, label ->
        if (index in folderIndices) {
            label.firstOrNull()?.uppercaseChar()?.toString()
        } else {
            label.uppercase()
        }
    }
    // What:     `return labels.distinct().sortedWith(...)` removes later duplicates, then sorts
    //           through a comparator built from two keys: whether a label is `#`, then the label.
    // Why:      Alphabetic targets stay ordered while the catch-all target remains last.
    // Gotcha:   `compareBy` receives Kotlin lambdas rather than TS comparator subtraction;
    //           booleans sort `false` before `true`, which places ordinary labels before `#`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return [...new Set(labels)].sort((a, b) =>
    //   (a === "#" ? 1 : 0) - (b === "#" ? 1 : 0) || a.localeCompare(b));
    // ```
    return labels.distinct().sortedWith(compareBy<String> { it == "#" }.thenBy { it })
}

// What:     `internal fun unfoldedPageForLetter(state: PlayerUiState, letter: String): Int?`
//           declares a pure lookup returning nullable `Int?`: either a signed 32-bit page index
//           or null. Sibling integer types include `Long`, `Short`, and unsigned `UInt`; `Int`
//           matches Kotlin collection indices without conversion.
// Why:      A rail action must forward a real page index while preferring folders over a same-label
//           root bucket, which keeps the folder picker visible after selecting its initial.
//
// In TS you'd write (pseudocode):
// ```ts
// function unfoldedPageForLetter(state: PlayerUiState, letter: string): number | null;
// ```
/** Resolves a rail label to its first folder page, or to its matching root bucket. */
internal fun unfoldedPageForLetter(state: PlayerUiState, letter: String): Int? {
    // What:     `val normalizedLetter: String = letter.uppercase()` creates an uppercase copy.
    //           Kotlin strings are immutable, so the input is unchanged.
    // Why:      Folder initials and root labels compare under the same visible rail casing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const normalizedLetter = letter.toUpperCase();
    // ```
    /** Holds caller label in the same casing used by rendered rail targets. */
    val normalizedLetter: String = letter.uppercase()
    // What:     `val folderMatch: Int? = ...firstOrNull { ... }` searches recorded folder indices
    //           and returns the first matching index or null. Safe calls prevent stale indices or
    //           empty labels from throwing.
    // Why:      Selecting `C` should reveal the first C folder, matching the accepted Camellia view.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const folderMatch = state.folderPageIndices.find((index) =>
    //   state.pageLabels[index]?.[0]?.toUpperCase() === normalizedLetter);
    // ```
    /** Holds first matching folder page index, or null when no folder starts with this label. */
    val folderMatch: Int? = state.folderPageIndices.firstOrNull { pageIndex ->
        state.pageLabels
            .getOrNull(pageIndex)
            ?.firstOrNull()
            ?.uppercaseChar()
            ?.toString() == normalizedLetter
    }
    if (folderMatch != null) {
        return folderMatch
    }
    // What:     `return state.pageLabels.indices.firstOrNull { ... }` searches valid page indices
    //           and returns the first non-folder page whose normalized label matches, or null.
    // Why:      A library with root-level tracks but no matching folder still has usable rail pages.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return state.pageLabels.findIndex((label, index) => !folderIndices.has(index) && label.toUpperCase() === normalizedLetter) ?? null;
    // ```
    return state.pageLabels.indices.firstOrNull { pageIndex ->
        pageIndex !in state.folderPageIndices && state.pageLabels[pageIndex].uppercase() == normalizedLetter
    }
}
