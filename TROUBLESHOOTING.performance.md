# Performance Troubleshooting & Optimizations

Performance troubleshooting documentation has been organized into focused areas for better maintainability and navigation.

## Performance Troubleshooting Categories

### [Build Performance](TROUBLESHOOTING.performance.build.md)
Build system performance optimizations
- Moon Prepare Optimization (WSL performance improvements)
- TypeScript scripts replacing shell commands
- File system checks vs binary execution
- Cross-platform optimization strategies

### [Logging Performance](TROUBLESHOOTING.performance.logging.md)  
Runtime logging performance issues
- Function entry tracing migration (l.trace → l.debug)
- Stack trace generation overhead
- Performance impact benchmarks
- Migration strategies and alternatives

---

## Quick Reference

### Performance Optimization Key Takeaways

1. **WSL Environments**: Avoid executing binaries when file system checks suffice
2. **Logging**: Use `l.debug()` for function entry, reserve `l.trace()` only when stack traces are needed
3. **Build Scripts**: Replace shell commands with TypeScript scripts for better performance and cross-platform compatibility
4. **Caching**: Implement file-based checks before expensive operations
5. **Process Creation**: Minimize subprocess execution in performance-critical paths

### Common Performance Anti-Patterns

- Using `console.trace()` or `l.trace()` in tight loops or function entry points
- Executing binaries when file existence checks would suffice
- Running shell commands without proper caching mechanisms
- Mixing synchronous I/O operations with performance-critical code paths
- Ignoring WSL-specific performance characteristics