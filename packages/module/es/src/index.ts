// run vite build twice.

export * from './any.constant.ts';
export * from './any.echo.ts';
export * from './any.identity.ts';
export * from './any.toExport.ts';
export * from './any.type.ts';
export * from './any.typeOf.ts';

export * from './array.of.ts';
export * from './array.type.mapTo.ts';
export * from './array.type.tuple.ts';
export * from './array.type.withoutFirst.ts';

export * from './boolean.equal.ts';
export * from './boolean.not.ts';

export * from './error.assert.equal.ts';
export * from './error.assert.throw.ts';
export * from './error.is.ts';
export * from './error.throw.ts';
export * from './error.throws.ts';

export * from './fixture.array.0to999.ts';
export * from './fixture.generator.0to999.ts';
export * from './fixture.promises.0to999.ts';

export * from '@monochromatic-dev/module-es/fs.ts';
export * from './fs.emptyPath.ts';
export * from './fs.ensurePath.ts';

export * from './function.arguments.ts';
export * from './function.booleanfy.ts';
export * from './function.curry.ts';
export * from './function.ensuring.ts';
export * from './function.equals.ts';
export * from './function.is.ts';
export * from './function.memoize.ts';
export * from './function.nary.ts';
export * from './function.partial.ts';

// compose isn't provided. Always use pipe.
export * from './function.pipe.ts';

export * from './function.thunk.ts';
export * from './function.tryCatch.ts';

export * from './iterable.at.ts';
export * from './iterable.chunks.ts';
export * from './iterable.entries.ts';
export * from './iterable.every.ts';
export * from './iterable.everyFail.ts';
export * from './iterable.filter.ts';
export * from './iterable.is.ts';
export * from './iterable.map.ts';
export * from './iterable.none.ts';
export * from './iterable.noneFail.ts';
export * from './iterable.partition.ts';
export * from './iterable.reduce.ts';
export * from './iterable.trim.ts';
export * from './iterable.type.maybe.ts';
export * from './iterables.union.ts';

export * from '@monochromatic-dev/module-es/logtape.ts';
export * from './logtape.shared.ts';

export * from './numeric.add.ts';
export * from './numeric.is.ts';
export * from './numeric.type.abs.ts';
export * from './numeric.type.ints.ts';
export * from './numeric.type.intsTo10.ts';
export * from './numeric.type.nan.ts';
export * from './numeric.type.negative.ts';

export * from './promise.awaits.ts';
export * from './promise.is.ts';
export * from './promise.type.ts';
export * from './promise.wait.ts';
export * from './promises.some.ts';

// Maybe/Option type isn't provided because it's much easier to have functions just throw when they fail.
export * from './result.unwrap.ts';

export * from './string.capitalize.ts';
export * from './string.is.ts';
export * from './string.limitedGetComputedCss.ts';
export * from './string.singleQuoted.ts';
export * from './string.trim.ts';
export * from './string.type.ts';
export * from './strings.concat.ts';
export * from './strings.join.ts';

// export * from './deprecated.testing.ts';

export * from './dom.redirectingTo.ts';
