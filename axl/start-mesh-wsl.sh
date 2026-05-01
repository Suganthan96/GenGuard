#!/bin/sh
# Start 3-node hub mesh (run inside WSL). Config PEM paths are relative to cwd.
AXL="$(cd "$(dirname "$0")" && pwd)"
cd "$AXL" || exit 1

for p in 9001 9002 9012 9022; do
  fuser -k "${p}/tcp" 2>/dev/null || true
done
sleep 1
pkill -f "$AXL/node -config" 2>/dev/null || true
sleep 1
: >/tmp/axl-hub.log
: >/tmp/axl-b.log
: >/tmp/axl-c.log

nohup ./node -config node-config.json </dev/null >>/tmp/axl-hub.log 2>&1 &
sleep 5
nohup ./node -config node-config-2.json </dev/null >>/tmp/axl-b.log 2>&1 &
sleep 4
nohup ./node -config node-config-3.json </dev/null >>/tmp/axl-c.log 2>&1 &
sleep 8
echo "=== PIDs ==="
pgrep -af "./node -config" || true
echo "=== Hub log (tail) ==="
tail -14 /tmp/axl-hub.log
echo "=== B log (tail) ==="
tail -14 /tmp/axl-b.log
echo "=== C log (tail) ==="
tail -14 /tmp/axl-c.log
