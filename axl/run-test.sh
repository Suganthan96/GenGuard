#!/bin/sh

# Get Node A public key
echo "Fetching Node A public key..."
NODE_A_KEY=$(curl -s http://127.0.0.1:9002/topology | grep -o '"our_public_key":"[^"]*' | cut -d'"' -f4)
echo "Node A Public Key: $NODE_A_KEY"

echo ""

# Get Node B public key
echo "Fetching Node B public key..."
NODE_B_KEY=$(curl -s http://127.0.0.1:9012/topology | grep -o '"our_public_key":"[^"]*' | cut -d'"' -f4)
echo "Node B Public Key: $NODE_B_KEY"

echo ""
echo "=== Sending message from Node B to Node A ==="
curl -X POST http://127.0.0.1:9012/send \
  -H "X-Destination-Peer-Id: $NODE_A_KEY" \
  -d "hello from node B"

echo ""
echo "=== Waiting 2 seconds for message to propagate ==="
sleep 2

echo ""
echo "=== Receiving message on Node A ==="
curl -v http://127.0.0.1:9002/recv 2>&1

echo ""
echo "Test complete!"
