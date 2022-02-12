#!/bin/sh
cat corrects-later corrects-soon | sort | uniq -d
