FROM ubuntu:24.04 AS builder

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    xz-utils \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install proto non-interactively
RUN bash -c "$(curl -fsSL https://moonrepo.dev/install/proto.sh)" -- --yes
ENV PATH="/root/.proto/bin:/root/.proto/shims:$PATH"

WORKDIR /app

# Copy the entire monorepo
COPY . .

RUN proto install

# Run moon prepare and build (builds all projects)
# Eventually the tasks would be fixed so we don't need the allowFailure variant.
# Right now it doesn't build because we're not auto setting up snap when installing Vale.
# We're migrating off Vale anyway.
RUN moon run prepareAndBuildAllowFailure

# Production stage
FROM caddy:alpine

# Copy all built files from builder
COPY --from=builder /app /srv

EXPOSE 80

CMD ["caddy", "run", "--config", "/srv/Caddyfile", "--adapter", "caddyfile"]
