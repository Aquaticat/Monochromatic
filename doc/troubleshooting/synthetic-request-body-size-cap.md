# Synthetic request body size cap

Fact base for a support report to [Synthetic],
against `https://api.synthetic.new/openai/v1/chat/completions`.
We are grateful for the service;
this document exists because one failure mode is reported as a parse error
when it appears to be a size limit,
and because the limit is not documented.

Everything attributed below is stated with its source,
because the size observations were reported to this repository rather than measured in it.
What this repository can measure about its own traffic is measured and marked as such.

## Summary

A request whose body exceeds roughly 10 MiB returns `400`
with a message naming a JSON parse failure:

```text
Could not parse request as valid JSON. Unterminated string in JSON at position 1044xxxx
```

The body sent is valid,
complete JSON.
The reporter verified this by capturing the body locally and replaying it with plain `curl`.

- A body of exactly 10485760 bytes succeeds.
- A body of roughly 10.2 MiB fails.
- The same cutoff appears when the upload is throttled to 1 MB/s,
  so the boundary is a byte count rather than a timeout.

The reading that fits those observations is that the gateway truncates the body near 10 MiB
and then parses the truncated text,
which fails inside whatever string the cut landed in.
The reported position,
around 1044xxxx,
sits just under the 10 MiB boundary,
which is consistent with that reading.

## What is asked of the provider

- Return `413` for a body over the limit,
  rather than a `400` naming a parse failure in a body that parses.
  The current message sends a caller to look for malformed JSON that is not there.
- Document the limit.
  The chat completions documentation encourages base64 images
  and names no request size cap.

## Why the misleading error costs more than the limit does

The reporter hit this from an agent workflow that attaches images.
Once the accumulated history passes the cap,
every subsequent request fails,
and the session cannot recover on its own,
because a caller reading the error has no reason to suspect size.
A `413` would let a client drop or downscale attachments and continue.

## What this repository sends today, measured

Measured on 2026-08-21 against the pinned corpus and the shipped reading stage.

- `package/module/translation-repair/src/image-reading-stage.ts` sends ONE picture per request,
  as a `text` part followed by a single `image_url` part carrying a base64 data URI.
  There is no accumulating history,
  so the growth mode the report describes does not apply here.
- `READING_MAX_BYTES` in that file is 8388608 raw bytes.
  MEASURED 2026-08-22 by serializing the exact body the stage builds,
  with `~/temp/agent/measure-168-body.mjs`:
  at that ceiling the body is 11185335 bytes,
  which is 699575 above the only size known to pass.
  So the refusal threshold this repository configures permits a request the gateway would reject,
  and the rejection would arrive as the parse error rather than as a refusal naming size.
- The overhead around the picture is a constant 501 bytes,
  the 342 byte instruction plus the JSON envelope,
  so a raw ceiling maps onto a body size exactly and monotonically.
  The largest raw picture whose body still fits is 7863927 bytes,
  for a body of 10485759 and one byte of headroom.
  7863930 gives 10485763 and does not fit,
  so that boundary is bisected rather than estimated.
- Nothing in the pinned corpus comes close.
  The largest asset is 1344454 bytes of 291 assets,
  whose body measures 1793131 bytes,
  leaving 8692629 under the passing size.

The exposure is therefore the configured ceiling rather than current traffic.

## The ceiling this repository will configure

DECIDED 2026-08-22 on the body measurement recorded in this document,
made with `~/temp/agent/measure-168-body.mjs`.
It is recorded rather than asked because nothing is traded away by it:
the new ceiling is still more than five times the largest asset in the corpus,
so no picture that is read today would be refused.

`READING_MAX_BYTES` becomes 7340032,
seven mebibytes.
Its body measures 9787235 bytes,
which leaves 698525 under the passing size.

NOT the exact fit of 7863927.
Only the passing size is exact.
The failing size is reported as approximate and the true boundary between them has never been bisected,
so a ceiling with one byte of headroom rests on an assumption rather than on a measurement.
Seven mebibytes also absorbs growth in the instruction text,
which is part of the constant.

STILL OWED,
and queued behind the source freeze recorded in
`doc/handover/translation-repair-run-continuity.md`:

- The constant lowered in `package/module/translation-repair/src/image-reading-stage.ts`.
- A refusal reason naming transport rather than the model.
  `too-large-for-model` describes the derivation it replaced,
  and the picture is now refused for what the gateway will carry
  rather than for what the model will read.
- Re-raising the gateway's parse failure as a size refusal.
  Lowering the ceiling makes the picture path safe;
  it does not make the error honest,
  and a body pushed over by anything other than a picture still arrives as a parse error.

## What is not ruled out

- Only the passing size,
  10485760 bytes,
  is exact.
  The failing size is reported as approximate.
  The true boundary between them has not been bisected.
- Whether the cap belongs to the gateway or to a proxy in front of it.
- Whether streaming and non-streaming requests share the boundary.
- Whether other endpoints share it.
- Whether the limit counts bytes on the wire or bytes after any transfer encoding.

Repro scripts and captures were offered by the reporter and can be shared if useful.
