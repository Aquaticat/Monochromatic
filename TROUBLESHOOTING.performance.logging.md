# Logging Performance Troubleshooting

## Runtime logging performance issues

### Logging Performance Migration - 2025-01-01

#### Problem
Function entry tracing using `l.trace()` at the start of every function causing significant performance overhead, especially in function-heavy code paths.

#### Root Causes
1. `l.trace()` captures full stack traces using `Error.captureStackTrace()` or similar mechanisms
2. Stack trace generation requires V8 engine to collect call frame information
3. String serialization and formatting of stack traces adds overhead
4. I/O operations to output logs are synchronous and blocking
5. In tight loops or high-frequency function calls, this compounds to severe performance degradation

#### Performance Impact
Based on recent benchmarks:
- **console.trace()**: Up to 2000% slower than no logging
- **console.log/debug**: Similar baseline I/O overhead without stack trace generation
- **Stack trace overhead**: Significant additional cost beyond basic logging

#### Migration Strategy

##### 1. Replace function entry tracing:
```typescript
// Before - with stack trace overhead
function myFunction() {
  l.trace('myFunction started');  // Captures full call stack
  // ... function logic
}

// After - basic debug logging
function myFunction() {
  l.debug('myFunction started');  // Simple message only
  // ... function logic
}
```

##### 2. Performance benefits:
- Eliminates stack trace capture overhead
- Maintains function entry visibility for debugging
- Preserves log level control (debug can be disabled in production)
- Reduces I/O serialization overhead

##### 3. Implementation steps:
- [ ] Search and replace `l.trace(` → `l.debug(` across codebase
- [ ] Verify no functionality depends on stack trace information
- [ ] Profile performance improvement in function-heavy modules
- [ ] Update logging configuration to control debug output

#### Alternative Approaches
1. **Conditional logging**: Use environment-based guards for development-only tracing
2. **Structured logging**: Replace with performance-focused logging libraries
3. **Debug-only traces**: Keep `l.trace()` only for complex debugging scenarios, not routine function entry

#### Key Takeaway
Use `l.debug()` for function entry logging to avoid stack trace generation overhead while maintaining debugging visibility. Reserve `l.trace()` for cases where call stack information is actually needed.