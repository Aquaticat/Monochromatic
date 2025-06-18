## Add util for sum of all numbers in string

## Generate entire package.json automatically

## Astro ESLint Configuration Challenges

### Problem
When using TypeScript ESLint with `projectService`, it relies on tsconfig.json to determine which files to process. Virtual files created by our custom Astro processor (like `index.astro/frontmatter.ts`) aren't recognized because they don't exist on disk.

### Potential Solutions

1. **Multiple config blocks with allowDefaultProject** (unclean but works)
   - Use `allowDefaultProject: ['**/*.astro/*.ts']` in parserOptions
   - Specify `defaultProject` for each Astro project
   - Requires separate ESLint config blocks for each project

2. **Dynamic config discovery** (runtime performance cost)
   - Discover all Astro projects at config load time
   - Generate config blocks dynamically
   - Has acceptable performance overhead

3. **Modify config dynamically in processor** (current approach)
   - ESLint processors may not have API to modify config
   - ESLint plugins do have this capability
   - Need to explore if we can create a plugin that works with our processor

### Current Approach
Tried option 3 - ESLint processors cannot dynamically modify parser configuration. The ESLint API doesn't expose methods for processors to change parser options at runtime.

### Implemented Solution
After trying multiple approaches:
1. **Processor approach**: Limited by ESLint architecture - processors can't modify parser configuration
2. **Language API**: The `applyInlineConfig()` is for inline ESLint comments, not parser configuration
3. **Current solution - Custom Parser**: Following the pattern used by vue-eslint-parser

Created a custom Astro parser that:
- Extracts only frontmatter and script content from Astro files
- Passes the combined TypeScript content to @typescript-eslint/parser
- Maintains proper line number mapping
- Works with TypeScript's projectService for full type checking

Benefits:
- Full type-aware linting for Astro files
- No need for complex allowDefaultProject configurations
- Works with any project structure
- Follows ESLint's recommended approach for custom file types

## temp

 Did some searches and found promisify can't work with spawn. New plan:
  1. Use nano-spawn in moon.command.ts You may use Context7 to retrieve its docs.
  2. (Nope)~~setup vite to auto build moon.*.ts and output moon.*.js to dist/final/ You would probably need to heavily
  modify the createBaseLibConfig function in config/vite/src/index.ts to make it first glob (use npm `glob`
  package) and find out all the moon.*.ts files in ${configDir}/src/ and modify the build>lib> to include those.~~
      Use `bun build packages/module/es/src/moon.<name>.ts --compile --target=<target> packages/module/es/dist/final/moon.<name>.<target>`.
      Run it across these targets:
      ```txt
      --target	Operating System	Architecture	Modern	Baseline	Libc
        bun-linux-x64	Linux	x64	✅	✅	glibc
        bun-linux-arm64	Linux	arm64	✅	N/A	glibc
        bun-windows-x64	Windows	x64	✅	✅	-
        bun-darwin-x64	macOS	x64	✅	✅	-
        bun-darwin-arm64	macOS	arm64	✅	N/A	-
        bun-linux-x64-musl	Linux	x64	✅	✅	musl
        bun-linux-arm64-musl	Linux	arm64	✅	N/A	musl
        ```
        Bun auto appends `.exe` on Windows.
        Run all commands in parallel.
  3. setup package.json bin fields for moon.*.js
  4. make workspace root dependent on module-es and update moon.yml
