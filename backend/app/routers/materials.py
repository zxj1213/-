"""Read-only document extraction for the browser's knowledge library."""
from pathlib import PurePath

from fastapi import APIRouter, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.services import materials


router = APIRouter(prefix="/api/materials", tags=["materials"])


@router.post("/extract")
async def extract(file: UploadFile = File(...)):
    extension = PurePath(file.filename or "").suffix.lower()
    if extension not in materials.FORMATS:
        raise HTTPException(415, "支持 PDF、PPTX、DOCX、TXT 和 Markdown。")
    data = await file.read(materials.MAX_FILE_SIZE + 1)
    if len(data) > materials.MAX_FILE_SIZE:
        raise HTTPException(413, "单个文件最大 10 MiB。")
    try:
        return await run_in_threadpool(materials.extract, data, extension)
    except materials.InvalidMaterial as exc:
        raise HTTPException(422, str(exc)) from exc
    except materials.ScanUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
