When writing code in TypeScript, try to:
- Follow eslint airbnb coding style
- Avoid special handling to preserve `this`
- Avoid explicit `new Promise` creation in application code
- Write a corresponding Vitest file that aims for 100% test coverage
- Prefer `const` generic type parameters
- Prefer function declarations, and try to declare them before use
- Provide explicit parameter and return types for functions, methods, and class accessors
- Prefer const over let
- Declare magic numbers, strings, regexes, and the like as const variables.
