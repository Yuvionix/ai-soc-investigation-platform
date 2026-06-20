"""
Encryption utilities for sensitive data.

SECURITY FIX:
  - Replaced fixed salt b'soc_dashboard_salt' with a randomly generated,
    per-deployment salt stored in the data directory.
  - A fixed salt means the same password always produces the same encryption key,
    making the key derivation trivially predictable if the password leaks.
  - Now: salt is generated on first use and persisted to data/encryption_salt.bin.
    All subsequent startups use the same salt, so previously encrypted data
    remains decryptable, while each fresh deployment gets a unique salt.
"""
import os
import base64
from pathlib import Path
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from app.config import settings

_SALT_FILE = Path("./data/encryption_salt.bin")


def _load_or_create_salt() -> bytes:
    """Load persisted salt or generate a new random one on first run."""
    _SALT_FILE.parent.mkdir(parents=True, exist_ok=True)
    if _SALT_FILE.exists():
        return _SALT_FILE.read_bytes()
    salt = os.urandom(32)   # 256-bit random salt
    _SALT_FILE.write_bytes(salt)
    return salt


class EncryptionManager:
    """Manager for data encryption/decryption."""

    def __init__(self):
        salt = _load_or_create_salt()
        self.key    = self._derive_key(settings.ENCRYPTION_KEY, salt)
        self.cipher = Fernet(self.key)

    def _derive_key(self, password: str, salt: bytes) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480_000,   # OWASP 2023 recommendation (was 100_000)
            backend=default_backend(),
        )
        return base64.urlsafe_b64encode(kdf.derive(password.encode()))

    def encrypt(self, data: str) -> str:
        if not settings.ENABLE_ENCRYPTION:
            return data
        return base64.urlsafe_b64encode(
            self.cipher.encrypt(data.encode())
        ).decode()

    def decrypt(self, encrypted_data: str) -> str:
        if not settings.ENABLE_ENCRYPTION:
            return encrypted_data
        decoded = base64.urlsafe_b64decode(encrypted_data.encode())
        return self.cipher.decrypt(decoded).decode()


encryption_manager = EncryptionManager()
