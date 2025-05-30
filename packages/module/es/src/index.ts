// run vite build twice.

export * from '@monochromatic-dev/module-es/logtape.ts';

export * from '@monochromatic-dev/module-es/fs.ts';
export * from './fs.emptyPath.ts';
export * from './fs.ensurePath.ts';

export * from './fixture.array.0to999.ts';
export * from './fixture.generator.0to999.ts';
export * from './fixture.promises.0to999.ts';

export * from './any.constant.ts';
export * from './any.echo.ts';
export * from './any.identity.ts';
export * from './any.toExport.ts';
export * from './any.type.ts';
export * from './any.typeOf.ts';

export * from './arrayLike.every.ts';
export * from './arrayLike.everyFail.ts';
export * from './arrayLike.filter.ts';
export * from './arrayLike.is.ts';
export * from './arrayLike.map.ts';
export * from './arrayLike.none.ts';
export * from './arrayLike.noneFail.ts';
export * from './arrayLike.of.ts';
export * from './arrayLike.partition.ts';
export * from './arrayLike.reduce.ts';
export * from './arrayLike.type.ints.ts';
export * from './arrayLike.type.intsTo10.ts';
export * from './arrayLike.type.mapTo.ts';
export * from './arrayLike.type.maybe.ts';
export * from './arrayLike.type.tuple.ts';
export * from './arrayLike.type.withoutFirst.ts';
export * from './iterable.at.ts';
export * from './iterable.chunks.ts';
export * from './iterable.entries.ts';
export * from './iterable.trim.ts';
export * from './iterable.union.ts';

// TODO: Write joinArrayLike. The speced one uses ',' as the sep, which could be surprising.

export * from './boolean.equal.ts';
export * from './boolean.not.ts';

export * from './error.assert.equal.ts';
export * from './error.assert.throw.ts';
export * from './error.is.ts';
export * from './error.throw.ts';
export * from './error.throws.ts';

export * from './function.arguments.ts';
export * from './function.booleanfy.ts';
export * from './function.curry.ts';
export * from './function.ensuring.ts';
export * from './function.equals.ts';
export * from './function.is.ts';
export * from './function.memoize.ts';
export * from './function.nary.ts';
export * from './function.partial.ts';
export * from './function.pipe.ts';
export * from './function.thunk.ts';
export * from './function.tryCatch.ts';

export * from './numeric.add.ts';
export * from './numeric.is.ts';
export * from './numeric.type.abs.ts';
export * from './numeric.type.nan.ts';
export * from './numeric.type.negative.ts';

export * from './promise.awaits.ts';
export * from './promise.is.ts';
export * from './promise.some.ts';
export * from './promise.type.ts';
export * from './promise.wait.ts';

export * from './string.capitalize.ts';
export * from './string.concat.ts';
export * from './string.is.ts';
export * from './string.join.ts';
export * from './string.singleQuoted.ts';
export * from './string.trim.ts';
export * from './string.type.ts';

export * from './testing.ts';

export * from './logtape.shared.ts';

export * from './result.unwrap.ts';

export * from './other.limitedGetComputedCss.ts';
