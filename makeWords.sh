#!/bin/sh
cat /usr/share/dict/british-english corrects | grep -E '^[A-Za-z]+$' | tr A-Z a-z | sort -u > words
