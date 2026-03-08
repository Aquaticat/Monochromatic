FROM ubuntu:latest
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates apt-utils\
 && rm -rf /var/lib/apt/lists/*
RUN sed -i 's|http://|https://|g' /etc/apt/sources.list.d/ubuntu.sources
RUN apt-get update \
 && apt-get install -y --no-install-recommends podman git unzip curl bash build-essential
RUN curl https://mise.run/bash | sh
ENV PATH="/root/.local/bin:$PATH"
# vfs driver: avoids overlay mount issues inside Docker volumes.
# Performance is acceptable — the canary pulls one small image infrequently.
RUN printf '[storage]\ndriver = "vfs"\nrunroot = "/run/containers/storage"\ngraphroot = "/var/lib/containers/storage"\n' \
      > /etc/containers/storage.conf
RUN echo 'root:100000:65536' > /etc/subuid \
 && echo 'root:100000:65536' > /etc/subgid

WORKDIR /app
COPY . .

RUN ls -la

RUN mise trust --all

RUN export $(cat .env.local | xargs) && mise install

RUN mise run prepare
