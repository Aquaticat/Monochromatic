Ideally we want `index.css` to be generated as part of Astro build pipeline using a custom integration,
to avoid declaring languages your website won't use.

I have a suspicion that it won't matter since it's mostly repeating content,
which compression algorithms compress quite well.

UPDATE: I think it actually do matter.
        After generating the full lang codes, the index.css file reaches 34MB.
