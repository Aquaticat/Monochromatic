// Quick and dirty.
//
// This file is now ran manually with `yarn node --experimental-strip-types src/fixture.index.ts`
// In the future, this file would be built and ran only when changed automatically.
//
// Named *.index.ts instead of index.*.ts because it's not a module entry,
// but merely something to be ran **only** when changed.

// array0to999
console.log(JSON.stringify([...Array.from(Array(1000)).keys()]));

// promises0to999
console.log(JSON
  .stringify(
    [
      ...Array
        .from(Array(1000))
        .keys(),
    ]
      .map((element) =>
        `(async () => {await (new Promise((resolve) => setTimeout(resolve, ${element})));return ${element};})()`
      ),
  )
  .replaceAll('"', ''));
