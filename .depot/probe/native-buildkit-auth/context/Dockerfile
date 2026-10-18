# Frozen Node24 fixture base proves this narrow consumer; it does not replace the repository Node26 toolchain.
FROM docker.io/library/node@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS producer
WORKDIR /app
COPY package.json manifest.json consumer.ts task-queue.ts /app/
RUN ["node","consumer.ts"]
FROM scratch AS evidence
COPY --from=producer /output/ /
