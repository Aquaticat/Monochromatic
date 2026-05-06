# Named tracer.Dockerfile for nvim-web-devicons icon matching.
#
# Minimal container for bitmap-to-SVG tracing.
# Potrace is not available on Fedora Atomic / Bazzite, so it lives here.
# ImageMagick runs on the host; only potrace needs containerization.
FROM docker.io/alpine:3.21@sha256:48b0309ca019d89d40f670aa1bc06e426dc0931948452e8491e3d65087abc07d

RUN apk add --no-cache potrace

WORKDIR /work
