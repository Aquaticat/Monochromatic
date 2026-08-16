// What:     `package dev.monochromatic.musicplayer` places this UI preference beside
//           `MainActivity` and `SessionStore`.
// Why:      Both the Compose page selector and Android persistence use the same named values.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies the module namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `internal enum class PageControlStyle` declares six fixed page-navigation
//           treatments visible inside this app module. Sibling shapes could be a string
//           union or sealed class; an enum gives stable `.name` strings for preferences.
// Why:      The settings page needs mutually exclusive typed choices that can be persisted
//           and exhaustively rendered.
//
// In TS you'd write (pseudocode):
// ```ts
// type PageControlStyle =
//   | 'RADIO'
//   | 'MD1_TABS'
//   | 'ROUNDED_BUTTONS'
//   | 'SEGMENTED_BUTTONS'
//   | 'CHROMIUM_TABS'
//   | 'LED_SEGMENTED_BUTTONS';
// ```
/**
 * Defines page-control style choices shared by UI and preference persistence.
 */
internal enum class PageControlStyle(
    /** Human-readable Settings label. */
    val displayLabel: String,
    /** One-line build availability toggle. */
    val includedInBuild: Boolean,
) {
    // What:     `RADIO` is the radio-control variant and unknown-value fallback.
    // Why:      Stale persisted names degrade to stable style value zero.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // 'RADIO'
    // ```
    /** Uses wrapping radio controls. */
    RADIO(displayLabel = "Radio controls", includedInBuild = true),

    // What:     `MD1_TABS` is the wrapping Material Design 1 tab variant.
    // Why:      Users can choose flat tabs with selected underlines instead of radios.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // 'MD1_TABS'
    // ```
    /** Uses wrapping Material Design 1 tabs. */
    MD1_TABS(displayLabel = "Multi-row MD1 tabs", includedInBuild = true),

    // What:     `ROUNDED_BUTTONS` preserves the previous filled/outlined button variant.
    // Why:      Existing users can retain the earlier rounded page controls.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // 'ROUNDED_BUTTONS'
    // ```
    /** Uses the previous rounded page buttons. */
    ROUNDED_BUTTONS(displayLabel = "Rounded buttons", includedInBuild = true),

    // What:     `SEGMENTED_BUTTONS` is the joined content-width button variant.
    // Why:      Users can choose compact grouped buttons matching the supplied reference.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // 'SEGMENTED_BUTTONS'
    // ```
    /** Uses wrapping segmented page buttons. */
    SEGMENTED_BUTTONS(displayLabel = "Segmented buttons", includedInBuild = true),

    // What:     `CHROMIUM_TABS` is the content-width browser-tab variant and first-install default.
    // Why:      Fresh installs begin with compact raised tabs matching the Chromium reference.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // 'CHROMIUM_TABS'
    // ```
    /** Uses wrapping Chromium-like page tabs. */
    CHROMIUM_TABS(displayLabel = "Chromium-like tabs", includedInBuild = true),

    // What:     `LED_SEGMENTED_BUTTONS` is the reflective hardware-cap variant.
    // Why:      Users can choose latched, glowing LED page buttons based on the supplied reference.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // 'LED_SEGMENTED_BUTTONS'
    // ```
    /** Uses wrapping LED hardware page buttons. */
    LED_SEGMENTED_BUTTONS(displayLabel = "Super fun LED segmented buttons", includedInBuild = true);

    // What:     `companion object` is the enum's shared static-like namespace.
    // Why:      Preference decoding belongs beside the variants it recognizes.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // namespace PageControlStyle { ... }
    // ```
    /** Decodes persisted enum names and owns effective build availability. */
    companion object {
        /** Lists only styles included by one-line enum toggles. */
        internal val includedStyles: List<PageControlStyle>
            get() = entries.filter(PageControlStyle::includedInBuild)
        // What:     `fromStoredName` distinguishes missing first-install state from unknown values.
        // Why:      Missing preferences choose Chromium while stale names retain radio fallback.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // function fromStoredName(name: string | null): PageControlStyle { ... }
        // ```
        /** Returns resolved first-install, matching, or unknown-value style for this build. */
        internal fun fromStoredName(name: String?): PageControlStyle {
            /** Decodes missing state separately from stale persisted names. */
            val decoded: PageControlStyle = if (name == null) {
                CHROMIUM_TABS
            } else {
                entries.firstOrNull { style -> style.name == name } ?: RADIO
            }
            return resolvePageControlStyle(
                PageControlStyleResolutionOptions(
                    requested = decoded,
                    included = includedStyles,
                ),
            )
        }
    }
}

/** Groups requested style with styles included by current build. */
internal data class PageControlStyleResolutionOptions(
    /** Style decoded from first-install or persisted state. */
    val requested: PageControlStyle,
    /** Styles available to Settings and renderer. */
    val included: List<PageControlStyle>,
)

/** Reports invalid build configuration with no page-control style. */
internal class PageControlStyleAvailabilityError : IllegalStateException(
    "At least one PageControlStyle entry must set includedInBuild = true.",
)

/** Resolves requested style through Chromium, radio, then first-included fallback chain. */
internal fun resolvePageControlStyle(options: PageControlStyleResolutionOptions): PageControlStyle {
    if (options.requested in options.included) return options.requested
    if (PageControlStyle.CHROMIUM_TABS in options.included) return PageControlStyle.CHROMIUM_TABS
    if (PageControlStyle.RADIO in options.included) return PageControlStyle.RADIO
    return options.included.firstOrNull() ?: throw PageControlStyleAvailabilityError()
}
