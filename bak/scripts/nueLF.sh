#!/usr/bin/env sh

# NueJS LightningCSS Fix

cp node_modules/nuekit/src/builder.js bak/nuekit/src/builder.js
cp mod/nuekit/src/builder.js node_modules/nuekit/src/builder.js
