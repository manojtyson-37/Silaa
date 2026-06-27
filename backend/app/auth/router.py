import hmac

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.auth.deps import ADMIN_PASSWORD, ADMIN_USERNAME
from app.auth.security import create_token

router = APIRouter(tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/auth/login", response_model=LoginOut)
def login(payload: LoginIn):
    user_ok = hmac.compare_digest(payload.username, ADMIN_USERNAME)
    pass_ok = hmac.compare_digest(payload.password, ADMIN_PASSWORD)
    if not (user_ok and pass_ok):
        raise HTTPException(401, "Invalid credentials")
    return LoginOut(access_token=create_token(payload.username))
