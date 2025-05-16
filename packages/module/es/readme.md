## Difference with the specs

### Mutational methods

Methods that mutate the original value passed in or called on are not implemented.

### this

The usage of "this" is not implemented where applicable.

### Array

#### Array.prototype.copyWithin

Don't see a use case for this.
Plus, it's a mutational method.

Did not implement.

## Other stuff not included

### deepmerge

Use [`jsr:@rebeccastevens/deepmerge`](https://github.com/RebeccaStevens/deepmerge-ts) instead.

### match

Use [`ts-pattern`](https://github.com/gvergnaud/ts-pattern) instead.
