#!/usr/bin/env python3
import socket
import time

def test_port(host, port):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((host, port))
        sock.close()
        if result == 0:
            print(f"✓ Port {port} is open")
            return True
        else:
            print(f"✗ Port {port} is closed or filtered")
            return False
    except Exception as e:
        print(f"✗ Port {port}: {e}")
        return False

print("Testing TCP port connectivity:")
test_port('127.0.0.1', 7000)  # Node A
test_port('127.0.0.1', 7001)  # Node B

print("\nTesting HTTP API connectivity:")
test_port('127.0.0.1', 9002)  # Node A API
test_port('127.0.0.1', 9012)  # Node B API

print("\n=== Attempting direct peer communication ===")
import urllib.request
import struct

node_a_key = "62bcea25e0a75e2270994863d9de707f48167b9af4cf3881c02eea81bd157602"

# Try to send a message from Node B using the /send endpoint
print(f"\nSending message from Node B to Node A ({node_a_key})...")
try:
    req = urllib.request.Request(
        'http://127.0.0.1:9012/send',
        data=b'test message',
        headers={'X-Destination-Peer-Id': node_a_key}
    )
    response = urllib.request.urlopen(req, timeout=5)
    print(f"Send response: {response.status}")
    print(f"Headers: {dict(response.headers)}")
    body = response.read()
    print(f"Body: {body}")
except urllib.error.URLError as e:
    if hasattr(e, 'code'):
        print(f"HTTP Error {e.code}: {e.reason if hasattr(e, 'reason') else e}")
    else:
        print(f"Connection error: {e}")
except socket.timeout:
    print("Timeout waiting for response")
except Exception as e:
    print(f"Error: {e}")

time.sleep(1)

# Try to receive on Node A
print(f"\nReceiving message on Node A...")
try:
    req = urllib.request.Request('http://127.0.0.1:9002/recv')
    response = urllib.request.urlopen(req, timeout=2)
    print(f"Recv response: {response.status}")
    print(f"Headers: {dict(response.headers)}")
    body = response.read()
    print(f"Body: {body}")
except urllib.error.HTTPError as e:
    if e.code == 204:
        print("No messages waiting (204 No Content)")
    else:
        print(f"HTTP Error {e.code}")
except Exception as e:
    print(f"Error: {e}")
