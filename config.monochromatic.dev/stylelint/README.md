# stylelint

## `.stylelintrc.json` don't support comments, so I'm documenting the decisions here.

### Descending

Turned off as recommended because I use lots of nesting.

### Missing

Sometimes we're defining `@font-face`, which includes a generic font family keyword in itself.
We won't need to add another generic font family keyword every time we use it.

### Unknown

We don't really wanna disallow more unknown directives than what Stylelint disallows by default.

I tend to use lots of cutting edge CSS features and I don't wanna wait for Stylelint to catch up.

### Allowed, disallowed & required

We don't wanna enforce that either.

Sometimes it's easier to write it in whatever format you want, however you want.
I don't see that increasing maintainance cost significantly.

#### length-zero-no-unit

See https://www.oddbird.net/2022/08/04/zero-units/ for why we ignore custom properties.

### Case

> We don't wanna enforce that either.
>
> Sometimes it's easier to write it in whatever format you want, however you want.
> I don't see that increasing maintainance cost significantly.

### Empty lines

> We don't wanna enforce that either.
>
> Sometimes it's easier to write it in whatever format you want, however you want.
> I don't see that increasing maintainance cost significantly.

### Max & min

> We don't wanna enforce that either.
>
> Sometimes it's easier to write it in whatever format you want, however you want.
> I don't see that increasing maintainance cost significantly.

I always found those limitations arbitary.

### Notation

We do need to name our `font-weight` whenever possible, and relatives are preferred.

### Pattern

Mostly turned off.

Otherwise we can't start our "private" custom properties with an underscore
without letting Stylelint use all the resources by using a regex to check.

### Whitespace inside

Turned off.
We wanna use `/*region And */` `/*endregion*/` markers.
