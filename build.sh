#!/bin/sh
npm run build
rm -rf pub/
mkdir pub
cp -R index.html corrects words out css ts pub/
