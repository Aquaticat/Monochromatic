# Stylelint Troubleshooting

## Stylelint Can't Resolve postcss-html

### Problem
```txt
Error: Cannot resolve custom syntax module "postcss-html". Check that module "postcss-html" is available and spelled correctly.  
Caused by: Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'postcss-html' imported from 
C:\Users\user\AppData\Local\pnpm\store\v10\links\stylelint\16.19.1\...\node_modules\stylelint\lib\utils\dynamicImport.cjs
```

### Solution
Add the missing dependency to `pnpm-workspace.yaml`:

```yaml
packageExtensions:
  stylelint:
    dependencies:
      'postcss-html': '*'
```

### Root Cause
Stylelint requires `postcss-html` for parsing HTML files but doesn't declare it as a dependency.
The packageExtensions feature in pnpm allows us to patch missing dependencies in third-party packages.