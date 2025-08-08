# Third-Party Library Usage

## Working with Third-Party Libraries

### Immediate Documentation Retrieval
- **IMMEDIATELY retrieve documentation when encountering undefined method errors**
  - The moment you see errors like "X is not a function", "Cannot read property X of undefined", or "X is undefined"
  - Use ALL available documentation tools to understand the correct API:
    - `context7` for library documentation
    - `exa:crawling` to fetch from `https://www.npmjs.com/package/<package-name>`
    - `github:search_code` or `github:get_file_contents` to find usage examples
    - `WebSearch` for recent documentation and examples
  - NEVER guess or assume API methods exist - always verify first

### Documentation Best Practices
- **Always retrieve documentation from GitHub or npm pages** when implementing features with third-party libraries
  - For npm packages: Use `exa:crawling` to fetch from `https://www.npmjs.com/package/<package-name>`
  - For GitHub repos: Use `github:get_file_contents` to fetch from the library's GitHub page
  - This ensures you have the most up-to-date API documentation and usage examples
- Always check the actual type definitions before using APIs
- Read the actual source types, not just documentation (which may be outdated)
- When encountering type errors, read the error message carefully - it often shows what's actually expected

## CLI Tool Documentation Analysis

When working with CLI tools and their documentation:
- **Pay attention to command patterns in examples** - tools often have their own execution conventions
  - Look for patterns across multiple examples, not just individual commands
  - Notice what's consistent vs what varies (e.g., `uv run example.py` vs `uv run --with dep example.py`)
- **Don't assume traditional execution patterns** - modern tools often wrap execution
  - `uv run script.py` NOT `uv run python script.py`
  - `npx script.js` NOT `npx node script.js`
  - Many tools handle interpreter invocation automatically
- **When you see multiple examples of the same pattern, trust it** - documentation examples are usually correct
- **Test assumptions with the simplest case first** - try the minimal command before adding complexity
- **Read error messages carefully** - they often reveal the correct usage pattern

## Working with Third-Party Repositories

When setting up or integrating third-party tools:
- **Never modify files in cloned third-party repositories**
  - This breaks git pull/update workflows
  - Makes it difficult to track upstream changes
  - Creates merge conflicts when updating
- **Always prefer configuration-based solutions**
  - Use external config files (e.g., ~/.kilocode.json for MCP servers)
  - Use command-line arguments and environment variables
  - Create wrapper scripts in a separate location if needed
- **If modifications seem necessary, find alternatives**
  - Look for official configuration mechanisms
  - Use the tool's intended extension points
  - Create a fork only if you need permanent modifications
- **Keep third-party repos pristine**
  - Allows easy updates with `git pull`
  - Prevents accidental commits to upstream
  - Maintains clear separation between your code and dependencies

## Functional Programming Utilities

When composing functions:
- Use `piped` for synchronous function composition: `piped(input, fn1, fn2, fn3)`
- Use `pipedAsync` for async function composition: `await pipedAsync(input, fn1, asyncFn2, fn3)`
- Use `pipe` to create a reusable sync function pipeline: `const pipeline = pipe(fn1, fn2, fn3); pipeline(input)`
- Use `pipeAsync` to create a reusable async function pipeline: `const pipeline = pipeAsync(fn1, asyncFn2, fn3); await pipeline(input)`
- Functions generally don't require `.bind()` for `this` context unless specifically documented
  - Example: `pipedAsync(data, transform, index.addDocuments)` works fine without `.bind(index)`
  - Instance methods already have their context when referenced as `instance.method`