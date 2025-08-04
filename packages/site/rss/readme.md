# RSS Reader

A RSS/Atom feed reader that converts feeds to HTML interface with real-time updates.

## Features

- **Multi-format Support**: Reads both RSS and Atom feeds
- **OPML Integration**: Configure feeds using OPML files
- **Real-time Updates**: Automatic feed refreshing with rate limiting
- **Clean Interface**: Minimalist HTML/CSS interface for reading feeds
- **Embedded Content**: Safe rendering of feed content in iframes
- **API Endpoints**: RESTful API for feed management and updates

## Architecture

The RSS reader follows a reactive architecture with observable data streams:

```
OPML Files → Outline Parser → Feed Fetcher → Item Processor → HTML Generator → Client
```

### Core Components

1. **OPML Parser** (`opmls.ts`, `outline.ts`) - Reads and parses OPML configuration files
2. **Feed Processor** (`feed.ts`) - Fetches and parses RSS/Atom feeds
3. **Item Handler** (`item.ts`) - Processes individual feed items and normalizes data
4. **HTML Generator** (`html.ts`) - Creates the web interface with Preact
5. **Asset Manager** (`asset.ts`) - Manages CSS/JS assets for the interface
6. **API Server** (`index.ts`) - Provides HTTP endpoints for feed management

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Comma-separated list of OPML file URLs
OPMLS=file://packages/site/rss/src/monitor.opml
PORT=4112
```

### OPML Format

The reader expects OPML files with the following structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Feed Collection</title>
  </head>
  <body>
    <outline text="Category Name">
      <outline text="Feed Name" type="rss" xmlUrl="https://example.com/feed.xml" htmlUrl="https://example.com/"/>
    </outline>
  </body>
</opml>
```

## API Endpoints

- `GET /` - Serve the RSS reader interface
- `GET /api/updateFeed/new` - Trigger manual feed update
- `GET /api/updateFeed/lastUpdated` - Get last update timestamp
- `GET /swagger` - API documentation

## Usage

1. Configure your OPML file with desired RSS/Atom feeds
2. Set the `OPMLS` environment variable to point to your OPML file(s)
3. Start the server: `pnpm start`
4. Visit `http://localhost:4112` to view your feeds

## Monitoring

The default configuration includes monitoring for Anthropic Status incidents:

```xml
<outline text="Anthropic Status - Incident History" type="rss" xmlUrl="https://status.anthropic.com/history.rss" htmlUrl="https://status.anthropic.com/"/>
```

## Technical Details

- Built with Elysia.js for the API server
- Uses Preact for HTML generation
- Implements rate limiting (100 seconds between updates)
- Supports both HTTP and file-based OPML sources
- Automatic asset reloading during development
- Comprehensive logging for debugging
