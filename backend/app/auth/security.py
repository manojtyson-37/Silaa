"""Minimal signed-token auth — single admin user, Phase 1 internal tool.

ponytail: stdlib HMAC token instead of pulling in pyjwt/python-jose for one
claim (sub + exp). Upgrade to a real JWT lib if multi-user roles are needed.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

SECRET_KEY = os.environ.get("AUTH_SECRET_KEY", "fallback_secret_please_change_in_production")
TOKEN_TTL_SECONDS = 60 * 60 * 12  # 12h

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    return f"{salt.hex()}:{pw_hash.hex()}"

def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt_hex, hash_hex = password_hash.split(":")
        salt = bytes.fromhex(salt_hex)
        pw_hash = bytes.fromhex(hash_hex)
        return hmac.compare_digest(
            pw_hash,
            hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
        )
    except Exception:
        return False


class InvalidTokenError(Exception):
    pass


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(payload_b64: str) -> str:
    sig = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).digest()
    return _b64encode(sig)


def create_token(username: str, role: str) -> str:
    payload = {"sub": username, "role": role, "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    payload_b64 = _b64encode(json.dumps(payload).encode())
    return f"{payload_b64}.{_sign(payload_b64)}"


def verify_token(token: str) -> dict:
    """Returns the payload dict if valid, raises InvalidTokenError otherwise."""
    try:
        payload_b64, sig = token.split(".", 1)
    except ValueError:
        raise InvalidTokenError("malformed token")

    if not hmac.compare_digest(_sign(payload_b64), sig):
        raise InvalidTokenError("bad signature")

    payload = json.loads(_b64decode(payload_b64))
    if payload["exp"] < time.time():
        raise InvalidTokenError("token expired")
    return payload
