# Oxlint Linter Troubleshooting

## Slow Startup Performance

### Problem
Oxlint experiences slow startup times when installed as a package dependency.

### Solution
Removed oxlint from root `package.json` and now managed through `.prototools`.

### Benefits
- Faster project initialization
- Reduced dependency installation time
- Tool version managed independently from Node dependencies
- Better integration with proto tool manager

### Configuration
Oxlint is now configured in `.prototools`:
```toml
[tools]
oxlint = "latest"  # or specific version
```

### Running Oxlint
After installation via proto:
```bash
# Via proto
proto run oxlint

# Or directly if proto shims are configured
oxlint
```

## Integration with ESLint

Oxlint is used alongside ESLint in this project.
See [ESLint Troubleshooting](./TROUBLESHOOTING.eslint.md) for configuration details when both linters are used together.