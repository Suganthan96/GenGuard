#!/bin/sh
# Run two-node test for axl

cd /mnt/host/c/Users/Sugan/projects/open/axl

echo "=== Node A Public Key ==="
NODE_A_KEY=$(curl -s http://127.0.0.1:9002/topology 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['our_public_key'])" 2>/dev/null || echo "waiting")
echo "Node A: $NODE_A_KEY"

echo ""
echo "=== Node B Public Key ==="
NODE_B_KEY=$(curl -s http://127.0.0.1:9012/topology 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['our_public_key'])" 2>/dev/null || echo "waiting")
echo "Node B: $NODE_B_KEY"

if [ "$NODE_A_KEY" != "waiting" ] && [ "$NODE_B_KEY" != "waiting" ]; then
  echo ""
  echo "=== Sending message from Node B to Node A ==="
  curl -X POST http://127.0.0.1:9012/send \
    -H "X-Destination-Peer-Id: $NODE_A_KEY" \
    -d "hello from node B" 2>/dev/null
  
  echo ""
  echo ""
  echo "=== Waiting for response on Node A ==="
  sleep 1
  curl -v http://127.0.0.1:9002/recv 2>&1 | grep -E "hello|X-From-Peer-Id"
fi
