# Caching Strategy

**Priority**: Pending Research

## 1. Objectives
Implement efficient caching to reduce server load, improve performance, and provide resilience when external feeds are unavailable.

## 2. Recommended Solution: Caddy Proxy Caching

### 2.1 Why Caddy Proxy Over In-App Caching

| Aspect | Caddy Caching Proxy | In-Application Caching |
|--------|---------------------|------------------------|
| **Implementation Complexity** | ✅ Minimal - Just change fetch URL | ❌ High - Need cache library, storage, invalidation logic |
| **Code Changes Required** | ✅ 1-line change per fetch | ❌ Extensive refactoring, new dependencies |
| **Memory Usage** | ✅ Zero application memory | ❌ Stores cache in app memory/disk |
| **Performance** | ✅ Caddy optimized C code | ⚠️ JavaScript overhead |
| **Scalability** | ✅ Scales independently | ❌ Each app instance has separate cache |
| **Cache Sharing** | ✅ All instances share cache | ❌ Each instance maintains own cache |
| **ETags/Conditional Requests** | ✅ Built-in support | ❌ Manual implementation needed |
| **Stale-While-Revalidate** | ✅ Native Caddy feature | ❌ Complex to implement correctly |
| **Cache Persistence** | ✅ Survives app restarts | ❌ Lost on restart (unless persisted) |
| **Monitoring** | ✅ Caddy metrics/logs | ❌ Custom instrumentation needed |
| **Cache Invalidation** | ✅ Caddy handles automatically | ❌ Manual logic required |
| **Error Resilience** | ✅ Can serve stale on errors | ❌ Complex fallback logic needed |

**Verdict**: Caddy proxy caching aligns perfectly with infrastructure-first philosophy

## 3. Implementation Tasks

### 3.1 Caddy Configuration
- [ ] 3.1.1 Configure Caddy endpoint: `https://cache.aquati.cat/cache`
- [ ] 3.1.2 Set up cache storage location
- [ ] 3.1.3 Configure cache TTL (5 minutes default)
- [ ] 3.1.4 Enable stale-while-revalidate (1 hour)
- [ ] 3.1.5 Add cache status headers
- [ ] 3.1.6 Implement rate limiting (100 req/min per IP)

### 3.2 Security Configuration
- [ ] 3.2.1 Whitelist allowed feed domains
- [ ] 3.2.2 Set up CORS headers
- [ ] 3.2.3 Add robots.txt exclusion
- [ ] 3.2.4 Implement request validation
- [ ] 3.2.5 Handle unauthorized domains (403 response)

### 3.3 Application Integration
- [ ] 3.3.1 Update `feed.ts` to use cache proxy
- [ ] 3.3.2 Add URL encoding for feed URLs
- [ ] 3.3.3 Implement development/production switch
- [ ] 3.3.4 Add fallback to direct fetch (optional)
- [ ] 3.3.5 Test cache proxy integration

## 4. Example Caddyfile Configuration

```caddyfile
# RSS Feed Caching Proxy Configuration
cache.aquati.cat {
    # Enable caching module
    cache {
        # Cache storage location
        storage file_system {
            root /var/cache/caddy
        }

        # Default cache settings
        default_max_age 5m

        # Cache key includes query parameter
        key {
            query
        }

        # Stale-while-revalidate for resilience
        stale 1h

        # Cache successful responses
        status_header X-Cache-Status
    }

    # Caching proxy endpoint
    handle /cache {
        # Extract target URL from query parameter
        @has_target {
            query toCache=*
        }

        # Validate request has target URL
        handle @has_target {
            # Rate limiting per IP (100 requests per minute)
            rate_limit {
                zone dynamic 100r/m
            }

            # Security: Whitelist allowed domains
            @allowed_domain {
                query toCache=https://news.ycombinator.com/*
                query toCache=https://*.substack.com/*
                query toCache=https://feeds.feedburner.com/*
                query toCache=https://*.wordpress.com/feed*
                query toCache=https://*.blogger.com/feeds/*
                query toCache=https://*.medium.com/feed/*
                # Add more allowed patterns as needed
            }

            handle @allowed_domain {
                # Set CORS headers for browser access
                header {
                    Access-Control-Allow-Origin *
                    Access-Control-Allow-Methods "GET, OPTIONS"
                    X-Robots-Tag "noindex, nofollow"
                }

                # Proxy to the target URL
                reverse_proxy {
                    # Dynamic upstream from query parameter
                    to {query.toCache}

                    # Timeout settings
                    dial_timeout 10s
                    response_timeout 30s

                    # Pass through important headers
                    header_up User-Agent "RSS-Reader-Cache/1.0"
                    header_up Accept "application/rss+xml, application/atom+xml, application/xml, text/xml"

                    # Cache control
                    header_down Cache-Control "public, max-age=300, stale-while-revalidate=3600"

                    # Handle errors gracefully
                    handle_response 4xx 5xx {
                        # Serve stale content if available
                        cache {
                            match {
                                status 200
                            }
                            ttl 1h
                        }

                        # Otherwise return error
                        respond "Feed temporarily unavailable" 503
                    }
                }
            }

            # Reject non-whitelisted domains
            handle {
                respond "Domain not allowed" 403
            }
        }

        # Missing toCache parameter
        handle {
            respond "Missing toCache parameter" 400
        }
    }

    # Health check endpoint
    handle /health {
        respond "OK" 200
    }
}
```

## 5. Application Code Changes

Update `feed.ts`:

```typescript
// Before
const response = await fetch(feedUrl);

// After
const CACHE_PROXY = 'https://cache.aquati.cat/cache';
const proxiedUrl = `${CACHE_PROXY}?toCache=${encodeURIComponent(feedUrl)}`;
const response = await fetch(proxiedUrl);

// Optional: Fallback to direct fetch in development
const fetchUrl = process.env.NODE_ENV === 'production'
  ? `${CACHE_PROXY}?toCache=${encodeURIComponent(feedUrl)}`
  : feedUrl;
const response = await fetch(fetchUrl);
```

## 6. Potential Considerations

| Consideration | Impact | Mitigation |
|--------------|--------|------------|
| **Infrastructure Dependency** | App requires Caddy to be properly configured | Document Caddy config in deployment docs |
| **Additional Network Hop** | ~5-10ms latency on cache misses | Negligible compared to external fetch time |
| **URL Encoding Complexity** | Feed URLs must be properly encoded as query params | Simple encodeURIComponent() wrapper |
| **Local Development** | Developers need Caddy running locally | Can fallback to direct fetch in dev mode |
| **Security Concerns** | Open proxy could be abused if unrestricted | Whitelist allowed domains in Caddy |
| **Debugging Complexity** | Cache issues separate from app logs | Correlate via request IDs/timestamps |
| **Single Point of Failure** | If Caddy cache fails, all feeds fail | Caddy HA setup or fallback to direct fetch |
| **Cache Invalidation** | Can't force refresh specific feeds easily | Add cache-bust parameter when needed |

## 7. Alternative: Research In-App Caching Libraries

If Caddy proxy approach is not feasible:

- [ ] 7.1 Research `node-cache` for in-memory caching
- [ ] 7.2 Evaluate `cache-manager` for flexible cache backends
- [ ] 7.3 Consider `keyv` for unified caching interface
- [ ] 7.4 Investigate `Redis` for distributed caching
- [ ] 7.5 Analyze `lru-cache` for memory-efficient caching

## 8. Success Criteria
- 8.1 Feed fetching uses cache proxy in production
- 8.2 Cache reduces external requests by 80%+
- 8.3 Stale content served during outages
- 8.4 No memory overhead in application
- 8.5 Simple one-line code change
