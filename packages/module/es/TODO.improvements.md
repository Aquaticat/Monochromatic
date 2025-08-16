# Module ES - Function Improvements Todo

## Existing Functions Needing Improvement

### Performance Optimization Needed

#### High Priority - Performance Impact

- [ ] **[`boolean.equal.ts`](src/boolean.equal.ts:174)** - [`equal()`](src/boolean.equal.ts:174) function
  - Performance issue with deep object comparison
  - Consider memoization for expensive comparisons
  - Add early exit optimizations for common cases
  - Profile performance with large nested structures

- [ ] **[`any.toExport.ts`](src/any.toExport.ts:45)** - [`toExport()`](src/any.toExport.ts:45) function
  - String concatenation performance could be improved
  - Consider using array-join pattern for large objects
  - Add streaming output for very large structures

- [ ] **[`string.limitedGetComputedCss.ts`](src/string.limitedGetComputedCss.ts:533)** - CSS parsing functions
  - Multiple passes over tokens could be optimized
  - Consider single-pass parsing where possible
  - Profile tokenization performance with large CSS values

#### Medium Priority - Memory Optimization

- [ ] **[`any.hasCycle.ts`](src/any.hasCycle.ts:56)** - [`hasCycle()`](src/any.hasCycle.ts:56)
  - WeakSet usage for visited tracking could be optimized
  - Consider memory-efficient cycle detection for very large objects
  - Add memory usage profiling

- [ ] **[`function.memoize.ts`](src/function.memoize.ts:47)** - Memoization functions
  - No cache size limits could cause memory leaks
  - Consider LRU cache implementation
  - Add cache eviction strategies

### Error Handling Improvements

#### High Priority - Better Error Messages

- [ ] **[`error.throw.ts`](src/error.throw.ts:34)** - All `not*OrThrow()` functions
  - Error messages could be more descriptive
  - Add context about what was expected vs received
  - Include suggestions for common mistakes

- [ ] **[`array.range.ts`](src/array.range.ts:73)** - [`arrayRange()`](src/array.range.ts:73)
  - RangeError for negative length needs better message
  - Add suggestion for valid range values
  - Include examples in error message

- [ ] **[`numeric.type.int.ts`](src/numeric.type.int.ts:312)** - Type validation functions
  - Generic "not an integer" messages need improvement
  - Add specific guidance for common non-integer types
  - Include formatting suggestions

#### Medium Priority - Error Recovery

- [ ] **[`fs.emptyPath.ts`](src/fs.emptyPath.ts:20)** - File system functions
  - Add graceful error handling for permission issues
  - Provide fallback strategies for locked files
  - Include recovery suggestions in error messages

### Type Safety Improvements

#### High Priority - Type Narrowing

- [ ] **[`array.is.ts`](src/array.is.ts:117)** - [`isArrayNonEmpty()`](src/array.is.ts:117)
  - Type narrowing could be more precise
  - Consider branded types for better type safety
  - Add const assertion support

- [ ] **[`iterable.is.ts`](src/iterable.is.ts:31)** - Type guard functions
  - Missing comprehensive type guard implementations
  - Need more specific type predicates
  - Add support for const assertions

#### Medium Priority - Generic Constraints

- [ ] **Function composition utilities** - [`function.pipe.ts`](src/function.pipe.ts:280)
  - Generic constraints could be more precise
  - Consider stricter type checking for pipelines
  - Add support for branded types in pipelines

### API Design Improvements

#### High Priority - Consistency

- [ ] **Function naming inconsistencies** across modules:
  - `isArrayEmpty()` vs `isEmptyArray()` - choose consistent pattern
  - `someIterable()` vs `iterableSome()` - standardize naming convention
  - Review all function names for consistency

- [ ] **Parameter order inconsistencies**:
  - Some functions have predicate first, others have iterable first
  - Standardize parameter order across similar functions
  - Consider curried versions for consistent partial application

#### Medium Priority - API Completeness

- [ ] **Missing overloads** for common use cases:
  - Array functions could have rest parameter overloads
  - Async functions missing Promise.all variants
  - Type guard functions missing union type support

### Code Organization Improvements

#### High Priority - Module Structure

- [ ] **Large files need splitting**:
  - [`function.pipe.ts`](src/function.pipe.ts:19) - 1500+ lines, consider splitting by arity
  - [`boolean.equal.ts`](src/boolean.equal.ts:174) - Complex comparison logic could be modularized
  - [`string.limitedGetComputedCss.ts`](src/string.limitedGetComputedCss.ts:533) - CSS parsing could be separate module

- [ ] **Related functions in separate files**:
  - Array utilities scattered across multiple files
  - String utilities spread across many modules
  - Consider consolidating related functionality

#### Medium Priority - Code Reuse

- [ ] **Duplicate logic elimination**:
  - Similar type guard patterns repeated across modules
  - Common error handling patterns could be abstracted
  - Shared validation logic could be extracted

### Algorithm Improvements

#### High Priority - Algorithm Efficiency

- [ ] **[`iterables.intersection.ts`](src/iterables.intersection.ts:118)** - Intersection algorithm
  - O(n*m) complexity could be optimized with Set-based approach
  - Consider early termination for empty inputs
  - Profile performance with large datasets

- [ ] **[`any.hasCycle.ts`](src/any.hasCycle.ts:56)** - Cycle detection
  - DFS implementation could use iterative approach for very deep objects
  - Consider memory-efficient alternatives for large object graphs

#### Medium Priority - Mathematical Precision

- [ ] **[`numeric.add.ts`](src/numeric.add.ts:34)** - Numeric addition functions
  - Floating-point precision considerations
  - BigInt overflow handling
  - Consider decimal.js integration for precise arithmetic

### Security Improvements

#### High Priority - Input Validation

- [ ] **[`any.toExport.ts`](src/any.toExport.ts:45)** - Code generation security
  - Add input sanitization for unsafe values
  - Validate against code injection patterns
  - Consider output escaping for eval safety

- [ ] **[`dom.setCssFromParam.ts`](src/dom.setCssFromParam.ts:30)** - CSS injection
  - Add CSS value validation and sanitization
  - Prevent CSS injection attacks
  - Validate allowed properties more strictly

#### Medium Priority - Data Validation

- [ ] **File system functions** - Path validation
  - Add path traversal protection
  - Validate file paths against allowlists
  - Sanitize user-provided paths

### Browser Compatibility Improvements

#### High Priority - Modern Web Standards

- [ ] **[`dom.prompt.ts`](src/dom.prompt.ts:22)** - Dialog implementation
  - Consider using modern `<dialog>` element consistently
  - Add accessibility improvements (ARIA labels, focus management)
  - Enhance keyboard navigation support

- [ ] **[`string.hash.ts`](src/string.hash.ts:15)** - Crypto API usage
  - Add fallback for environments without crypto.subtle
  - Consider polyfill for older browsers
  - Document browser support requirements

#### Medium Priority - Progressive Enhancement

- [ ] **Feature detection** for all browser-specific functions
- [ ] **Graceful degradation** when APIs not available
- [ ] **Polyfill integration** for missing features

## Success Criteria

- [ ] All performance bottlenecks identified and optimized
- [ ] Error messages provide clear guidance and context
- [ ] Type safety improved with better constraints and narrowing
- [ ] API consistency achieved across all modules
- [ ] Code organization optimized for maintainability
- [ ] Algorithms use optimal complexity where possible
- [ ] Security considerations addressed for all user-facing functions
- [ ] Browser compatibility maximized with appropriate fallbacks

## Implementation Priority

### Phase 1: Critical Performance (Week 1)
1. **Boolean equality optimization** - Major performance impact
2. **Function naming consistency** - Breaking changes need early implementation
3. **Security fixes** - Input validation and sanitization

### Phase 2: Error Handling (Week 2)
1. **Better error messages** across all throwing functions
2. **Error recovery strategies** for file system operations
3. **Type safety improvements** with better constraints

### Phase 3: API Design (Week 3)
1. **Consistent parameter ordering** across similar functions
2. **Missing overloads** for common use cases
3. **Module organization** and file splitting

### Phase 4: Polish (Week 4)
1. **Algorithm optimizations** for intersection and cycle detection
2. **Browser compatibility** improvements and fallbacks
3. **Code organization** cleanup and consolidation

## Cross-References

- [**Performance Todo**](../../TODO.performance.md#javascript-performance) - Performance optimization strategies
- [**Security Todo**](../../TODO.security.md#secure-coding-practices) - Security considerations for improvements
- [**Code Quality Todo**](../../TODO.code-quality.md#typescript-standards-and-patterns) - Code quality standards