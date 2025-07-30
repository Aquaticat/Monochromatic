# RSS Feed Transformation Pipeline Optimization

## Current State Analysis

The current implementation in `src/index.ts` has a complex transformation pipeline with multiple intermediate steps and arrays. Each transformation creates a new array, leading to:
- Multiple iterations over the same data
- Excessive memory allocation for intermediate results
- Complex data flow that's hard to follow
- Limited type safety and validation
- No error handling for malformed feeds

## Optimization Goals

1. **Reduce complexity**: Combine multiple transformation steps
2. **Improve type safety**: Use Zod schemas for validation and transformation
3. **Better error handling**: Handle malformed feeds gracefully
4. **Performance**: Reduce memory allocations and iterations
5. **Maintainability**: Make the data flow easier to understand

## Detailed Implementation Plan

### Phase 1: Define Comprehensive Zod Schemas

#### 1.1 OPML Schema
```typescript
const OpmlOutlineSchema = z.object({
  text: z.string().optional(),
  title: z.string().optional(),
  type: z.string().optional(),
  xmlUrl: z.string().url().optional(),
  htmlUrl: z.string().url().optional(),
  outlines: z.array(z.lazy(() => OpmlOutlineSchema)).optional(),
});

const OpmlSchema = z.object({
  head: z.object({
    title: z.string().optional(),
    dateCreated: z.string().optional(),
    dateModified: z.string().optional(),
  }).optional(),
  body: z.object({
    outlines: z.array(OpmlOutlineSchema),
  }),
});
```

#### 1.2 RSS Feed Schema with Transformations
```typescript
const RssItemSchema = z.object({
  title: z.string().optional(),
  link: z.string().url().optional(),
  description: z.string().optional(),
  pubDate: z.string().optional()
    .transform(dateStr => dateStr ? new Date(dateStr) : new Date(0))
    .transform(date => ({
      date,
      localeDate: date.toLocaleDateString(),
      timestamp: date.getTime(),
    })),
  guid: z.string().optional(),
  author: z.string().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
});

const RssFeedSchema = z.object({
  title: z.string().optional(),
  link: z.string().url().optional(),
  description: z.string().optional(),
  language: z.string().optional(),
  lastBuildDate: z.string().optional(),
  items: z.array(RssItemSchema).default([]),
});
```

#### 1.3 Unified Feed Item Schema
```typescript
const UnifiedFeedItemSchema = z.object({
  item: RssItemSchema.shape,
  source: z.object({
    feedTitle: z.string(),
    feedUrl: z.string().url(),
    opmlTitle: z.string().optional(),
  }),
  dates: z.object({
    published: z.date(),
    publishedLocale: z.string(),
    timestamp: z.number(),
  }),
});
```

### Phase 2: Refactor the Pipeline

#### 2.1 Create a Unified Fetch and Parse Function
```typescript
async function fetchAndParseFeeds(opmlUrls: string[]): Promise<UnifiedFeedItem[]> {
  // Single pipeline that:
  // 1. Fetches OPMLs
  // 2. Parses and validates with Zod
  // 3. Extracts feed URLs
  // 4. Fetches RSS feeds in parallel
  // 5. Parses and transforms with Zod
  // 6. Returns unified, sorted items
}
```

#### 2.2 Use Functional Composition
```typescript
import { pipe, pipedAsync } from '@monochromatic-dev/module-es';

const processFeedsPipeline = pipeAsync(
  fetchOpmlContents,
  parseAndValidateOpmls,
  extractFeedUrls,
  fetchRssFeeds,
  transformToUnifiedItems,
  sortByDateDescending
);
```

#### 2.3 Implement Parallel Processing
```typescript
// Use Promise.allSettled for resilient parallel fetching
const feedResults = await Promise.allSettled(
  feedUrls.map(url => fetchAndParseFeed(url))
);

// Filter successful results and log errors
const successfulFeeds = feedResults
  .filter((result): result is PromiseFulfilledResult<ParsedFeed> => 
    result.status === 'fulfilled'
  )
  .map(result => result.value);
```

### Phase 3: Error Handling and Resilience

#### 3.1 Add Retry Logic
```typescript
const fetchWithRetry = async (url: string, maxRetries = 3): Promise<string> => {
  for (let attemptIndex = 0; attemptIndex < maxRetries; attemptIndex++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attemptIndex === maxRetries - 1) throw error;
      await wait(Math.pow(2, attemptIndex) * 1000); // Exponential backoff
    }
  }
  throw new Error('Unreachable');
};
```

#### 3.2 Implement Feed Validation
```typescript
const validateAndTransformFeed = (feedData: unknown, metadata: FeedMetadata) => {
  const result = RssFeedSchema.safeParse(feedData);
  
  if (!result.success) {
    l.warn`Failed to parse feed ${metadata.url}: ${result.error.message}`;
    return null;
  }
  
  return {
    ...result.data,
    metadata,
  };
};
```

### Phase 4: Performance Optimizations

#### 4.1 Stream Processing for Large Feeds
```typescript
async function* streamFeedItems(feedUrls: string[]): AsyncGenerator<UnifiedFeedItem> {
  for (const url of feedUrls) {
    const feed = await fetchAndParseFeed(url);
    for (const item of feed.items) {
      yield transformToUnifiedItem(item, feed);
    }
  }
}
```

#### 4.2 Implement Caching
```typescript
const feedCache = new Map<string, { data: ParsedFeed; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchFeedWithCache(url: string): Promise<ParsedFeed> {
  const cached = feedCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const feed = await fetchAndParseFeed(url);
  feedCache.set(url, { data: feed, timestamp: Date.now() });
  return feed;
}
```

### Phase 5: Testing and Migration

#### 5.1 Create Unit Tests
- Test Zod schemas with various feed formats
- Test error handling and retry logic
- Test sorting and transformation logic
- Performance benchmarks comparing old vs new implementation

#### 5.2 Migration Strategy
1. Create new implementation alongside existing code
2. Add feature flag to switch between implementations
3. Run both in parallel and compare results
4. Gradually migrate to new implementation
5. Remove old code after verification

## Expected Benefits

1. **Code Reduction**: Estimated 40-50% fewer lines of code
2. **Performance**: Single pass through data instead of 7+ passes
3. **Type Safety**: Full type inference from Zod schemas
4. **Error Resilience**: Graceful handling of malformed feeds
5. **Maintainability**: Clear, linear data flow
6. **Memory Usage**: Reduced intermediate array allocations

## Implementation Checklist

- [ ] Create Zod schemas for all data structures
- [ ] Implement unified fetch and parse function
- [ ] Add error handling and retry logic
- [ ] Implement caching mechanism
- [ ] Create comprehensive unit tests
- [ ] Benchmark performance improvements
- [ ] Add feature flag for gradual migration
- [ ] Update documentation
- [ ] Remove old implementation after verification

## Future Enhancements

1. **Incremental Updates**: Only fetch feeds that have changed
2. **WebSocket Support**: Real-time feed updates
3. **Database Storage**: Persist feed items for historical data
4. **Feed Analytics**: Track feed reliability and update frequency
5. **Content Deduplication**: Identify and merge duplicate articles