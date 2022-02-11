#!/bin/sh
npm run build
rm -rf pub/
mkdir pub
cp -R index.html corrects words assets out css ts pub/
sed -i s/@COMMIT_ID@/$(git rev-parse --short HEAD)/ pub/out/main.js pub/ts/main.ts
