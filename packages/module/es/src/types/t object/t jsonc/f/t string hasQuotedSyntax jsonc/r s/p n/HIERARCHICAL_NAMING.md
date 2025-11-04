# Hierarchical file naming convention

## Overview

This directory uses a strict hierarchical file naming convention using dot notation to represent parent-child relationships between modules.
Files are named to explicitly show their dependency hierarchy, making the module structure self-documenting.

## Naming pattern

Files use dot notation where each segment indicates a level in the hierarchy:

```
parent.ts
parent.child.ts
parent.child.grandchild.ts
```

The naming directly reflects which modules can depend on which:
- **Parent can depend on child** (downward dependencies allowed)
- **Siblings cannot depend on each other** (lateral dependencies forbidden)
- **Child cannot depend on parent** (upward dependencies forbidden)

## Dependency rules

### Allowed dependencies

**Downward dependencies (parent → child)**:
- `index.ts` can import from `customParsers.ts` or `fastPath.ts`
- `customParsers.ts` can import from `customParsers.startsWithComment.ts`
- `customParsers.startsWithComment.ts` can import from `customParsers.startsWithComment.mergeComments.ts`

### Forbidden dependencies

**Lateral dependencies (sibling ↔ sibling)**:
- `customParsers.tokenizers.ts` CANNOT import from `customParsers.arrayHelpers.ts`
- `fastPath.ts` CANNOT import from `customParsers.ts` (they are siblings under `index.ts`)

**Upward dependencies (child → parent)**:
- `customParsers.startsWithComment.ts` CANNOT import from `customParsers.ts`
- `customParsers.ts` CANNOT import from `index.ts`

## File structure example

```txt
index.ts (164 lines)
├── fastPath.ts (198 lines)
│   └── customParsers.startsWithComment.ts (imported for startsWithComment function)
└── customParsers.ts (265 lines) - MUTUAL RECURSION CORE
    ├── customParsers.tokenizers.ts (100 lines)
    ├── customParsers.arrayHelpers.ts (69 lines)
    │   └── customParsers.startsWithComment.ts
    ├── customParsers.recordHelpers.ts (121 lines)
    │   ├── customParsers.startsWithComment.ts
    │   └── customParsers.scanQuotedString.ts (52 lines)
    ├── customParsers.scanQuotedString.ts (52 lines)
    └── customParsers.startsWithComment.ts (135 lines)
        └── customParsers.startsWithComment.mergeComments.ts (35 lines)
```

## Mutual recursion exception

When functions have mutual recursion (function A calls B, function B calls A), they MUST be kept in the same file to avoid circular imports.

In this codebase:
- `parseValueFromStart()` ↔ `customParserForArray()` ↔ `parseArrayElements()`
- `parseValueFromStart()` ↔ `customParserForRecord()` ↔ `parseRecordMembers()`

All mutually recursive functions are kept in `customParsers.ts` (265 lines).
This file exceeds the 200-line target specifically to accommodate mutual recursion without creating circular dependencies.

## Test file naming

Test files follow the exact same hierarchical naming as implementation files, with the `.unit.test.ts` or `.browser.test.ts` suffix:

```txt
customParsers.ts → customParsers.unit.test.ts
customParsers.startsWithComment.ts → customParsers.startsWithComment.unit.test.ts
customParsers.startsWithComment.mergeComments.ts → customParsers.startsWithComment.mergeComments.unit.test.ts
```

## Benefits

**Self-documenting structure**: File names explicitly show module relationships without needing to inspect imports.

**Prevents circular dependencies**: Strict hierarchy rules make circular imports structurally impossible (except for explicitly handled mutual recursion).

**Scalable organization**: New modules can be added as children at any level without disrupting existing structure.

**Clear dependency direction**: Import relationships are unidirectional and predictable.

## Migration notes

When splitting large files:

1. Identify dependency relationships between functions/sections
2. Extract leaf nodes first (functions with no internal dependencies)
3. Create hierarchical names showing parent-child relationships
4. Move mutual recursion last, keep in same file
5. Update all imports to use new hierarchical paths
6. Create matching test files with same hierarchical naming
