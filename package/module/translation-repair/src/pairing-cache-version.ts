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

 Rides inside 3 too: every gather now keeps a seat that answered unreadably
 out of the same-prompt retry rounds and re-asks each such seat, whichever
 round it came in, in the nudged recovery round (ledger P2, `005692e11`),
 which changes whose voices a round closes on; checked on 2026-09-28: still no
 slice-cache file newer than 00:26 on 2026-09-27.

 Rides inside 3 too: a reply whose complete JSON value more text follows is
 read rather than lost (ledger P8, `cac097368`), which changes whose voices
 every round hears; checked on 2026-09-28: still no slice-cache file newer
 than 00:26 on 2026-09-27.

 Rides inside 3 too: a reply that could not be used is re-asked once,
 nudged, of the same model on another provider through the uniqueness
 wrapper's claims (ledger P9, `7011d72cc`), which changes whose voices every
 round hears; checked on 2026-09-28: still no slice-cache file newer than
 00:26 on 2026-09-27.

 Rides inside 3 too: Bedrock reads dry with 1.33 USD still left, and its
 ledger holds every billed attempt at its bound (ledger P1, `2a108dfb3`,
 `107763dbb` and `7cfd5ae4b`), so a Gemma call moves to OpenRouter sooner
 as Bedrock nears its credit, which changes whose voices a round hears;
 checked on 2026-09-28: still no slice-cache file newer than 00:26 on
 2026-09-27.

 Rides inside 3 too: the recovery round re-asks a reply the length
 limit cut with a nudge naming the cut, apart from one off the shape
 (ledger P10, `ce0ef7b51`), which changes what such a seat is asked and
 whose voices a round hears; checked on 2026-09-28: still no slice-cache
 file newer than 00:26 on 2026-09-27.

 Rides inside 3 too: both keys fold the roster that answers (ledger X13),
 so a pairing one bench settled is never resumed for another; every key
 moves, and none was written under 3. Same check, same result.

 Rides inside 3 too: both keys serialize their material as one JSON value
 through `pairingQuestionKey` (ledger X15), so no two questions share a key,
 and every key moves again; checked on 2026-09-28: still no slice-cache file
 newer than 00:26 on 2026-09-27.

 THE PRE-LAUNCH CHECK OF 2026-09-28 (ledger M28): 3 was set
 in `d614a0c1d` at 00:30 on 2026-09-28, after the newest slice-cache file under the
 agent runs (00:26 on 2026-09-27), and no slice-cache file has been written
 since, so no answer cached under an earlier question can be served under
 this number. Every source commit since then rides inside it, those the
 accounts above name and those they do not (`cache-account-audit.ts`, ledger M28).

 @example
 ```ts
 const material = JSON.stringify({ version: PAIRING_CACHE_VERSION, question, source, target, pictures, roster, },);
 ```
 */
export const PAIRING_CACHE_VERSION = 3;

//endregion Pairing cache version
