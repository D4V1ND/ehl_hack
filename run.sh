#!/usr/bin/env sh
# Thin wrapper. The real entry point is run.py, which works on Windows, macOS
# and Linux -- bash is absent on Windows and stuck at 3.2 on macOS.
exec python3 "$(dirname "$0")/run.py" "$@"
