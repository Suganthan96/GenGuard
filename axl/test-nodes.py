#!/usr/bin/env python3
"""
Verify local AXL mesh. Run this from the same environment where the nodes listen
for HTTP (recommended: WSL, same shell as `./node`, so 127.0.0.1 matches):

  wsl sh -c "cd /mnt/c/Users/you/projects/open/axl && python3 test-nodes.py"

Or from PowerShell in axl/: .\\run-mesh-test.ps1
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

PORTS = {
    "Node A (hub)": 9002,
    "Node B": 9012,
    "Node C": 9022,
}


def fetch_topology(port: int, timeout: float = 5.0):
    url = f"http://127.0.0.1:{port}/topology"
    response = urllib.request.urlopen(url, timeout=timeout)
    return json.loads(response.read())


def count_up_peers(data: dict) -> int:
    peers = data.get("peers") or []
    return sum(1 for p in peers if p.get("up"))


def print_node(name: str, port: int):
    print(f"=== {name} (HTTP {port}) ===")
    try:
        data = fetch_topology(port)
        print(f"Public Key: {data.get('our_public_key', 'N/A')}")
        print(f"IPv6: {data.get('our_ipv6', 'N/A')}")
        up = count_up_peers(data)
        total = len(data.get("peers") or [])
        print(f"Peers (up / total): {up} / {total}")
        for p in data.get("peers") or []:
            st = "up" if p.get("up") else "down"
            pk = (p.get("public_key") or "")[:16]
            print(f"  - {st} inbound={p.get('inbound')} uri={p.get('uri')} key={pk}...")
        return data
    except Exception as e:
        print(f"Error: {e}")
        return None


def post_send(port: int, dest_key: str, body: bytes, timeout: float = 10.0) -> int:
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/send",
        data=body,
        headers={"X-Destination-Peer-Id": dest_key},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.status


def try_recv(port: int, timeout: float = 3.0):
    try:
        response = urllib.request.urlopen(
            f"http://127.0.0.1:{port}/recv", timeout=timeout
        )
        data = response.read()
        if data:
            return response.status, data.decode("utf-8", errors="replace"), dict(
                response.headers
            )
        return response.status, None, dict(response.headers)
    except urllib.error.HTTPError as e:
        if e.code == 204:
            return 204, None, {}
        raise


def recv_until_substring(
    port: int, needle: str, attempts: int = 15, delay_sec: float = 0.2
):
    """Poll /recv until body contains needle or attempts exhausted."""
    last = (None, None)
    for _ in range(attempts):
        status, payload, hdrs = try_recv(port, timeout=3.0)
        last = (status, payload)
        if payload and needle in payload:
            return status, payload, hdrs
        time.sleep(delay_sec)
    return last[0], last[1], {}


def main() -> int:
    print("AXL local mesh check (3 nodes)\n")

    node_a = print_node("Node A (hub)", PORTS["Node A (hub)"])
    print()
    node_b = print_node("Node B", PORTS["Node B"])
    print()
    node_c = print_node("Node C", PORTS["Node C"])

    if not node_a or not node_b or not node_c:
        print("\nFAIL: Start hub first, then B, then C (see README / start-guardian-*.ps1).")
        return 1

    key_a = node_a.get("our_public_key")
    key_b = node_b.get("our_public_key")
    key_c = node_c.get("our_public_key")
    if not key_a or not key_b or not key_c:
        print("\nFAIL: Missing public key(s) in topology.")
        return 1

    up_a = count_up_peers(node_a)
    up_b = count_up_peers(node_b)
    up_c = count_up_peers(node_c)

    print("\n=== Mesh expectations (hub + two spokes) ===")
    ok = True
    if up_a >= 2:
        print(f"PASS: Hub has >= 2 up peers ({up_a}).")
    else:
        print(f"FAIL: Hub should have >= 2 up peers (got {up_a}). Wait a few seconds after starting C.")
        ok = False

    if up_b >= 1:
        print(f"PASS: Node B has >= 1 up peer ({up_b}).")
    else:
        print(f"FAIL: Node B should peer to hub (got {up_b} up).")
        ok = False

    if up_c >= 1:
        print(f"PASS: Node C has >= 1 up peer ({up_c}).")
    else:
        print(f"FAIL: Node C should peer to hub (got {up_c} up).")
        ok = False

    print("\n=== Send B -> A ===")
    try:
        st = post_send(9012, key_a, b"hello from node B")
        print(f"Send status: {st}")
    except Exception as e:
        print(f"Error: {e}")
        ok = False

    try:
        status, payload, _hdrs = recv_until_substring(9002, "hello from node B")
        if payload and "hello from node B" in payload:
            print(f"PASS: Hub recv: {payload!r}")
        else:
            print(f"FAIL: Hub recv status={status} body={payload!r}")
            ok = False
    except Exception as e:
        print(f"Recv error: {e}")
        ok = False

    print("\n=== Send C -> A ===")
    try:
        st = post_send(9022, key_a, b"hello from node C")
        print(f"Send status: {st}")
    except Exception as e:
        print(f"Error: {e}")
        ok = False

    try:
        status, payload, _hdrs = recv_until_substring(9002, "hello from node C")
        if payload and "hello from node C" in payload:
            print(f"PASS: Hub recv: {payload!r}")
        else:
            print(f"FAIL: Hub recv status={status} body={payload!r}")
            ok = False
    except Exception as e:
        print(f"Recv error: {e}")
        ok = False

    print("\n=== Send C -> B (spoke-to-spoke via mesh, optional) ===")
    try:
        st = post_send(9022, key_b, b"hello from C to B")
        print(f"Send status: {st}")
        try:
            status, payload, _hdrs = try_recv(9012)
            if payload and "hello from C to B" in payload:
                print(f"PASS: Node B recv: {payload!r}")
            else:
                print(f"INFO: Node B recv status={status} body={payload!r}")
        except Exception as e:
            print(f"Recv on B: {e}")
    except Exception as e:
        print(f"INFO: Spoke-to-spoke not available or routing differs: {e}")

    print("\n=== Guardian public keys (save for intent client) ===")
    print(f"Guardian 1 (hub API {PORTS['Node A (hub)']}): {key_a}")
    print(f"Guardian 2 (API {PORTS['Node B']}): {key_b}")
    print(f"Guardian 3 (API {PORTS['Node C']}): {key_c}")

    if ok:
        print("\nOK: 3-node AXL mesh looks healthy for hub + spokes.")
        return 0
    print("\nDONE with failures: fix peering order (A first, then B, then C) and retry.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
