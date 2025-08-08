# Performance Optimizations

**Priority**: Pending Research

## 1. Objectives
Analyze current bottlenecks and implement optimizations to improve feed fetching speed, reduce memory usage, and enhance overall application performance.

## 2. Research Tasks

### 2.1 Performance Profiling
- [ ] 2.1.1 Profile current performance with Chrome DevTools
- [ ] 2.1.2 Identify CPU bottlenecks using Node.js profiler
- [ ] 2.1.3 Analyze memory usage patterns
- [ ] 2.1.4 Measure feed fetch times
- [ ] 2.1.5 Track Observable subscription overhead
- [ ] 2.1.6 Monitor file I/O performance

### 2.2 Bottleneck Analysis
- [ ] 2.2.1 Measure sequential feed fetching impact
- [ ] 2.2.2 Analyze OPML parsing performance
- [ ] 2.2.3 Check JSONL read/write efficiency
- [ ] 2.2.4 Profile HTML generation speed
- [ ] 2.2.5 Evaluate asset hash computation cost
- [ ] 2.2.6 Test client-side polling overhead

## 3. Optimization Tasks

### 3.1 Parallel Feed Fetching
Current implementation fetches feeds sequentially. Implement concurrent fetching:

```typescript
// Current: Sequential
for (const feed of feeds) {
  await fetchFeed(feed);
}

// Optimized: Parallel with concurrency limit
import pLimit from 'p-limit';
const limit = pLimit(5); // Max 5 concurrent fetches

const feedPromises = feeds.map(feed =>
  limit(() => fetchFeed(feed))
);
await Promise.all(feedPromises);
```

Tasks:
- [ ] 3.1.1 Implement concurrent feed fetching
- [ ] 3.1.2 Add configurable concurrency limit (default: 5)
- [ ] 3.1.3 Handle rate limiting per domain
- [ ] 3.1.4 Implement exponential backoff for failures
- [ ] 3.1.5 Add progress tracking for UI feedback

### 3.2 Observable Optimization
- [ ] 3.2.1 Audit Observable subscriptions for memory leaks
- [ ] 3.2.2 Implement proper unsubscribe logic
- [ ] 3.2.3 Use `shareReplay()` to avoid duplicate work
- [ ] 3.2.4 Optimize observable chains
- [ ] 3.2.5 Add debouncing where appropriate
- [ ] 3.2.6 Profile memory usage before/after

### 3.3 Database vs JSONL
Evaluate replacing JSONL with a proper database:

| Aspect | JSONL (Current) | SQLite | PostgreSQL |
|--------|-----------------|---------|------------|
| **Setup Complexity** | ✅ None | ✅ Minimal | ⚠️ Requires server |
| **Performance** | ❌ Full file read/write | ✅ Indexed queries | ✅ Best performance |
| **Concurrency** | ❌ File locks | ✅ MVCC | ✅ Full ACID |
| **Memory Usage** | ❌ Loads entire file | ✅ Efficient | ✅ Most efficient |
| **Querying** | ❌ Manual filtering | ✅ SQL | ✅ Full SQL |
| **Scalability** | ❌ Limited | ✅ Good | ✅ Excellent |
| **Maintenance** | ✅ Simple files | ✅ Single file | ⚠️ Server management |

Tasks:
- [ ] 3.3.1 Benchmark JSONL performance with large datasets
- [ ] 3.3.2 Test SQLite as alternative
- [ ] 3.3.3 Evaluate PostgreSQL if needed
- [ ] 3.3.4 Measure query performance differences
- [ ] 3.3.5 Compare memory usage
- [ ] 3.3.6 Make recommendation

### 3.4 Feed Parsing Optimization
- [ ] 3.4.1 Cache parsed OPML structure
- [ ] 3.4.2 Implement incremental OPML updates
- [ ] 3.4.3 Optimize date parsing logic
- [ ] 3.4.4 Use streaming XML parser for large feeds
- [ ] 3.4.5 Implement feed validation caching
- [ ] 3.4.6 Add feed size limits

### 3.5 HTML Generation Optimization
- [ ] 3.5.1 Implement virtual scrolling for large lists
- [ ] 3.5.2 Add pagination instead of 100-item limit
- [ ] 3.5.3 Cache rendered HTML fragments
- [ ] 3.5.4 Use incremental DOM updates
- [ ] 3.5.5 Optimize Preact rendering
- [ ] 3.5.6 Minimize re-renders

### 3.6 Asset Optimization
- [ ] 3.6.1 Implement more efficient file watching
- [ ] 3.6.2 Cache hash computations
- [ ] 3.6.3 Use incremental hashing
- [ ] 3.6.4 Optimize happy-dom usage
- [ ] 3.6.5 Reduce polling frequency
- [ ] 3.6.6 Implement WebSocket for real-time updates

### 3.7 Memory Optimization
- [ ] 3.7.1 Implement stream processing for large feeds
- [ ] 3.7.2 Add memory usage monitoring
- [ ] 3.7.3 Set up garbage collection optimization
- [ ] 3.7.4 Limit in-memory cache sizes
- [ ] 3.7.5 Implement LRU cache eviction
- [ ] 3.7.6 Profile and fix memory leaks

## 4. Performance Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Feed fetch time (10 feeds) | ~10s | <2s | 5x |
| Memory usage (idle) | Unknown | <100MB | - |
| Memory usage (active) | Unknown | <200MB | - |
| HTML generation | Unknown | <50ms | - |
| Client reload time | 1s poll | Instant | WebSocket |
| OPML parse time | Unknown | <10ms | - |
| Startup time | Unknown | <1s | - |

## 5. Implementation Priority

### 5.1 Quick Wins (1 day)
- [ ] 5.1.1 Add concurrency to feed fetching
- [ ] 5.1.2 Optimize Observable chains
- [ ] 5.1.3 Cache OPML parsing

### 5.2 Medium Impact (3-5 days)
- [ ] 5.2.1 Replace JSONL with SQLite
- [ ] 5.2.2 Implement virtual scrolling
- [ ] 5.2.3 Add WebSocket updates

### 5.3 Long Term (1-2 weeks)
- [ ] 5.3.1 Full streaming implementation
- [ ] 5.3.2 Advanced caching strategies
- [ ] 5.3.3 Complete memory optimization

## 6. Monitoring Implementation

- [ ] 6.1 Add performance metrics collection
- [ ] 6.2 Implement APM integration
- [ ] 6.3 Create performance dashboard
- [ ] 6.4 Set up alerting for degradation
- [ ] 6.5 Add performance regression tests

## 7. Success Criteria
- 7.1 Feed updates complete in <2 seconds for 10 feeds
- 7.2 Memory usage stays under 200MB
- 7.3 No memory leaks detected
- 7.4 UI remains responsive during updates
- 7.5 Client updates are instantaneous
