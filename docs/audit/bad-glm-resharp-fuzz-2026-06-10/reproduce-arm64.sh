#!/usr/bin/env bash
# Standalone ARM64 reproducer for resharp v0.6.12 fuzz findings.
# Run on an ARM64 Linux host with Rust nightly + cargo-fuzz installed.
# Requires resharp v0.6.12 source at ./resharp-v0.6.12 (or set RESHARP_SRC).
set -euo pipefail

RESHARP_SRC="${RESHARP_SRC:-./resharp-v0.6.12}"
TIMEOUT="${TIMEOUT:-15}"
TARGET="${TARGET:-aarch64-unknown-linux-gnu}"

if [ ! -d "$RESHARP_SRC/fuzz" ]; then
  echo "ERROR: resharp source not found at $RESHARP_SRC"
  echo "Clone with: git clone --branch v0.6.12 --depth 1 https://github.com/ieviev/resharp.git $RESHARP_SRC"
  exit 1
fi

# Build the fuzz compile target once
cd "$RESHARP_SRC"
cargo +nightly fuzz build compile --fuzz-dir fuzz --target "$TARGET" 2>&1 | tail -3
echo "Build complete."

# List of finding patterns (decoded from fuzz artifacts)
# Format: hex_of_fuzz_input | config | description
findings=(
  # ARM64-BUG-1: Unicode property class compile blowup
  "2a0000005c507b4c7d32|default|\\P{L}2 timeout 7.25s"
  "2a0100005c507b4c7d32|default|\\P{L}2 (alt opt byte) timeout"
  "0061575c507b4c7d5c28413f|default|aW\\P{L}\\(A? timeout"
  "2a5c507b4c7d942e7e20082888|default|\\P{L}+non-utf8 timeout"
  "5d5c772b5c622a|flag-bundle|\\w+\\b* timeout"
  "7b382c7d5c625c772b5c72|flag-bundle|{8,}\\b\\w+\\r slow 7s"
  # ARM64-BUG-1 nosimd variant
  "5b412d5a612d7a302d395d11000000000000005c707b4c7d2a265f2a5b412d5a5d5fcb|hardened|[A-Za-z0-9]\\p{L}*&_\\*[A-Z] timeout"
  "375c507b4c7d2e5b5b5e612d7a5d306c3a5d5dabab00000001ababababab2b5c6435|hardened|\\P{L}.[[^a-z]0l:]]+stuff slow"
  # ARM64-BUG-1 fork variant
  "3d5c707b4c7d|hardened|\\p{L} slow"
  "536865726c5c507b4c7d6f636b7c486f6c6d00737c576174736f6e|flag-bundle|Sherl\\P{L}ock|Holm s|Watson slow"
  "28536372697074283f6d295c507b4c7d5f3a2e5f2a2a|javascript|Script(?m)\\P{L}_:._** timeout"
  "3c6469763e7e285c707b4c7d69763e5f2a29432f6469763e|default|div>~(\\p{L}iv>_*)C/div> timeout"
  # ARM64-BUG-2: word boundary + word class
  "155c625c772b5c2f62|full|\\b\\w+\\/b slow"
  "155c625c772e5c2f2162|full|\\b\\w.\\/!b timeout"
  # ARM64-BUG-3: \\B timeout
  "ff5c42|full|\\B timeout (nosimd)"
)

echo ""
echo "=== Reproducing ${#findings[@]} ARM64 fuzz findings ==="
echo "Source: $RESHARP_SRC"
echo "Target: $TARGET"
echo "Timeout per input: ${TIMEOUT}s"
echo ""

pass=0
fail=0
for entry in "${findings[@]}"; do
  hex="${entry%%|*}"
  rest="${entry#*|}"
  config="${rest%%|*}"
  desc="${rest#*|}"

  # Write binary artifact
  artifact="/tmp/resharp-repro-$(echo "$hex" | head -c 16).bin"
  echo "$hex" | xxd -r -p > "$artifact"

  echo -n "  $desc ($config): "

  # Run the fuzz target on this single input
  result=$(timeout "$TIMEOUT" cargo +nightly fuzz run compile "$artifact" \
    --fuzz-dir fuzz --target "$TARGET" -- -runs=1 2>&1 | tail -1 || true)

  if echo "$result" | grep -q "BINGO\|timeout\|SUMMARY\|Error\|exited"; then
    echo "FAIL (timeout or crash)"
    fail=$((fail + 1))
    # Save the artifact
    cp "$artifact" "repro-fail-$(basename "$artifact")" 2>/dev/null || true
  else
    elapsed=$(echo "$result" | grep -oP 'in \K[0-9]+ ms' || echo "?")
    echo "ok ($elapsed)"
    pass=$((pass + 1))
  fi
  rm -f "$artifact"
done

echo ""
echo "Results: $pass passed, $fail failed (timeouts/crashes)"
