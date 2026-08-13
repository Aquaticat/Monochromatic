// What:     `package dev.monochromatic.musicplayer` places this UI preference beside
//           `MainActivity` and `SessionStore`.
// Why:      Both the Compose page selector and Android persistence use the same named values.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies the module namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `internal enum class PageControlStyle` declares five fixed page-navigation
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
//   | 'CHROMIUM_TABS';
// ```
/**
 * Defines page-control style choices shared by UI and preference persistence.
 */
internal enum class PageControlStyle {
    // What:     `RADIO` is the radio-control variant and first-install default.
    // Why:      Pages should use radio controls unless the user chooses another style.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // 'RADIO'
    // ```
    /** Uses wrapping radio controls. */
    RADIO,

    // What:     `MD1_TABS` is the wrapping Material Design 1 tab variant.
    // Why:      Users can choose flat tabs with selected underlines instead of radios.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // 'MD1_TABS'
    // ```
    /** Uses wrapping Material Design 1 tabs. */
    MD1_TABS,

    // What:     `ROUNDED_BUTTONS` preserves the previous filled/outlined button variant.
    // Why:      Existing users can retain the earlier rounded page controls.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // 'ROUNDED_BUTTONS'
    // ```
    /** Uses the previous rounded page buttons. */
    ROUNDED_BUTTONS,

    // What:     `SEGMENTED_BUTTONS` is the joined content-width button variant.
    // Why:      Users can choose compact grouped buttons matching the supplied reference.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // 'SEGMENTED_BUTTONS'
    // ```
    /** Uses wrapping segmented page buttons. */
    SEGMENTED_BUTTONS,

    // What:     `CHROMIUM_TABS` is the content-width browser-tab variant.
    // Why:      Users can choose raised active tabs matching the supplied Chromium reference.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // 'CHROMIUM_TABS'
    // ```
    /** Uses wrapping Chromium-like page tabs. */
    CHROMIUM_TABS;

    // What:     `companion object` is the enum's shared static-like namespace.
    // Why:      Preference decoding belongs beside the variants it recognizes.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // namespace PageControlStyle { ... }
    // ```
    /** Decodes persisted enum names without throwing on stale values. */
    companion object {
        // What:     `fromStoredName` finds the enum entry with a matching `.name`.
        // Why:      Missing and unknown preference values must use radio controls.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // function fromStoredName(name: string | null): PageControlStyle { ... }
        // ```
        /** Returns matching style, or radio controls when no stored name is usable. */
        internal fun fromStoredName(name: String?): PageControlStyle {
            return entries.firstOrNull { style -> style.name == name } ?: RADIO
        }
    }
}
