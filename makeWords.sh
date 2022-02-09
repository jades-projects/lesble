#!/bin/sh
# sick of getting spoiled
cat corrects-soon corrects-later > corrects

cat /usr/share/dict/british-english words-raw corrects adds | grep -E '^[A-Za-z]+$' | tr A-Z a-z | sort -u > words
