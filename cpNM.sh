#!/usr/bin/env sh

# Copy node_modules from root of workspace to each workspace packages.

rsync -rRL --delete --exclude='*/**/node_modules/*' --exclude='*/**/@biomejs/*' node_modules/ configs/biome-config/ &
rsync -rRL --delete --exclude='*/**/node_modules/*' --exclude='*/**/@biomejs/*' node_modules/ configs/browserslist-config/ &
rsync -rRL --delete --exclude='*/**/node_modules/*' --exclude='*/**/@biomejs/*' node_modules/ configs/bunfig/ &
rsync -rRL --delete --exclude='*/**/node_modules/*' --exclude='*/**/@biomejs/*' node_modules/ configs/editorconfig/ &
rsync -rRL --delete --exclude='*/**/node_modules/*' --exclude='*/**/@biomejs/*' node_modules/ configs/ignore/ &
rsync -rRL --delete --exclude='*/**/node_modules/*' --exclude='*/**/@biomejs/*' node_modules/ configs/npm-config/ &
rsync -rRL --delete --exclude='*/**/node_modules/*' --exclude='*/**/@biomejs/*' node_modules/ helpers/closest-path/ &
rsync -rRL --delete --exclude='*/**/node_modules/*' --exclude='*/**/@biomejs/*' node_modules/ lightningcss-plugins/apply/ &
rsync -rRL --delete --exclude='*/**/node_modules/*' --exclude='*/**/@biomejs/*' node_modules/ lightningcss-plugins/custom-units/ &
rsync -rRL --delete --exclude='*/**/node_modules/*' --exclude='*/**/@biomejs/*' node_modules/ lightningcss-plugins/property-lookup/ &
rsync -rRL --delete --exclude='*/**/node_modules/*' --exclude='*/**/@biomejs/*' node_modules/ lightningcss-plugins/size/ &
rsync -rRL --delete --exclude='*/**/node_modules/*' --exclude='*/**/@biomejs/*' node_modules/ themes/academia/ &
rsync -rRL --delete --exclude='*/**/node_modules/*' --exclude='*/**/@biomejs/*' node_modules/ themes/subtle/
