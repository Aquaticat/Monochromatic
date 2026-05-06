# Named playwright.Dockerfile (not Dockerfile.playwright) because nvim-web-devicons
# matches icons by file extension — "Dockerfile" is a recognized extension.
#
# Playwright test runner for immutable OSes (Bazzite, Fedora Atomic, etc.)
# that lack apt-get for installing browser dependencies.
#
# Only browsers and system libraries live in this container.
# @playwright/test stays in the host catalog for type checking and IDE support
# (test files import { test, expect } from it). Do not remove it from package.json.
#
# The version tag MUST match the @playwright/test version in bun.lock.
# Find available tags: https://mcr.microsoft.com/v2/playwright/tags/list
FROM mcr.microsoft.com/playwright:v1.59.1-noble@sha256:b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53

RUN apt-get update && apt-get install -y unzip && rm -rf /var/lib/apt/lists/*

ENV BUN_INSTALL="/usr/local"
RUN curl -fsSL https://bun.sh/install | bash

WORKDIR /work
