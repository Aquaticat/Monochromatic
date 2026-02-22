# Configuration Management

**Priority**: Low

## 1. Objectives
Externalize hardcoded values to make the application more flexible and configurable without code changes. Current defaults are reasonable, so this is optional.

## 2. Current Hardcoded Values

| Value | Current | Location | Purpose |
|-------|---------|----------|---------|
| `MIN_INTERVAL` | 100 seconds | `index.ts` | Rate limiting between feed updates |
| Display limit | 100 items | `html.ts` | Maximum items shown in UI |
| Poll interval | 1000ms | `client.ts` | Client-side asset check frequency |
| Fetch timeout | 30 seconds | Various | HTTP request timeout |
| File paths | Hardcoded | Various | JSONL, OPML locations |

## 3. Tasks

### 3.1 Create Configuration Module
- [ ] 3.1.1 Create `src/config.ts` with all configurable values
- [ ] 3.1.2 Support environment variables with defaults
- [ ] 3.1.3 Add type-safe configuration schema
- [ ] 3.1.4 Validate configuration on startup

### 3.2 Configuration Schema

```typescript
// src/config.ts
import { z } from 'zod';

const ConfigSchema = z.object({
  // Server configuration
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('localhost'),
  }),

  // Feed configuration
  feed: z.object({
    minInterval: z.number().default(100), // seconds
    fetchTimeout: z.number().default(30000), // milliseconds
    maxRetries: z.number().default(0), // no retries by design
    concurrencyLimit: z.number().default(1), // sequential by default
  }),

  // Display configuration
  display: z.object({
    maxItems: z.number().default(100),
    pollInterval: z.number().default(1000), // milliseconds
  }),

  // Storage configuration
  storage: z.object({
    ignorePath: z.string().default('./ignore.jsonl'),
    opmlPath: z.string().optional(), // from env
  }),

  // Cache configuration (if using Caddy proxy)
  cache: z.object({
    enabled: z.boolean().default(false),
    proxyUrl: z.string().optional(),
  }),

  // Environment
  environment: z.enum(['development', 'production', 'test'])
    .default('production'),
});

export const config = ConfigSchema.parse({
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    host: process.env.HOST || 'localhost',
  },
  feed: {
    minInterval: process.env.MIN_INTERVAL
      ? parseInt(process.env.MIN_INTERVAL)
      : 100,
    fetchTimeout: process.env.FETCH_TIMEOUT
      ? parseInt(process.env.FETCH_TIMEOUT)
      : 30000,
    maxRetries: 0, // Intentionally no retries
    concurrencyLimit: process.env.CONCURRENCY_LIMIT
      ? parseInt(process.env.CONCURRENCY_LIMIT)
      : 1,
  },
  display: {
    maxItems: process.env.MAX_ITEMS
      ? parseInt(process.env.MAX_ITEMS)
      : 100,
    pollInterval: process.env.POLL_INTERVAL
      ? parseInt(process.env.POLL_INTERVAL)
      : 1000,
  },
  storage: {
    ignorePath: process.env.IGNORE_PATH || './ignore.jsonl',
    opmlPath: process.env.OPMLS,
  },
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    proxyUrl: process.env.CACHE_PROXY_URL,
  },
  environment: process.env.NODE_ENV as any || 'production',
});
```

### 3.3 Environment Variables
- [ ] 3.3.1 Document all environment variables
- [ ] 3.3.2 Create `.env.example` file
- [ ] 3.3.3 Add validation for required variables
- [ ] 3.3.4 Support multiple environment files

### 3.4 Usage Migration
Replace hardcoded values throughout the codebase:

```typescript
// Before
const MIN_INTERVAL = 100;

// After
import { config } from './config';
const MIN_INTERVAL = config.feed.minInterval;
```

Files to update:
- [ ] 3.4.1 `index.ts` - Rate limiting interval
- [ ] 3.4.2 `html.ts` - Display limit
- [ ] 3.4.3 `client.ts` - Poll interval
- [ ] 3.4.4 `feed.ts` - Fetch timeout
- [ ] 3.4.5 `ignore.ts` - File paths
- [ ] 3.4.6 `opmls.ts` - OPML path

### 3.5 Configuration Documentation
- [ ] 3.5.1 Document all configuration options
- [ ] 3.5.2 Provide example configurations
- [ ] 3.5.3 Explain defaults and rationale
- [ ] 3.5.4 Add configuration troubleshooting

## 4. Benefits
- 4.1 **Flexibility**: Change behavior without code changes
- 4.2 **Environment-specific**: Different configs for dev/prod
- 4.3 **Type Safety**: Zod validation ensures correctness
- 4.4 **Documentation**: Clear list of all configurable options
- 4.5 **Testing**: Easy to override for tests

## 5. Considerations
- 5.1 Current defaults work well for most use cases
- 5.2 Adding configuration adds complexity
- 5.3 Need to balance flexibility with simplicity
- 5.4 Should maintain backwards compatibility

## 6. Success Criteria
- 6.1 All hardcoded values externalized
- 6.2 Configuration validated on startup
- 6.3 Environment variables documented
- 6.4 No breaking changes for existing deployments
- 6.5 Easy to override for testing
