#!/usr/bin/env bash
set -e

# Pre-commit hook for Monochromatic monorepo
# This hook runs linting and unit tests on affected files only

echo "🔍 Running pre-commit checks..."

# Run linting on affected files
echo "📝 Running linters on affected files..."
if ! moon run lint --affected; then
    echo "❌ Linting failed! Please fix the issues before committing."
    exit 1
fi

# Run unit tests on affected files
echo "🧪 Running unit tests on affected files..."
if ! moon run testUnit --affected; then
    echo "❌ Unit tests failed! Please fix the failing tests before committing."
    exit 1
fi

echo "✅ All pre-commit checks passed!"
exit 0