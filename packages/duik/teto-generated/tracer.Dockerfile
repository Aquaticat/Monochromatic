# Named tracer.Dockerfile for nvim-web-devicons icon matching.
#
# Minimal container for bitmap-to-SVG tracing.
# Potrace is not available on Fedora Atomic / Bazzite, so it lives here.
# ImageMagick runs on the host; only potrace needs containerization.
FROM docker.io/alpine:3.21

RUN apk add --no-cache potrace

WORKDIR /work
