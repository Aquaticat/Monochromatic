FROM oven/bun:1.3-debian

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates podman git \
 && rm -rf /var/lib/apt/lists/*

# vfs driver: avoids overlay mount issues inside Docker volumes.
# Performance is acceptable — the canary pulls one small image infrequently.
RUN printf '[storage]\ndriver = "vfs"\nrunroot = "/run/containers/storage"\ngraphroot = "/var/lib/containers/storage"\n' \
      > /etc/containers/storage.conf

WORKDIR /app
COPY . .

RUN bun install

ENV PATH="/app/node_modules/.bin:$PATH"
