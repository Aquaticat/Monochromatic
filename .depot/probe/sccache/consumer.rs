/// What: Import public library functions; `::` selects items from a module.
/// Why: Exercise the compiled library from an independent executable.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { normalizationGain, truePeakInterleaved } from 'truepeak-core';
/// ```
use truepeak_core::{normalization_gain, true_peak_interleaved};

/// What: `fn main` is the executable entry point and returns no value.
/// Why: A successful process verifies the linked library's actual behavior.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function main(): void { /* verify the imported library */ }
/// ```
fn main() {
    if normalization_gain(0.25) != 1.0 {
        // What: Exit with a failing status; `::` selects the standard process function.
        // Why: Report an unexpected gain without using formatting macros.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // process.exit(7);
        // ```
        std::process::exit(7);
    }
    // What: `&[0.5]` lends a read-only fixed array of samples to the function.
    // Why: A single sample must preserve its amplitude without interpolation.
    // Gotcha: The function borrows the array; it does not take ownership.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (truePeakInterleaved(new Float32Array([0.5]), 1) !== 0.5) process.exit(8);
    // ```
    if true_peak_interleaved(&[0.5], 1) != 0.5 {
        // Exit on an unexpected measured amplitude.
        std::process::exit(8);
    }
    return;
}
