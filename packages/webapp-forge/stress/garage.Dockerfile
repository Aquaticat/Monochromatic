# Named garage.Dockerfile (not Dockerfile.garage) so nvim-web-devicons
# matches the "Dockerfile" extension and applies the icon.
#
# Single-node Garage instance for stress tests. Self-initialises a
# 1-node cluster on first boot, creates a `fragments` bucket, and emits
# an access key + secret to the named volume `garage-creds:/secrets/`
# so the harness can read them.
#
# Garage v1.x.x stable: see https://garagehq.deuxfleurs.fr/download/

FROM dxflrs/garage:v1.0.1

# Copy the static config + entrypoint that handles first-boot init.
COPY packages/webapp-forge/stress/garage.toml /etc/garage.toml
COPY packages/webapp-forge/stress/garage-init.sh /usr/local/bin/garage-init.sh

# The entrypoint shell builtin needs sh; the official image includes it.
RUN chmod +x /usr/local/bin/garage-init.sh

# Persist cluster metadata and data across container restarts.
VOLUME ["/var/lib/garage", "/secrets"]

# S3 API.
EXPOSE 3900

# Admin API (used by the entrypoint to create the bucket + key).
EXPOSE 3903

# RPC bind (single-node setup; only needs to be reachable inside the container).
EXPOSE 3901

ENTRYPOINT ["/usr/local/bin/garage-init.sh"]
