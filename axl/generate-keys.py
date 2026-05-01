#!/usr/bin/env python3
"""Generate ed25519 private keys in PEM format"""

from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

# Generate first key
private_key_1 = ed25519.Ed25519PrivateKey.generate()
pem_1 = private_key_1.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)

# Generate second key
private_key_2 = ed25519.Ed25519PrivateKey.generate()
pem_2 = private_key_2.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)

# Write to files
with open('private.pem', 'wb') as f:
    f.write(pem_1)
print("Generated private.pem")

with open('private-2.pem', 'wb') as f:
    f.write(pem_2)
print("Generated private-2.pem")

private_key_3 = ed25519.Ed25519PrivateKey.generate()
pem_3 = private_key_3.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)
with open('private-3.pem', 'wb') as f:
    f.write(pem_3)
print("Generated private-3.pem")

print("Done! Keys generated successfully.")
