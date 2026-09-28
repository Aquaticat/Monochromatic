//region Pairing cache version

/**
 Generation shared by section and block roster-pairing question identities.
 
 Version two requires exact-half participation before straggler grace.
 Version one implicitly began grace after two usable voices.

 Version three (2026-09-28) moves with the rules that close a pairing round,
 which changed twice after version two landed on 2026-08-29 without moving
 it (ledger M28): the pairing stages read their round in windows with retry
 rounds since `33a023445` (2026-09-09), and size their quorum on the seats
 that could answer since `a107c7486` and `29baade8f` (2026-09-27). A pairing
 settled under the older rule could resume on a round the current rule would
 not have closed. The pictures a sheet was shown are keyed separately
 (`blockPairingQuestionKey`).

 @example
 ```ts
 const material = [PAIRING_CACHE_VERSION, sourceText, targetText,];
 ```
 */
export const PAIRING_CACHE_VERSION = 3;

//endregion Pairing cache version
