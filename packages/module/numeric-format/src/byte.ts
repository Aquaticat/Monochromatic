/**
 * IEC binary byte formatter (KiB / MiB / GiB) for developer-facing
 * size display.
 *
 * Not covered by `Intl.NumberFormat` because the CLDR unit list used
 * by `Intl.supportedValuesOf("unit")` contains only SI decimal byte
 * units (`byte`, `kilobyte`, `megabyte`, `gigabyte`, `terabyte`,
 * `petabyte`). The IEC binary units (`kibibyte`, `mebibyte`,
 * `gibibyte`) are absent, so any consumer that needs `KiB` / `MiB` /
 * `GiB` display has to hand-roll the format. For SI byte display,
 * call `Intl.NumberFormat` directly instead of this helper.
 *
 * @module
 */

import {
  BYTES_PER_GIB,
  BYTES_PER_KIB,
  BYTES_PER_MIB,
} from '@monochromatic-dev/module-numeric-const';

/**
 * Format a byte count as a human-readable IEC binary string.
 *
 * - GiB scale: one decimal, e.g. `1.5 GiB`
 * - MiB scale: one decimal, e.g. `123.4 MiB`
 * - KiB scale and below: whole KiB, e.g. `512 KiB`, `0 KiB`
 *
 * @param bytes - raw byte count
 *
 * @returns formatted size with IEC binary unit suffix
 *
 * @example
 * formatBytes(1_048_576); // "1.0 MiB"
 * formatBytes(1_073_741_824); // "1.0 GiB"
 * formatBytes(2_048); // "2 KiB"
 */
export function formatBytes(bytes: number,): string {
  if (bytes >= BYTES_PER_GIB)
    return `${(bytes / BYTES_PER_GIB).toFixed(1,)} GiB`;
  if (bytes >= BYTES_PER_MIB)
    return `${(bytes / BYTES_PER_MIB).toFixed(1,)} MiB`;
  return `${(bytes / BYTES_PER_KIB).toFixed(0,)} KiB`;
}
