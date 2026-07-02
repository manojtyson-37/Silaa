import os
import uuid

import httpx
from fastapi import APIRouter, HTTPException, UploadFile

router = APIRouter(tags=["upload"])

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
BUCKET = "silaa-images"


@router.post("/upload")
async def upload_image(file: UploadFile):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(500, "Image storage not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY missing)")

    ext = (file.filename or "file").rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        raise HTTPException(400, "Only jpg/png/webp/gif allowed")

    key = f"{uuid.uuid4()}.{ext}"
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "File too large — 10 MB max")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{key}",
            content=content,
            headers={
                # apikey is required for Supabase's sb_secret_* keys; without it the
                # storage API tries to parse the Bearer token as a JWT ("Invalid Compact JWS")
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": file.content_type or "application/octet-stream",
            },
        )
    if resp.status_code not in {200, 201}:
        raise HTTPException(500, f"Storage upload failed: {resp.text}")

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{key}"
    return {"url": public_url}
