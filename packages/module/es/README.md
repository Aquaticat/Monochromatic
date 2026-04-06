# @monochromatic-dev/module-es

A comprehensive functional programming utility library for TypeScript, designed to provide every thinkable utility function with excellent type safety, performance, and developer experience.

## Vision

This library aims to be the definitive TypeScript functional programming toolkit, providing:

- **Complete type safety** with advanced TypeScript generics and inference
- **Comprehensive utility coverage** across all data types and operations
- **Immutable-first design** with no mutational methods
- **Dual platform support** for both Node.js and browser environments
- **Performance optimization** for production applications
- **Zero runtime dependencies** for maximum portability

## Current State vs Complete Vision

### ✅ Well-Implemented Categories
- **Boolean utilities** - Equality, logical operations, type predicates
- **Error utilities** - Comprehensive error handling and assertion functions
- **Function utilities** - Composition, memoization, currying, and functional patterns
- **Numeric utilities** - Addition, type guards, range validation, BigInt support
- **String utilities** - Validation, transformation, hashing, and formatting
- **Basic array utilities** - Type guards, range generation, basic operations

### 🟡 Partially Implemented Categories
- **Iterable utilities** - Good sync support, missing many async variants
- **Array utilities** - Basic operations exist, missing advanced algorithms
- **Promise utilities** - Basic support, missing advanced async patterns
- **Type utilities** - Some type-level programming, needs expansion

### 🔴 Missing Categories (Critical Gaps)
- **Object utilities** - Pick, omit, merge, transform, deep operations
- **Date/time utilities** - Parsing, formatting, arithmetic, timezone handling
- **Math utilities** - Statistics, interpolation, geometric operations
- **Validation utilities** - Schema validation, input sanitization
- **Collection utilities** - Set operations, Map transformations
- **Stream utilities** - Async stream processing and transformation
- **Parser utilities** - Text parsing, tokenization, grammar handling
- **Crypto utilities** - Hashing, encoding, secure random generation
- **Network utilities** - URL manipulation, query string handling
- **Geometry utilities** - Point, vector, shape operations
- **Color utilities** - Color space conversion, manipulation
- **Tree/graph utilities** - Tree traversal, graph algorithms
- **Lens/optics utilities** - Functional data access and manipulation

## Design Principles

### Immutability First
Methods that mutate the original value passed in or called on aren't implemented.
All operations return new values, preserving the original data.

### No `this` Context
The usage of "this" isn't implemented where applicable.
All functions are pure and don't rely on execution context.

### TypeScript Excellence
- Advanced generic constraints for precise type inference
- Branded types for domain-specific safety
- Comprehensive type-level programming utilities
- Zero `any` types in public APIs

### Performance Conscious
- Optimized algorithms for common operations
- Memory-efficient implementations
- Lazy evaluation where beneficial
- Performance benchmarks for critical functions

## Library Organization

### Core Categories

#### Data Type Utilities
```typescript
// Any type utilities
import { identity, constant, echo, hasCycle } from '@monochromatic-dev/module-es';

// Array utilities
import { arrayRange, isEmptyArray, isArrayNonEmpty } from '@monochromatic-dev/module-es';

// Object utilities (planned)
import { pick, omit, merge, flatten } from '@monochromatic-dev/module-es';

// String utilities
import { isString, capitalizeString, hashString } from '@monochromatic-dev/module-es';
```

#### Functional Programming Patterns
```typescript
// Function composition
import { pipe, piped, pipeAsync, pipedAsync } from '@monochromatic-dev/module-es';

// Function transformation
import { curry, partial, memoize, booleanfy } from '@monochromatic-dev/module-es';

// Conditional execution
import { when, whenAsync } from '@monochromatic-dev/module-es';
```

#### Async Programming
```typescript
// Promise utilities
import { wait, nonPromiseAll } from '@monochromatic-dev/module-es';

// Async iteration (expanding)
import { mapIterableAsync, filterIterableAsync } from '@monochromatic-dev/module-es';

// Concurrency control
import { deConcurrency } from '@monochromatic-dev/module-es';
```

#### Type-Level Programming
```typescript
// Array type utilities
import type { Tuple, WithoutFirst, ArrayFixedLength } from '@monochromatic-dev/module-es';

// Numeric type utilities
import type { Int, PositiveInt, NegativeInt } from '@monochromatic-dev/module-es';

// Advanced type utilities (planned)
import type { DeepPick, DeepOmit, DeepMerge } from '@monochromatic-dev/module-es';
```

## Roadmap to Completeness

### Phase 1: Foundation (Immediate)
- **Critical export fixes** - Resolve TypeScript compilation errors
- **Object utilities implementation** - Core object manipulation functions
- **Async iterator completion** - Full async iterable ecosystem

### Phase 2: Core Expansion (Next Quarter)
- **Date/time utilities** - Comprehensive temporal operations
- **Math utilities** - Statistical and geometric functions
- **Validation framework** - Type-safe input validation

### Phase 3: Advanced Features (Future)
- **Stream processing** - Async stream utilities
- **Parser combinators** - Text parsing and grammar tools
- **Lens/optics system** - Functional data access patterns

### Phase 4: Specialized Domains (Long-term)
- **Geometry utilities** - Mathematical shape and vector operations
- **Color utilities** - Color space manipulation and conversion
- **Network utilities** - URL, HTTP, and networking helpers
- **Crypto utilities** - Cryptographic operations and secure random

## Current Implementation Status

| Category | Functions | Tests | Documentation | Completeness |
|----------|-----------|-------|---------------|--------------|
| **Any** | 8/10 | 60% | 70% | 🟡 Partial |
| **Array** | 12/50+ | 80% | 85% | 🟡 Basic |
| **Boolean** | 3/5 | 100% | 90% | 🟢 Good |
| **Error** | 25/30 | 90% | 85% | 🟢 Excellent |
| **Function** | 20/30 | 75% | 70% | 🟢 Good |
| **Iterable** | 25/60+ | 65% | 60% | 🟡 Partial |
| **Numeric** | 15/25 | 85% | 80% | 🟢 Good |
| **String** | 20/40+ | 85% | 75% | 🟢 Good |
| **Object** | 1/30+ | 0% | 0% | 🔴 Missing |
| **Date** | 0/25+ | 0% | 0% | 🔴 Missing |
| **Math** | 0/20+ | 0% | 0% | 🔴 Missing |
| **Collections** | 5/20+ | 40% | 50% | 🔴 Basic |

**Target**: 500+ utility functions across 20+ categories

## Philosophy: What's Not Included

### Mutational Methods
Methods that mutate the original value passed in or called on aren't implemented.

#### Array.prototype.copyWithin
Don't see a use case for this.
Plus, it's a mutational method.

Didn't implement.

### External Library Integration
We prefer focused external libraries for some complex domains:

#### deepmerge
Use [`jsr:@rebeccastevens/deepmerge`](https://github.com/RebeccaStevens/deepmerge-ts) instead.
*Note: We may implement basic merge utilities for simple cases.*

#### match
Use [`ts-pattern`](https://github.com/gvergnaud/ts-pattern) instead.
*Note: We're considering our own async-capable pattern matching library.*

#### jsonc
Use [`jsonc.min`](https://www.npmjs.com/package/jsonc.min/) instead.

#### Observable
For simple observable needs, use `any.observable.ts` (`createObservable`/`createObservableAsync`).
For a more complete observable implementation, use [`@therapy/observable`](https://jsr.io/@therapy/observable) - a lightweight, zero-dependency TypeScript observable library with a simple `.value` API.

## Contributing to Completeness

This library is designed to eventually contain every useful functional programming utility. Areas for contribution:

### High-Impact Missing Categories
1. **Object utilities** - Core data manipulation functions
2. **Date/time operations** - Temporal calculations and formatting
3. **Advanced async patterns** - Concurrency control and streaming
4. **Mathematical operations** - Statistics, geometry, algorithms

### Implementation Guidelines
- **Pure functions only** - no side effects or mutations
- **Type safety first** - leverage TypeScript's type system fully
- **Performance matters** - optimize for common use cases
- **Document comprehensively** - include examples and edge cases
- **Test thoroughly** - aim for 100% coverage with edge case testing

### Quality Standards
- All functions must have comprehensive TSDoc documentation
- Type inference should be excellent without explicit type annotations
- Performance characteristics should be documented for complex operations
- Browser and Node.js compatibility maintained where applicable
- Security considerations addressed for any user-input processing

## Related TODO Files

- [**Export Fixes**](TODO.exports-fixes.md) - Critical compilation errors (immediate priority)
- [**Missing Implementations**](TODO.missing-implementations.md) - Functions to implement for completeness
- [**Testing Coverage**](TODO.testing.md) - Test gaps and coverage improvements
- [**TSDoc Improvements**](TODO.tsdoc-improvements.md) - Documentation enhancement
- [**Function Improvements**](TODO.improvements.md) - Performance and API improvements
- [**Package TODO Index**](TODO.md) - Complete roadmap and priority overview

For the complete vision and implementation roadmap, see [**TODO.index.md**](TODO.md).
