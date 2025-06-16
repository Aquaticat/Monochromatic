#!/bin/bash
VERSION=$(pnpm exec playwright --version | sed 's/Version //')
if pnpm exec playwright install --list | grep -q "Playwright version: $VERSION"; then
    echo "Playwright browsers already installed for version $VERSION"
else
    pnpm exec playwright install
fi