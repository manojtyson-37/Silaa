import os
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.security import InvalidTokenError, verify_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> str:
    if creds is None:
        raise HTTPException(401, "Not authenticated")
    try:
        return verify_token(creds.credentials)
    except InvalidTokenError as exc:
        raise HTTPException(401, str(exc))


ADMIN_USERNAME = os.environ["ADMIN_USERNAME"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
