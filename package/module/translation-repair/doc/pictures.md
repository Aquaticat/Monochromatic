# Reading the pictures a document shows

Part of [the package README](../README.md).

A document that shows a picture carrying text is a document whose translation cannot be judged from its text alone.
The pipeline reads those pictures and puts the reading beside the source and the archive,
as evidence a later stage may consult.
Nothing in the reading decides what ships.

## Deterministic first, and usually last

`tesseract` runs before any model is asked,
with `chi_sim+eng`.
Under 16 solid characters the picture is recorded as carrying no text,
no model is asked about it,
and no finding calls that a shortfall,
because it is the correct answer:
119 of the 191 pictures in the reference corpus carry no text at all,
most of them being photographs of people.

It gates rather than votes,
which was settled by measurement and is the opposite of what it looks like it should be.
Its trigram overlap against the model readings is 0.019 and 0.023 on one asset and 0.096 and 0.111 on another,
while those models agree with each other at 0.643 and 0.785.
It is not missing the text:
on the first asset it returns 405 characters against their 390 and 394.
It reads the same text and gets the GLYPHS wrong,
which leaves length intact and destroys overlap,
so letting it vote would refuse readings that are fine.
What it is reliable at is PRESENCE,
six of six against the models in both directions.

Noise can clear its line:
a painting's canvas returned 24 characters on `Uekawakuyuurei/IMG_1308.webp`,
so the models were asked and every one reported that the picture carries no text.
Since 2026-09-04 such a reply is an absence report (`reports-no-text`),
not a refusal:
it is not asked again,
and two readers reporting absence,
or answering with fewer characters than a transcript (the hull number on `img370.webp`),
confirm the picture textless past the noise.
The verdict is recorded with the readers that confirmed it and resumed like the deterministic one;
a reader that declines to read (`reads-as-refusal`) is still re-asked and still leaves the picture unread.
The refused reply's opening is logged,
since it carries the model's words about the picture and never the picture's text.

## Four readers, and a reader asked again

A reading may be used only when a second model,
shown the same picture and not the first model's answer,
agrees with the first at the corroboration threshold.
A single reading is refused rather than passed along with a caveat.

The cross-provider vision sub-roster remains four after Synthetic GLM-5.3-Flash replaced GLM-5.2.
The replacement reads images on Synthetic but has no inherited Charm Hyper route.
Corroboration still requires independent agreement,
and a declined reading is still asked again up to four times.
The retry measurement that follows predates the third reader and must not be read as its measured refusal rate.

Measured over the whole corpus,
119 reader and picture pairs reached a model,
109 read on the first ask,
and 1 more read only after being asked again.
Of the 9 that never produced a reading,
6 refused through all four asks,
while 2 exited on the length screen and 1 on an empty reply.
Neither of those is a refusal and neither is asked again.
So a decline is usually about the picture,
and sometimes about the roll:
on one text-bearing asset asked six times per model,
`hf:Qwen/Qwen3.6-27B` read it six times of six and `hf:moonshotai/Kimi-K3` twice of six,
transcribing the same text either way.
Re-asking costs about 20 extra calls over a corpus pass and recovers the roll case when it happens.

## What is sent, and what is not

Pictures are sent as they are.
No re-encode,
no format change,
no downscaling,
no tiling.
An earlier byte ceiling was this package's own estimate of what a vision model would accept,
derived from base64 length against context length,
and it was wrong in kind:
a vision model tokenizes a picture by resolution in tiles,
not by base64 length.
Sent unchanged,
an asset four times that ceiling comes back read for 2631 characters.
A plain 8 MiB ceiling remains,
which nothing in the reference corpus approaches.

The provider accepts `image/jpeg`,
`image/png`,
`image/gif`,
`image/webp`,
`image/tiff` and `image/bmp`,
and refuses AVIF with an HTTP 400.

## Deployment dependency

`tesseract` must be on the path,
with the `chi_sim` and `eng` language data installed,
or every picture is recorded as unreadable by the deterministic reader and every one of them is sent to two models.
Decoding needs `dwebp` for webp assets;
ImageMagick is tried as a fallback and cannot be relied on for that format.
