#!/bin/sh
# Stop local 3-node mesh (WSL).
AXL="$(cd "$(dirname "$0")" && pwd)"
pkill -f "$AXL/node -config" 2>/dev/null || true
for p in 9001 9002 9012 9022; do
  fuser -k "${p}/tcp" 2>/dev/null || true
done
echo "Stopped AXL mesh (if it was running)."
