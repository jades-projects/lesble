#!/bin/sh
cat words-raw corrects | grep -E '^[A-Za-z]+$' | tr A-Z a-z | sort -u > words
