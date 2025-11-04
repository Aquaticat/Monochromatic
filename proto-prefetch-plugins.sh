#!/usr/bin/env bash
set -euo pipefail

# Proto plugin prefetch script
# This script downloads proto plugins using curl (which respects HTTP_PROXY)
# to work around proto's offline detection failing in proxied environments

PROTO_PLUGINS_DIR="${PROTO_HOME:-$HOME/.proto}/plugins"

# Array of plugins to download: "id:url"
plugins=(
    "bun_tool:https://github.com/moonrepo/plugins/releases/download/bun_tool-v0.16.3/bun_tool.wasm"
    "moon_tool:https://github.com/moonrepo/plugins/releases/download/moon_tool-v0.3.3/moon_tool.wasm"
    "node_tool:https://github.com/moonrepo/plugins/releases/download/node_tool-v0.17.3/node_tool.wasm"
    "node_depman_tool:https://github.com/moonrepo/plugins/releases/download/node_depman_tool-v0.17.0/node_depman_tool.wasm"
    "proto_tool:https://github.com/moonrepo/plugins/releases/download/proto_tool-v0.5.5/proto_tool.wasm"
    "schema_tool:https://github.com/moonrepo/plugins/releases/download/schema_tool-v0.17.7/schema_tool.wasm"
    "python_uv_tool:https://github.com/moonrepo/plugins/releases/download/python_uv_tool-v0.3.1/python_uv_tool.wasm"
)

echo "Prefetching proto plugins..."

for plugin_spec in "${plugins[@]}"; do
    IFS=':' read -r plugin_id plugin_url <<< "$plugin_spec"
    plugin_dir="$PROTO_PLUGINS_DIR/$plugin_id"
    plugin_file="$plugin_dir/$(basename "$plugin_url")"

    if [ -f "$plugin_file" ]; then
        echo "  ✓ $plugin_id already cached"
        continue
    fi

    echo "  → Downloading $plugin_id..."
    mkdir -p "$plugin_dir"
    if curl -fsSL "$plugin_url" -o "$plugin_file"; then
        echo "  ✓ $plugin_id downloaded"
    else
        echo "  ✗ Failed to download $plugin_id"
        exit 1
    fi
done

echo "All plugins prefetched successfully!"
