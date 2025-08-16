# Build and Execution

## Bun scripts vs single file executables

Direct `bun <script>.ts` execution in moon.yml:

- **Platform portability**: Bun single file executables aren't cross-platform
- **Industry precedent**: Oxlint and dprint use runtime platform detection
- **Performance**: Acceptable startup cost for portability