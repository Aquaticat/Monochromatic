# Named playwright.Dockerfile (not Dockerfile.playwright) because nvim-web-devicons
# matches icons by file extension: "Dockerfile" is a recognized extension.
#
# Playwright test runner for immutable OSes (Bazzite, Fedora Atomic, etc.)
# that lack apt-get for installing browser dependencies.
#
# Only browsers and system libraries live in this container.
# @playwright/test stays in the host catalog for type checking and IDE support
# (test files import { test, expect } from it). Do not remove it from package.json.
#
# The version tag MUST match the @playwright/test resolution in pnpm-lock.yaml.
# Find available tags: https://mcr.microsoft.com/v2/playwright/tags/list
FROM mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27

RUN apt-get update && apt-get install -y unzip && rm -rf /var/lib/apt/lists/*

ENV BUN_INSTALL="/usr/local"
RUN curl -fsSL https://bun.sh/install | bash

WORKDIR /work
