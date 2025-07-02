FROM ubuntu:24.04 AS builder

# Build argument for which project to build
ARG PROJECT=exa-search

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install proto
RUN curl -fsSL https://moonrepo.dev/install/proto.sh | bash
ENV PATH="/root/.proto/bin:/root/.proto/shims:$PATH"

WORKDIR /app

# Copy proto config
COPY .prototools .prototools

# Install tools via proto
RUN proto install

# Copy the entire monorepo
COPY . .

# Run moon prepare (builds all projects)
RUN moon run prepare

# Production stage
FROM caddy:alpine

ARG PROJECT=exa-search

# Copy all built files from builder
COPY --from=builder /app/packages /srv/packages

# Create a simple Caddyfile for serving the specific project
RUN echo ":80 { root * /srv/packages/site/${PROJECT}/dist/final/js; file_server }" > /etc/caddy/Caddyfile

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]