#!/bin/sh
rg "$1" corrects-soon corrects-later >/dev/null && echo yes || echo no
