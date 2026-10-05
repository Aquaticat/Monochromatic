//region Decorative vectors accompany the accepted action labels
// What: Package shares the checked debug action identities.
// Why: An icon never replaces the action's visible or accessible name.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose the installed Material icon properties.
// Why: Reuse the existing debug icon dependency rather than drawing approximate symbols.
//
// In TS you'd write (pseudocode):
// ```ts
// import { icons } from 'material-icons';
// ```
import androidx.compose.material.icons.Icons
// Playback action vector.
import androidx.compose.material.icons.filled.PlayArrow
// Shuffle action vector.
import androidx.compose.material.icons.filled.Shuffle
// Re-analysis action vector.
import androidx.compose.material.icons.filled.Refresh
// File-manager action vector.
import androidx.compose.material.icons.filled.FolderOpen
// Copy-name action vector.
import androidx.compose.material.icons.filled.ContentCopy
// Information action vector.
import androidx.compose.material.icons.outlined.Info
// Destructive action vector.
import androidx.compose.material.icons.outlined.Delete
// Native vector type is distinct from a bitmap or a string path.
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * What: A named function returns one vector through explicit string comparisons.
 * Why: The closed action set cannot silently receive an unrelated fallback icon.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function trackMenuActionIcon(id: string): ImageVector { /* known icon or throw */ }
 * ```
 */
internal fun trackMenuActionIcon(id: String): ImageVector {
    if (id == "play") return Icons.Filled.PlayArrow
    if (id == "shuffle-here") return Icons.Filled.Shuffle
    if (id == "details") return Icons.Outlined.Info
    if (id == "analyse") return Icons.Filled.Refresh
    if (id == "show") return Icons.Filled.FolderOpen
    if (id == "copy-name") return Icons.Filled.ContentCopy
    if (id == "trash") return Icons.Outlined.Delete
    throw IllegalArgumentException("Unknown authored menu icon: $id")
}
//endregion
