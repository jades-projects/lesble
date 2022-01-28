#!/bin/sh
npm run build
mkdir pub
cp -R index.html out css ts pub/
