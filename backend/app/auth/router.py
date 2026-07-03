import hmac

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db import get_db
from app.auth.models import User
from app.auth.security import create_token, verify_password

router = APIRouter(tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/auth/login", response_model=LoginOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not user.is_active:
        raise HTTPException(401, "Invalid credentials")
    
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
        
    return LoginOut(access_token=create_token(user.username, user.role))
