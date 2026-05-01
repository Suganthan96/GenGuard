#!/usr/bin/env python3
import urllib.request
import json
import time

topology = json.loads(urllib.request.urlopen('http://127.0.0.1:9002/topology', timeout=5).read())
node_a_key = topology.get("our_public_key", "")

if not node_a_key:
    print("✗ Could not fetch Node A public key from topology")
    raise SystemExit(1)

print("=== Sending message with 30-second timeout ===")
try:
    req = urllib.request.Request(
        'http://127.0.0.1:9012/send',
        data=b'hello from node B',
        headers={'X-Destination-Peer-Id': node_a_key}
    )
    response = urllib.request.urlopen(req, timeout=30)
    print(f"✓ Send succeeded! Status: {response.status}")
    print(f"Headers: {dict(response.headers)}")
except urllib.error.URLError as e:
    print(f"✗ Send failed: {e}")
except Exception as e:
    print(f"✗ Error: {e}")

print("\nWaiting 3 seconds...")
time.sleep(3)

print("\n=== Receiving message ===")
try:
    req = urllib.request.Request('http://127.0.0.1:9002/recv')
    response = urllib.request.urlopen(req, timeout=5)
    print(f"✓ Recv response: {response.status}")
    body = response.read()
    if body:
        print(f"✓ Message received: {body}")
        print(f"Sender: {response.headers.get('X-From-Peer-Id', 'unknown')}")
    else:
        print("✗ Empty response body")
except urllib.error.HTTPError as e:
    if e.code == 204:
        print("✗ No messages waiting (204 No Content)")
    else:
        print(f"✗ HTTP Error {e.code}")
except Exception as e:
    print(f"✗ Error: {e}")
