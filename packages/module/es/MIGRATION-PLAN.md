# Module ES Migration Plan - Flat to Hierarchical Structure

## Migration Overview

**Objective**: Transform flat `src/` directory (180+ files) into hierarchical structure supporting 500+ functions while preserving all current benefits.

**Timeline**: Phased migration over 2-3 weeks to minimize disruption

## Current Benefits to Preserve

### ✅ Critical Requirements (Must Not Break)
1. **Tree-shaking Optimization**: Individual function files enable optimal bundle sizes
2. **Test Co-location**: Tests must remain alongside implementations
3. **Platform Variants**: `.node.ts` vs `.default.ts` pattern must work seamlessly
4. **Backward Compatibility**: All existing imports must continue working
5. **Build System Integration**: Moon build tasks must work with nested directories
6. **Individual Function Imports**: Specific function imports must be preserved
7. **TypeScript Compilation**: No regression in compilation performance

### ✅ Technical Patterns to Maintain
- Single function per file (enables tree-shaking)
- `category.function.ts` naming within categories
- Platform-specific file variants (`.node.ts`/`.default.ts`)
- Test files co-located with implementations (`.unit.test.ts`, `.browser.test.ts`)
- TSDoc documentation patterns
- Export patterns from individual files

## Phase 1: Infrastructure Setup (Week 1)

### Day 1-2: Create Migration Tooling

**Create automated migration scripts to ensure accuracy:**

#### Migration Script Requirements
```typescript
// development/moon/migrate-structure.ts
interface MigrationPlan {
  sourceFile: string;
  targetPath: string;
  category: string;
  subcategory?: string;
  updateImports: string[]; // Files that import this function
}

const migrationMap: MigrationPlan[] = [
  {
    sourceFile: 'any.constant.ts',
    targetPath: 'any/constant.ts', 
    category: 'any',
    updateImports: ['index.ts', 'any.unit.test.ts']
  },
  {
    sourceFile: 'array.type.fixedLength.ts',
    targetPath: 'array/type/fixedLength.ts',
    category: 'array', 
    subcategory: 'type',
    updateImports: ['index.ts', 'array.type.fixedLength.unit.test.ts']
  },
  // ... complete migration mapping for all 180+ files
];
```

#### Migration Steps Script
1. **Analyze Dependencies**: Scan all files for import statements
2. **Create Directory Structure**: Generate nested directories
3. **Move Files**: Copy files to new locations with path updates
4. **Update Imports**: Update all internal import references
5. **Create Index Files**: Generate category and subcategory index files
6. **Validate Builds**: Ensure TypeScript compilation still works
7. **Run Tests**: Verify all tests pass with new structure

### Day 3-4: Validate New Export Strategy

**Test new package.json exports configuration:**

```json
{
  "exports": {
    ".": {
      "types": "./dist/final/types/src/index.d.ts",
      "node": "./dist/final/js/index.node.js",
      "default": "./dist/final/js/index.js"
    },
    "./array": {
      "types": "./dist/final/types/src/array/index.d.ts", 
      "node": "./dist/final/js/array/index.node.js",
      "default": "./dist/final/js/array/index.js"
    },
    "./string": {
      "types": "./dist/final/types/src/string/index.d.ts",
      "node": "./dist/final/js/string/index.node.js", 
      "default": "./dist/final/js/string/index.js"
    },
    "./function": {
      "types": "./dist/final/types/src/function/index.d.ts",
      "node": "./dist/final/js/function/index.node.js",
      "default": "./dist/final/js/function/index.js"
    }
    // ... all other categories
  }
}
```

### Day 5-7: Test Migration on Single Category

**Proof of concept with `array` category:**
1. Create `src/array/` directory structure
2. Move all `array.*` files to appropriate subdirectories  
3. Create `src/array/index.ts` with all exports
4. Update main `src/index.ts` to use `export * from './array/index.ts'`
5. Run build and tests to validate approach
6. Measure performance impact on builds and IDE

## Phase 2: Core Categories Migration (Week 2)

### Day 8-10: Migrate Primary Categories

**Migrate in dependency order to minimize import update complexity:**

#### Day 8: Foundation Categories (No dependencies)
- `any/` - Generic utilities with no dependencies
- `error/` - Error handling utilities  
- `numeric/` - Number operations

#### Day 9: Core Categories (Depend on foundation)
- `array/` - Array operations (depends on any, error)
- `string/` - String utilities (depends on any, error)
- `collection/` - Map/Set utilities (depends on any, error)

#### Day 10: Advanced Categories (Depend on core)
- `function/` - Function utilities (depends on any, array, error)
- `iterable/` - Iterable operations (depends on array, function)
- `promise/` - Promise utilities (depends on any, error)

### Day 11-12: Platform-Specific Migration

**Migrate platform-specific categories:**
- `platform/fs/` - All filesystem utilities with `.node.ts`/`.default.ts` variants
- `platform/dom/` - All DOM utilities for browser platform
- `platform/indexedDb/` - Database utilities

### Day 13-14: Development Utilities Migration

**Migrate development-focused utilities:**
- `development/cli/` - CLI utilities
- `development/fixture/` - Test fixtures  
- `development/logging/` - Logging configuration
- `development/moon/` - Build system utilities
- `development/testing/` - Testing utilities

## Phase 3: Validation and Finalization (Week 3)

### Day 15-17: Comprehensive Validation

#### Build System Validation
- [ ] **TypeScript Compilation**: Verify no compilation errors
- [ ] **Moon Tasks**: Ensure all Moon tasks work with nested structure
- [ ] **Test Execution**: All tests pass with new file locations
- [ ] **Platform Builds**: Both Node.js and browser builds work correctly
- [ ] **Bundle Generation**: Final bundles identical to original

#### Import Compatibility Testing  
- [ ] **Existing Imports**: All current imports continue working
- [ ] **Category Imports**: New category-level imports work
- [ ] **Subcategory Imports**: Deep imports work correctly
- [ ] **Platform Imports**: Platform-specific imports work
- [ ] **Tree-shaking**: Bundle sizes unchanged for specific imports

#### Performance Validation
- [ ] **Build Performance**: Build times unchanged or improved  
- [ ] **IDE Performance**: File navigation and autocomplete improved
- [ ] **Runtime Performance**: No performance regression in functions
- [ ] **Memory Usage**: No memory regression in build or runtime

### Day 18-19: Documentation Updates

#### Update All Documentation
- [ ] **README.md**: Update examples with new import patterns
- [ ] **Package.json**: Update exports configuration
- [ ] **TSDoc Comments**: Update any references to file paths
- [ ] **TODO Files**: Update file path references in all TODO files
- [ ] **Migration Guide**: Create guide for users adopting new imports

### Day 20-21: Final Cleanup and Testing

#### Final Validation
- [ ] **Remove Original Files**: After confirming migration success
- [ ] **Update Git**: Clean git history and verify no missing files
- [ ] **Final Build Test**: Complete build and test cycle
- [ ] **Package Publishing Test**: Verify package can be published
- [ ] **Integration Testing**: Test with external projects

## Import Path Migration Strategy

### Internal Import Updates Required

#### Current Internal Import Pattern
```typescript
// In array.range.ts
import { isPositiveInt } from './numeric.int.ts';
import { notNullishOrThrow } from './error.throw.ts';
```

#### New Internal Import Pattern  
```typescript  
// In array/range.ts
import { isPositiveInt } from '../numeric/validation/int.ts';
import { notNullishOrThrow } from '../error/guards/throw.ts';
```

#### Automated Import Update Script
```typescript
// Update all internal imports during migration
const importUpdates = new Map([
  // any.* → any/*
  ['./any.constant.ts', '../any/constant.ts'],
  ['./any.echo.ts', '../any/echo.ts'],
  // array.* → array/* with subcategories
  ['./array.type.fixedLength.ts', '../array/type/fixedLength.ts'],  
  ['./array.findIndex.ts', '../array/search/findIndex.ts'],
  // string.* → string/* with subcategories
  ['./string.digits.ts', '../string/validation/digits.ts'],
  ['./string.capitalize.ts', '../string/transform/capitalize.ts'],
  // ... complete mapping for all internal imports
]);
```

### External Import Compatibility

#### Existing Imports (Must Continue Working)
```typescript
// Main package import - MUST WORK
import { arrayOf, isString, pipe, equal } from '@monochromatic-dev/module-es';

// Specific file imports - MUST WORK  
import { pipe } from '@monochromatic-dev/module-es/function.pipe';
import { isString } from '@monochromatic-dev/module-es/string.is';
```

#### New Import Options (Added Capability)
```typescript
// Category imports - NEW CAPABILITY
import { arrayOf, arrayRange } from '@monochromatic-dev/module-es/array';
import { isString, capitalizeString } from '@monochromatic-dev/module-es/string'; 
import { pipe, piped } from '@monochromatic-dev/module-es/function';

// Subcategory imports - NEW CAPABILITY
import { pipe, piped } from '@monochromatic-dev/module-es/function/compose';
import { isDigitString } from '@monochromatic-dev/module-es/string/validation';
import { findIndex } from '@monochromatic-dev/module-es/array/search';
```

## Build System Compatibility

### Moon Build System Validation

#### Current Moon Configuration (moon.yml)
```yaml
tasks:
  js_browser:
    options:
      cache: false
  js_node: 
    options:
      cache: false
  js:
    options:
      cache: false
```

#### Required Updates for Nested Structure
- [ ] **Task Definitions**: Verify Moon tasks work with nested `src/` structure
- [ ] **Cache Configuration**: Test cache behavior with new file organization
- [ ] **Platform Builds**: Ensure dual builds work with nested `.node.ts`/`.default.ts`
- [ ] **Dependency Tracking**: Verify Moon tracks dependencies correctly across directories

### Vite Configuration Compatibility

#### Current Vite Config (vite.config.ts)
```typescript
import { getLib } from '@monochromatic-dev/config-vite/.ts';
const _default_1 = getLib(import.meta.dirname);
export default _default_1;
```

#### Validation Required
- [ ] **Entry Point Resolution**: Verify Vite resolves nested entry points
- [ ] **Build Outputs**: Confirm build outputs match expected structure
- [ ] **Platform-Specific Builds**: Test Node.js vs browser build differentiation
- [ ] **Tree-shaking**: Validate dead code elimination works with nested imports

### TypeScript Configuration Impact

#### Current TypeScript Config
```json
{
  "extends": "@monochromatic-dev/config-typescript/dom", 
  "compilerOptions": {
    "baseUrl": "./"
  }
}
```

#### Required Validation
- [ ] **Module Resolution**: Verify TypeScript resolves nested modules correctly
- [ ] **Path Mapping**: Confirm baseUrl works with nested structure
- [ ] **Type Generation**: Test type definition generation for nested exports
- [ ] **Compilation Performance**: Monitor TypeScript compilation speed

## Risk Mitigation Strategies

### High-Risk Areas

#### Import Path Complexity
**Risk**: 180+ files × average 3-5 imports each = 500-900 import statements to update
**Mitigation**: 
- Automated migration script with comprehensive import mapping
- Validation script to check all imports resolve correctly
- Rollback plan if migration fails

#### Build System Integration  
**Risk**: Nested structure might break Moon's task execution or caching
**Mitigation**:
- Test on single category first (array) before full migration
- Maintain parallel old structure during validation period
- Monitor build performance throughout migration

#### Platform-Specific File Handling
**Risk**: `.node.ts`/`.default.ts` files scattered across nested structure  
**Mitigation**:
- Clear documentation of platform file locations
- Automated script to verify all platform variants are properly placed
- Test platform builds extensively before finalizing

### Medium-Risk Areas

#### IDE Tool Integration
**Risk**: IDEs might need reconfiguration for nested structure
**Mitigation**: 
- Test with VS Code, WebStorm during migration
- Update workspace configuration if needed
- Measure autocomplete and navigation performance

#### External Package Integration
**Risk**: Other packages importing specific files might break
**Mitigation**:
- Audit all internal package dependencies on module-es
- Update package.json exports to support both old and new paths
- Maintain legacy export compatibility during transition

## Gradual Migration Strategy

### Option 1: Category-by-Category Migration (Recommended)

#### Week 1: Foundation Categories
1. **Day 1-2**: Migrate `any/` category (8 files, no dependencies)
2. **Day 3-4**: Migrate `error/` category (8 files, minimal dependencies)  
3. **Day 5-7**: Migrate `numeric/` category (8 files, depends on error)

**Benefits**: Low risk, early validation, isolated testing

#### Week 2: Core Categories  
1. **Day 8-9**: Migrate `array/` category (12 files, depends on any/error)
2. **Day 10-11**: Migrate `string/` category (15 files, depends on any/error)
3. **Day 12-14**: Migrate `collection/` category (map, set utilities)

#### Week 3: Complex Categories
1. **Day 15-16**: Migrate `function/` category (15 files, complex dependencies)
2. **Day 17-18**: Migrate `iterable/` category (20 files, depends on array/function) 
3. **Day 19-21**: Migrate `platform/` and `development/` categories

### Option 2: Big Bang Migration (Higher Risk)

**Single migration**: Move all files at once over a weekend
**Benefits**: Shorter disruption period, no mixed state
**Risks**: Higher chance of missing imports, harder to debug issues

## Detailed Migration Steps

### Step 1: Preparation (Pre-Migration)
1. **Create migration mapping**: Complete file → new location mapping
2. **Analyze imports**: Map all internal import dependencies  
3. **Create directories**: Generate all nested directory structure
4. **Backup current state**: Git tag current working state
5. **Create rollback plan**: Script to revert migration if needed

### Step 2: File Movement (Per Category)
1. **Copy files**: Copy category files to new directory structure
2. **Update imports**: Update internal import paths within moved files
3. **Create index files**: Generate category and subcategory index files
4. **Test compilation**: Verify TypeScript compilation works
5. **Update main index**: Update main src/index.ts to use new exports

### Step 3: Validation (Per Category)
1. **Build test**: Run `moon run build` to verify build works
2. **Unit tests**: Run `moon run test` to verify tests pass
3. **Import test**: Test new category imports work correctly
4. **Bundle test**: Verify tree-shaking still works optimally
5. **Performance test**: Measure any performance impact

### Step 4: Cleanup (Per Category)
1. **Remove original files**: Delete original flat structure files
2. **Update references**: Update any remaining references to old paths
3. **Git commit**: Commit category migration with clear message
4. **Documentation update**: Update relevant documentation

## Import Update Automation

### Automated Import Path Updates

#### Script to Update Internal Imports
```typescript
// Automated import path transformation
const importTransforms = new Map([
  // Direct category mappings
  ["./any.constant.ts", "./any/constant.ts"],
  ["./any.echo.ts", "./any/echo.ts"],
  
  // Subcategory mappings with relative path adjustments
  ["./array.type.fixedLength.ts", "./array/type/fixedLength.ts"],
  ["./string.fs.default.ts", "./string/fs/default.ts"],
  ["./fs.pathJoin.shared.ts", "./platform/fs/path/join/shared.ts"],
  
  // Cross-category imports (need relative path calculation)
  ["./error.throw.ts", "../error/guards/throw.ts"], // From array/ to error/
  ["./numeric.int.ts", "../numeric/validation/int.ts"], // From array/ to numeric/
]);

function updateImportsInFile(filePath: string, newLocation: string): void {
  // Read file content
  // Parse import statements
  // Calculate new relative paths based on new location
  // Update import paths using transform map
  // Write updated file content
}
```

#### Cross-Category Import Path Calculation
```typescript
// Example: array/range.ts importing from numeric/validation/int.ts
// From: import { isPositiveInt } from './numeric.int.ts';
// To:   import { isPositiveInt } from '../numeric/validation/int.ts';

function calculateRelativePath(fromDir: string, toFile: string): string {
  // Calculate relative path based on directory nesting
  // Handle cross-category imports with correct ../../../ depth
}
```

## Index File Generation Strategy

### Main Index File (src/index.ts)
```typescript
// BEFORE: Individual file exports (145 lines)
export * from './any.constant.ts';
export * from './any.echo.ts';
export * from './array.basic.ts';
// ... 140+ more individual exports

// AFTER: Category-based exports (13 lines)
export * from './any/index.ts';
export * from './array/index.ts'; 
export * from './string/index.ts';
export * from './function/index.ts';
export * from './iterable/index.ts';
export * from './object/index.ts';
export * from './error/index.ts';
export * from './numeric/index.ts';
export * from './collection/index.ts';
export * from './promise/index.ts';
export * from './platform/index.ts';
export * from './development/index.ts';
export * from './specialized/index.ts';
```

### Category Index Files
```typescript
// src/array/index.ts
export * from './basic.ts';
export * from './empty.ts'; 
export * from './nonEmpty.ts';
export * from './of.ts';
export * from './range.ts';
export * from './length.ts';
// Subcategory exports
export * from './search/index.ts';
export * from './conversion/index.ts'; 
export * from './type/index.ts';
```

### Subcategory Index Files
```typescript
// src/array/type/index.ts  
export * from './fixedLength.ts';
export * from './mapTo.ts';
export * from './tuple.ts';
export * from './withoutFirst.ts';
```

## Testing Strategy During Migration

### Continuous Validation Per Phase

#### Build Validation
```bash
# After each category migration
moon run build                    # Verify TypeScript compilation
moon run test                     # Verify all tests pass
moon run validate                 # Full validation pipeline

# Bundle size validation
npm run build:analyze            # Check tree-shaking works
npm run test:imports            # Test new import patterns
```

#### Import Testing Scripts
```typescript
// Test all import patterns work
// test/import-validation.test.ts

describe('Import Patterns After Migration', () => {
  test('main package imports work', async () => {
    const { arrayOf, isString, pipe } = await import('@monochromatic-dev/module-es');
    expect(typeof arrayOf).toBe('function');
    expect(typeof isString).toBe('function'); 
    expect(typeof pipe).toBe('function');
  });
  
  test('category imports work', async () => {
    const ArrayUtils = await import('@monochromatic-dev/module-es/array');
    expect(typeof ArrayUtils.arrayOf).toBe('function');
    expect(typeof ArrayUtils.arrayRange).toBe('function');
  });
  
  test('subcategory imports work', async () => {
    const { findIndex } = await import('@monochromatic-dev/module-es/array/search');
    expect(typeof findIndex).toBe('function');
  });
});
```

## Rollback Strategy

### If Migration Fails

#### Immediate Rollback Plan  
1. **Git Reset**: Reset to pre-migration tagged state
2. **Restore Flat Structure**: Restore original flat file structure
3. **Restore Imports**: Restore original import statements
4. **Validate Rollback**: Ensure original functionality works
5. **Analyze Failure**: Debug migration issues before retry

#### Partial Rollback Strategy
1. **Category-Level Rollback**: Rollback specific categories that failed
2. **Mixed Structure**: Continue with partially migrated structure
3. **Gradual Retry**: Retry failed categories individually
4. **Progressive Migration**: Complete migration more slowly

## Success Criteria

### Technical Success Metrics
- [ ] **Zero Build Regression**: All builds work identically to pre-migration
- [ ] **Zero Test Regression**: All tests pass without modification  
- [ ] **Zero Performance Regression**: No slowdown in builds, tests, or runtime
- [ ] **Import Compatibility**: 100% backward compatibility with existing imports
- [ ] **New Import Capabilities**: All planned category/subcategory imports work

### Developer Experience Success Metrics
- [ ] **Navigation Improvement**: <30 seconds to find any function (measured)
- [ ] **Discovery Enhancement**: Related functions findable within category
- [ ] **IDE Performance**: Improved autocomplete and file navigation
- [ ] **Maintenance Efficiency**: Category-wide changes significantly faster
- [ ] **Onboarding Speed**: New developers find structure intuitive

### Scalability Success Metrics  
- [ ] **500+ Function Ready**: Structure can handle 500+ functions without issues
- [ ] **Category Growth**: New categories can be added easily
- [ ] **Subcategory Flexibility**: Complex categories can be subdivided further
- [ ] **Platform Expansion**: New platforms can be added to platform/ directory
- [ ] **Tool Integration**: Development tools work well with nested structure

## Risk Assessment

### Low Risk (Easily Reversible)
- Creating new directory structure
- Creating index files
- Testing new import patterns

### Medium Risk (Reversible with Effort)  
- Moving files to new locations
- Updating internal import paths
- Updating package.json exports

### High Risk (Hard to Reverse)
- Deleting original flat structure
- Publishing with new structure
- External packages depending on new structure

## Migration Timeline Summary

**Week 1**: Infrastructure setup, tooling, proof-of-concept
**Week 2**: Core category migrations with continuous validation  
**Week 3**: Final validation, documentation, and cleanup

**Total Duration**: 3 weeks with daily validation and rollback capability

The migration transforms an unmanageable flat structure into a scalable hierarchical architecture that supports the ambitious 500+ function vision while preserving all current technical benefits and maintaining complete backward compatibility.