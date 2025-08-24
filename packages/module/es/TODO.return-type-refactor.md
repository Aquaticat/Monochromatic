# Module ES - Return Type Based Refactor TODO

## Objective

Reorganize the entire [`packages/module/es/src`](src/) directory structure based exclusively on **return types** rather than the current mixed organizational patterns. This refactor will create a logical, consistent structure where functions are grouped by what they **produce** (return), not what they **operate on** (input parameters).

## Current Organizational Problems

### Mixed and Inconsistent Patterns
The current structure combines multiple organizational criteria inconsistently:

1. **Input-type organization**: [`src/type/typeof/string/`](src/type/typeof/string/) groups functions by input type
2. **Functionality organization**: [`src/type/custom/string/unnamed/is/`](src/type/custom/string/unnamed/is/) groups by operation type
3. **Platform organization**: [`src/fs/fs.node.ts`](src/fs/fs.node.ts) vs [`src/fs/fs.default.ts`](src/fs/fs.default.ts)
4. **Output organization**: [`src/type/typescript/unknown/to/`](src/type/typescript/unknown/to/) hints at return-type grouping

### Specific Structural Issues

**Functions returning `string` scattered across multiple locations**:
- [`src/type/typescript/unknown/to/exportString.ts`](src/type/typescript/unknown/to/exportString.ts) - returns `string`
- [`src/type/typeof/string/string.hash.ts`](src/type/typeof/string/string.hash.ts) - returns `Promise<string>`
- [`src/type/typeof/string/string.trim.ts`](src/type/typeof/string/string.trim.ts) - returns `string`
- [`src/type/typeof/string/strings.concat.ts`](src/type/typeof/string/strings.concat.ts) - returns `string`
- [`src/fs/fs.emptyPath.ts`](src/fs/fs.emptyPath.ts) - returns `Promise<string>`

**Functions returning `boolean` (type guards) mixed inconsistently**:
- [`src/type/typeof/string/string.is.ts`](src/type/typeof/string/string.is.ts) - returns `value is string`
- [`src/type/typescript/unknown/unnamed/is/string.ts`](src/type/typescript/unknown/unnamed/is/string.ts) - returns `value is string`
- [`src/type/custom/string/unnamed/is/withDoubleQuotesInside.ts`](src/type/custom/string/unnamed/is/withDoubleQuotesInside.ts) - presumably returns `boolean`

**Functions creating arrays using wrong directional naming**:
- [`src/type/typeof/object/array/array.range.ts`](src/type/typeof/object/array/array.range.ts) - returns `number[]` but should be in `array/from` not potential `array/to`

## Return-Type-Based Organization Principles

### Core Principle: Group by What Functions PRODUCE

**✅ Correct Pattern**: `{returnType}/from/{sourceType}/{specificFunction}`
- Functions that return arrays go in `array/from/...`
- Functions that return strings go in `string/from/...`
- Functions that return booleans go in `boolean/from/...`

**❌ Incorrect Pattern**: `{inputType}/to/{returnType}`
- Violates return-type-first principle
- Creates confusion about primary categorization

### Return Type Categories

#### Primary Return Types
1. **`string/from/`** - All functions returning `string` or `Promise<string>`
2. **`boolean/from/`** - All functions returning `boolean` (including type guards)
3. **`number/from/`** - All functions returning `number` or `bigint`
4. **`array/from/`** - All functions returning any array type
5. **`object/from/`** - All functions returning object types
6. **`promise/from/`** - All functions returning `Promise<T>` where T is complex
7. **`generator/from/`** - All functions returning `Generator<T>` or `AsyncGenerator<T>`
8. **`void/from/`** - All functions returning `void` (side effects)

#### Specialized Return Types
1. **`type/from/`** - Type-level utilities (no runtime return value)
2. **`union/from/`** - Functions returning union types
3. **`generic/from/`** - Functions with generic return types that can't be categorized

### Source Type Subcategorization

Within each return type, organize by **source/input type**:

```
{returnType}/from/{sourceType}/{platform?}/{specificity}/
```

**Examples**:
- `string/from/unknown/` - Functions that convert unknown values to strings
- `string/from/array/` - Functions that convert arrays to strings  
- `string/from/object/` - Functions that convert objects to strings
- `array/from/number/` - Functions that create arrays from numbers
- `boolean/from/string/` - Functions that validate strings (return boolean)

## Proposed New Structure

### String Return Type Functions
```
string/from/
├── index.ts                    # Re-export all string-producing functions
├── unknown/                    # unknown → string
│   ├── index.ts
│   ├── export.ts              # unknownToExportString()
│   └── typeOf.ts              # unknownToTypeOfString()
├── array/                     # array → string  
│   ├── index.ts
│   └── concat.ts              # concatStrings(), array joining
├── object/                    # object → string
│   ├── index.ts
│   └── hash.ts                # hashString() for objects
├── string/                    # string → string (transformations)
│   ├── index.ts
│   ├── capitalize.ts          # capitalizeString()
│   ├── trim.ts                # trimStartWith(), trimEndWith()
│   ├── hash.ts                # hashString()
│   └── transform/
│       ├── index.ts
│       └── singleQuoted.ts    # string transformations
├── iterable/                  # iterable → string
│   ├── index.ts
│   └── toString.ts            # toStringIterable()
├── path/                      # path operations → string
│   ├── index.ts
│   ├── join.ts                # pathJoin()
│   ├── trim.ts                # trimPathTrailingSlash(), trimPathLeadingSlash()
│   └── dirent.ts              # direntPath(), direntPathPosix()
├── css/                       # CSS → string
│   ├── index.ts
│   └── computed.ts            # limitedGetComputedCss()
├── random/                    # random generation → string
│   ├── index.ts
│   └── uuid.ts                # randomUUID()
└── async/                     # async sources → Promise<string>
    ├── index.ts
    ├── fs.ts                  # ensurePath(), ensureDir(), ensureFile(), emptyPath()
    └── hash.ts                # async hashString()
```

### Boolean Return Type Functions  
```
boolean/from/
├── index.ts                   # Re-export all boolean-producing functions
├── unknown/                   # unknown → boolean (type guards)
│   ├── index.ts
│   ├── string.ts              # isString()
│   ├── number.ts              # isNumber(), isBigint()
│   ├── array.ts               # isArray(), isEmptyArray()
│   ├── object.ts              # isObject(), isMap(), isSet()
│   ├── error.ts               # isError()
│   ├── promise.ts             # isPromise()
│   ├── generator.ts           # isGenerator(), isAsyncGenerator()
│   └── date.ts                # isObjectDate()
├── string/                    # string → boolean (validation)
│   ├── index.ts
│   ├── digits.ts              # isDigitString(), isDigitsString()
│   ├── numbers.ts             # isNumberString(), isFloatString()
│   ├── letters.ts             # isLangString(), letter validations  
│   └── patterns.ts            # pattern matching functions
├── number/                    # number → boolean (validation)
│   ├── index.ts
│   ├── int.ts                 # isPositiveInt(), isNegativeInt()
│   ├── float.ts               # isFloat(), isNegativeFloat()
│   ├── infinity.ts            # isPositiveInfinity(), isNegativeInfinity()
│   ├── nan.ts                 # isNaN()
│   └── range.ts               # numeric range validations
├── array/                     # array → boolean (validation)
│   ├── index.ts
│   ├── empty.ts               # isEmptyArray(), isArrayEmpty()
│   └── nonEmpty.ts            # isArrayNonEmpty(), arrayIsNonEmpty()
└── any/                       # any → boolean (universal comparisons)
    ├── index.ts
    ├── equal.ts               # equal(), equalAsync()
    ├── primitive.ts           # isPrimitive()
    └── cycle.ts               # hasCycle()
```

### Array Return Type Functions
```
array/from/
├── index.ts                   # Re-export all array-producing functions
├── number/                    # number → array
│   ├── index.ts
│   └── range.ts               # arrayRange() - creates number[]
├── generator/                 # generator → array
│   ├── index.ts
│   └── from.ts                # Array.from() wrappers
├── any/                       # any values → array
│   ├── index.ts
│   └── of.ts                  # arrayOf() - creates tuples
├── iterable/                  # iterable → array  
│   ├── index.ts
│   └── from.ts                # iterable conversion functions
└── async/                     # async sources → Promise<array>
    ├── index.ts
    └── fromAsync.ts           # async array creation
```

### Generator Return Type Functions
```
generator/from/
├── index.ts                   # Re-export all generator-producing functions
├── number/                    # number → generator
│   ├── index.ts
│   └── range.ts               # arrayRangeGen() - creates Generator<number>
├── any/                       # any → generator
│   ├── index.ts
│   ├── echo.ts                # echo() - infinite generator
│   └── of.ts                  # genOf() - creates generators
└── iterable/                  # iterable → generator
    ├── index.ts
    └── conversion.ts          # iterable to generator conversions
```

### Object Return Type Functions
```
object/from/
├── index.ts                   # Re-export all object-producing functions
├── array/                     # array → object
│   ├── index.ts
│   └── entries.ts             # array to object conversions
├── iterable/                  # iterable → object
│   ├── index.ts
│   └── reduce.ts              # iterable reduction to objects
├── record/                    # record operations → object
│   ├── index.ts
│   ├── extract.ts             # objectExtract()
│   ├── pick.ts                # objectPick()
│   └── merge.ts               # objectsMerge()
└── store/                     # store creation → object
    ├── index.ts
    ├── replicating.ts         # ReplicatingStore creation
    └── shared.ts              # store type utilities
```

### Function Return Type Functions
```
function/from/
├── index.ts                   # Re-export all function-producing functions
├── function/                  # function → function (transformations)
│   ├── index.ts
│   ├── curry.ts               # curry() - returns curried function
│   ├── partial.ts             # partial() - returns partial function
│   ├── memoize.ts             # memoize() - returns memoized function
│   ├── pipe.ts                # pipe() - returns composed function
│   ├── ignoreArgs.ts          # ignoreExtraArgs() - returns wrapper function
│   └── booleanfy.ts           # booleanfy() - returns boolean function
├── any/                       # any → function
│   ├── index.ts
│   ├── constant.ts            # constant() - returns constant function
│   ├── identity.ts            # identity() - returns identity function
│   └── always.ts              # alwaysTrue(), alwaysFalse()
└── conditional/               # conditional → function
    ├── index.ts
    ├── when.ts                # when() - returns conditional function
    └── ensuring.ts            # ensuring() - returns wrapped function
```

### Void Return Type Functions
```
void/from/
├── index.ts                   # Re-export all void functions (side effects)
├── dom/                       # DOM → void (side effects)
│   ├── index.ts
│   ├── setCss.ts              # onLoadSetCssFromUrlParams()
│   ├── redirect.ts            # onLoadRedirectingTo()
│   └── duplicate.ts           # DOM manipulation side effects
├── fs/                        # filesystem → void (side effects)
│   ├── index.ts
│   └── remove.ts              # removeEmptyFilesInDir() side effects
└── indexedDb/                 # database → void (side effects)
    ├── index.ts
    └── transaction.ts         # executeTransaction() side effects
```

### Type-Level Utilities (No Runtime Return)
```
type/from/
├── index.ts                   # Re-export all type utilities
├── array/                     # array type utilities
│   ├── index.ts
│   ├── fixedLength.ts         # ArrayFixedLength type
│   ├── tuple.ts               # Tuple type
│   ├── mapTo.ts               # array type mapping
│   └── withoutFirst.ts        # WithoutFirst type
├── string/                    # string type utilities  
│   ├── index.ts
│   ├── jsonc.ts               # JSONC branded types
│   ├── json.ts                # JSON branded types
│   └── branded.ts             # other branded string types
├── number/                    # numeric type utilities
│   ├── index.ts
│   ├── int.ts                 # Int, PositiveInt, NegativeInt
│   ├── bigint.ts              # IntBigint, Numeric
│   └── range.ts               # numeric type constraints
├── object/                    # object type utilities
│   ├── index.ts
│   ├── store.ts               # Store type definitions
│   ├── box.ts                 # Box type definitions
│   ├── mappable.ts            # Mappable type definitions
│   └── schema.ts              # Schema type definitions
└── promise/                   # promise type utilities
    ├── index.ts
    └── type.ts                # Promise type utilities
```

## Key Organizational Corrections

### Critical Pattern Fixes

**❌ Current Wrong Patterns**:
```
src/type/typeof/string/string.is.ts        # string input → boolean output (confusing)
src/type/custom/string/jsonc/named/basic.ts # input-focused naming
src/type/typescript/unknown/to/exportString.ts # inconsistent "to" usage
```

**✅ Correct Return-Type Patterns**:
```
src/boolean/from/string/is/basic.ts        # boolean ← string (type guards)
src/object/from/string/jsonc/parse.ts      # object ← string (JSONC parser)
src/string/from/unknown/export.ts          # string ← unknown (serialization)
```

### Specific Function Relocations

#### String-Producing Functions → `string/from/`
- [`unknownToExportString()`](src/type/typescript/unknown/to/exportString.ts:47) → `string/from/unknown/export.ts`
- [`hashString()`](src/type/typeof/string/string.hash.ts:15) → `string/from/string/hash.ts`
- [`trimStartWith()`, `trimEndWith()`](src/type/typeof/string/string.trim.ts:20) → `string/from/string/trim.ts`
- [`concatStrings()`](src/type/typeof/string/strings.concat.ts:79) → `string/from/array/concat.ts`
- [`capitalizeString()`](src/type/typeof/string/capitalize.ts:16) → `string/from/string/capitalize.ts`
- [`pathJoin()`](src/fs/fs.pathJoin.default.ts:30) → `string/from/array/pathJoin.ts`
- [`trimPathTrailingSlash()`](src/fs/fs.pathJoin.shared.ts:1) → `string/from/string/pathTrim.ts`
- [`direntPath()`](src/fs/dirent.path.ts:9) → `string/from/object/direntPath.ts`
- [`limitedGetComputedCss()`](src/type/typeof/string/string.limitedGetComputedCss.ts:533) → `string/from/string/cssComputed.ts`
- [`randomUUID()`](src/type/typeof/string/string.random.ts:1) → `string/from/random/uuid.ts`

#### Boolean-Producing Functions → `boolean/from/`
- [`isString()`](src/type/typeof/string/string.general.ts:39) → `boolean/from/unknown/isString.ts`
- [`isDigitString()`](src/type/typeof/string/string.digits.ts:93) → `boolean/from/string/isDigits.ts`
- [`isNumberString()`](src/type/typeof/string/string.numbers.ts:30) → `boolean/from/string/isNumber.ts`
- [`isEmptyArray()`](src/type/typeof/object/array/array.empty.ts:51) → `boolean/from/array/isEmpty.ts`
- [`isArrayNonEmpty()`](src/type/typeof/object/array/array.nonEmpty.ts:117) → `boolean/from/array/isNonEmpty.ts`
- [`isObject()`](src/type/typeof/object/record/object.is.ts:30) → `boolean/from/unknown/isObject.ts`
- [`isMap()`](src/type/typeof/object/map/map.is.ts:28) → `boolean/from/unknown/isMap.ts`
- [`isError()`](src/type/typeof/object/error/error.is.ts:32) → `boolean/from/unknown/isError.ts`
- [`equal()`](src/type/typescript/unknown/equal.ts:174) → `boolean/from/any/equal.ts`
- [`hasCycle()`](src/type/typescript/unknown/has/cycle.ts:56) → `boolean/from/unknown/hasCycle.ts`

#### Array-Producing Functions → `array/from/`
- [`arrayRange()`](src/type/typeof/object/array/array.range.ts:73) → `array/from/number/range.ts`
- [`arrayOf()`](src/type/typeof/object/array/array.of.ts:35) → `array/from/any/of.ts`
- All array creation functions → `array/from/{sourceType}/`

#### Object-Producing Functions → `object/from/`
- [`objectExtract()`](src/type/typeof/object/record/object.extract.ts) → `object/from/object/extract.ts`
- [`objectPick()`](src/type/typeof/object/record/object.pick.ts) → `object/from/object/pick.ts`
- [`objectsMerge()`](src/type/typeof/object/record/objects.merge.ts) → `object/from/array/merge.ts`
- JSONC parsing functions → `object/from/string/jsoncParse.ts`

#### Generator-Producing Functions → `generator/from/`
- [`arrayRangeGen()`](src/type/typeof/object/array/array.range.ts:130) → `generator/from/number/range.ts`
- [`echo()`](src/type/typescript/any/echo.ts:26) → `generator/from/any/echo.ts`
- [`genOf()`](src/type/typeof/object/array/array.of.ts:84) → `generator/from/any/of.ts`

#### Function-Producing Functions → `function/from/`
- [`constant()`](src/type/typescript/any/constant.ts:32) → `function/from/any/constant.ts`
- [`identity()`](src/type/typescript/any/identity.ts:25) → `function/from/any/identity.ts`
- [`curry()`](src/type/typeof/function/function.curry.ts) → `function/from/function/curry.ts`
- [`pipe()`](src/type/typeof/function/function.pipe.ts:1329) → `function/from/function/pipe.ts`
- [`memoize()`](src/type/typeof/function/function.memoize.ts:47) → `function/from/function/memoize.ts`
- [`when()`](src/type/typescript/any/when.ts:24) → `function/from/boolean/when.ts`

#### Void-Producing Functions → `void/from/`
- [`onLoadRedirectingTo()`](src/dom/dom.redirectingTo.ts:33) → `void/from/dom/redirect.ts`
- [`onLoadSetCssFromUrlParams()`](src/dom/set/css.fromParam.ts:30) → `void/from/dom/setCss.ts`
- [`executeTransaction()`](src/indexedDb/indexedDb.executeTransaction.ts:13) → `void/from/indexedDb/transaction.ts`
- DOM manipulation functions → `void/from/dom/`

#### Type-Level Utilities → `type/from/`
- [`ArrayFixedLength`](src/type/typeof/object/array/array.type.fixedLength.ts:1) → `type/from/array/fixedLength.ts`
- [`Tuple`](src/type/typeof/object/array/array.type.tuple.ts:17) → `type/from/array/tuple.ts`
- [`WithoutFirst`](src/type/typeof/object/array/array.type.withoutFirst.ts:16) → `type/from/array/withoutFirst.ts`
- [`Int`, `PositiveInt`](src/type/custom/numeric/numeric.int.ts:1) → `type/from/number/int.ts`
- JSONC branded types → `type/from/string/jsonc.ts`

## Platform-Specific Handling

### Platform Variants Within Return-Type Structure
Instead of separate platform files, use platform suffixes within return-type folders:

```
string/from/path/
├── index.ts                   # Re-exports with platform detection
├── join.default.ts            # Browser path joining
├── join.node.ts               # Node.js path joining
└── shared.ts                  # Cross-platform utilities
```

## Migration Strategy

### Phase 1: Create New Directory Structure
- [ ] Create all new return-type-based directories
- [ ] Create index files for each category and subcategory
- [ ] Set up proper TypeScript exports

### Phase 2: Move and Rename Functions Systematically
- [ ] **String producers**: Move all functions returning `string` to `string/from/`
- [ ] **Boolean producers**: Move all type guards and validators to `boolean/from/`  
- [ ] **Array producers**: Move all array creators to `array/from/`
- [ ] **Object producers**: Move all object creators to `object/from/`
- [ ] **Function producers**: Move all function creators to `function/from/`
- [ ] **Generator producers**: Move all generator creators to `generator/from/`
- [ ] **Void producers**: Move all side-effect functions to `void/from/`
- [ ] **Type utilities**: Move all type-level utilities to `type/from/`

### Phase 3: Update All Import Statements
- [ ] Update main [`index.ts`](src/index.ts:1) to import from new structure
- [ ] Update all internal cross-references between functions
- [ ] Update all test files to import from new locations
- [ ] Update package.json exports to match new structure

### Phase 4: Update Documentation and Examples
- [ ] Update all file paths in TODO documents
- [ ] Update examples in README and documentation
- [ ] Update any build system references to old paths

## Benefits of Return-Type Organization

### Logical Consistency
- **Predictable discovery**: Need a string? Look in `string/from/`
- **Clear intent**: Function purpose immediately obvious from location
- **Compositional clarity**: Easy to find functions that produce inputs for other functions

### Development Efficiency  
- **Faster navigation**: Find all string producers in one place
- **Reduced cognitive load**: No need to remember input-vs-output organization
- **Better autocompletion**: IDE can suggest functions by return type

### Maintainability
- **Consistent patterns**: All functions follow same organizational logic
- **Easier refactoring**: Related return types grouped together
- **Clear dependencies**: Function composition chains become obvious

## Examples of Correct vs Incorrect Organization

### ✅ Correct: Return-Type Based
```
string/from/unknown/export.ts       # unknown → string
string/from/array/concat.ts         # array → string  
string/from/string/hash.ts          # string → string
boolean/from/string/isDigit.ts      # string → boolean
array/from/number/range.ts          # number → array
```

### ❌ Incorrect: Input-Type Based (Current)
```
type/typeof/string/string.is.ts     # string input, boolean output (confusing)
type/custom/string/jsonc/           # string input, object output (misleading)
type/typescript/unknown/to/         # unknown input, various outputs (inconsistent)
```

### Function Categorization Examples

**String Return Functions**:
- `unknownToExportString(obj: unknown): string` → `string/from/unknown/export.ts`
- `hashString(value: string): Promise<string>` → `string/from/string/hash.ts` 
- `trimStartWith(str: string, trimmer: string): string` → `string/from/string/trim.ts`
- `pathJoin(...segments: string[]): string` → `string/from/array/pathJoin.ts`

**Boolean Return Functions (Type Guards)**:
- `isString(value: unknown): value is string` → `boolean/from/unknown/isString.ts`
- `isDigitString(value: unknown): value is string` → `boolean/from/string/isDigits.ts`
- `isEmptyArray(value: unknown): value is []` → `boolean/from/array/isEmpty.ts`

**Array Return Functions**:
- `arrayRange(length: number): number[]` → `array/from/number/range.ts`
- `arrayOf(...items): readonly T[]` → `array/from/any/of.ts`

## Success Criteria

- [ ] **Logical consistency**: All functions grouped by return type exclusively
- [ ] **Predictable navigation**: Developers can find functions by return type
- [ ] **No mixed patterns**: Zero input-type-based organization remains
- [ ] **Proper directionality**: All "from" patterns, no "to" patterns
- [ ] **Platform integration**: Platform variants within return-type structure
- [ ] **Maintained functionality**: All functions work identically after move
- [ ] **Updated documentation**: All references updated to new structure
- [ ] **Build system compatibility**: All tooling works with new structure

## Implementation Timeline

### Week 1: Structure Planning and Creation
- [ ] Finalize return-type taxonomy and folder structure
- [ ] Create all new directories and index files
- [ ] Design migration automation scripts

### Week 2: Core Function Migration  
- [ ] Migrate string-producing functions
- [ ] Migrate boolean-producing functions (type guards)
- [ ] Migrate array-producing functions

### Week 3: Advanced Function Migration
- [ ] Migrate object-producing functions  
- [ ] Migrate function-producing functions
- [ ] Migrate generator-producing functions
- [ ] Migrate void functions and type utilities

### Week 4: Integration and Validation
- [ ] Update all import statements and cross-references
- [ ] Update build system and tooling configuration
- [ ] Validate all tests pass with new structure
- [ ] Update documentation and examples

This refactor will transform the messy mixed-pattern structure into a clean, logical, return-type-based organization that scales effectively to 500+ functions while making function discovery intuitive and predictable.