import os
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.security import InvalidTokenError, verify_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> dict:
    if creds is None:
        raise HTTPException(401, "Not authenticated")
    try:
        return verify_token(creds.credentials)
    except InvalidTokenError as exc:
        raise HTTPException(401, str(exc))


ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")

class RequireRole:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: dict = Depends(get_current_user)):
        if user.get("role") not in self.allowed_roles:
            raise HTTPException(403, "Not enough permissions")
        return user
