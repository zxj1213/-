"""Local screenshot transcription and conservative task extraction."""
from datetime import datetime
from io import BytesIO
import os
from pathlib import Path
import re
from threading import Lock
import unicodedata


IMAGE_FORMATS = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}
MAX_IMAGE_PIXELS = 20_000_000

TASK_HEADING = re.compile(
    r"^(?:任务(?:名称|标题|\s*[一二三四五六七八九十\d]+)?|作业(?:名称|标题)?)\s*[:：]\s*(.*)$"
)
TASK_INLINE = re.compile(r"^([^:：]{1,60}(?:作业|任务|练习|实验报告))\s*[:：]\s*(.*)$")
CONTENT_FIELD = re.compile(r"^(?:任务内容|作业内容|内容|要求|任务要求)\s*[:：]\s*(.*)$")
DEADLINE_FIELD = re.compile(r"^(?:任务截止时间|截止(?:时间|日期)?|提交(?:时间|日期))\s*[:：]?\s*(.*)$")
ABSOLUTE_DEADLINE = re.compile(
    r"(?<!\d)(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})日?"
    r"(?:日[\sT,，]*|[\sT,，]+)(\d{1,2})\s*[:点时]\s*(\d{2})(?:分)?(?!\d)"
)

_engine_lock = Lock()
_engine = None
_DETECTION_MODEL = "PP-OCRv5_mobile_det"
_RECOGNITION_MODEL = "PP-OCRv5_mobile_rec"


class InvalidImage(ValueError):
    pass


def _cached_model_dirs():
    root = Path(os.environ.get("PADDLE_PDX_CACHE_HOME") or Path.home() / ".paddlex") / "official_models"
    directories = [root / _DETECTION_MODEL, root / _RECOGNITION_MODEL]
    files = ("inference.json", "inference.pdiparams", "inference.yml")
    return directories if all((directory / file).is_file() for directory in directories for file in files) else []


def _get_engine():
    # The caller holds the lock because Paddle predictors share mutable buffers.
    global _engine
    if _engine is None:
        cached = _cached_model_dirs()
        options = {}
        if cached:
            os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
            options = {"text_detection_model_dir": str(cached[0]), "text_recognition_model_dir": str(cached[1])}
        from paddleocr import PaddleOCR

        _engine = PaddleOCR(
            device="cpu",
            text_detection_model_name=_DETECTION_MODEL,
            text_recognition_model_name=_RECOGNITION_MODEL,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            enable_mkldnn=False,
            cpu_threads=4,
            **options,
        )
    return _engine


def warm_up():
    with _engine_lock:
        _get_engine()


def _read_image(data: bytes, mime_type: str):
    import numpy as np
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        with Image.open(BytesIO(data)) as image:
            if image.format != IMAGE_FORMATS[mime_type] or image.width * image.height > MAX_IMAGE_PIXELS:
                raise InvalidImage("Invalid format or image dimensions")
            rgb = ImageOps.exif_transpose(image).convert("RGB")
            return np.asarray(rgb)[:, :, ::-1].copy()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidImage("Unable to decode image") from exc


def _deadline(text: str) -> str:
    matches = list(ABSOLUTE_DEADLINE.finditer(unicodedata.normalize("NFKC", text)))
    if len(matches) != 1 or re.search(r"上午|下午|早上|中午|晚上|凌晨|\b[ap]m\b", text, re.I):
        return ""
    try:
        return datetime(*map(int, matches[0].groups())).strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return ""


def extract_tasks(text: str) -> list[dict]:
    drafts = []
    task = None
    deadline_lines = []
    field = "contents"
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        heading = TASK_HEADING.match(line)
        inline = TASK_INLINE.match(line) if not heading else None
        if heading or inline:
            task = {
                "title": heading[1] if heading else inline[1],
                "deadline": "",
                "contents": [inline[2]] if inline and inline[2] else [],
            }
            deadline_lines = []
            drafts.append((task, deadline_lines))
            field = "title" if not task["title"] else "contents"
        elif task is not None:
            deadline = DEADLINE_FIELD.match(line)
            content = CONTENT_FIELD.match(line)
            if deadline:
                deadline_lines.append(deadline[1])
                field = "contents" if deadline[1] else "deadline"
            elif content:
                if content[1]:
                    task["contents"].append(content[1])
                field = "contents"
            elif field == "deadline":
                deadline_lines.append(line)
                field = "contents"
            elif field == "title":
                task["title"] = line
                field = "contents"
            else:
                task["contents"].append(line)

    tasks = []
    for draft, dates in drafts:
        contents = draft["contents"]
        deadline_context = dates or [line for line in contents if re.search(r"截止|提交|前", line)]
        draft["deadline"] = _deadline(" ".join(deadline_context))
        if len(contents) > 10:
            draft["contents"] = contents[:9] + ["\n".join(contents[9:])]
        if draft["title"] or contents:
            tasks.append(draft)
    return tasks


def recognize_text(data: bytes, mime_type: str) -> str:
    image = _read_image(data, mime_type)
    with _engine_lock:
        results = _get_engine().predict(image)
    lines = [line.strip() for result in results for line in result["rec_texts"] if line.strip()]
    return "\n".join(lines)


def recognize(data: bytes, mime_type: str) -> dict:
    text = recognize_text(data, mime_type)
    return {"recognizedText": text, "tasks": extract_tasks(text), "engine": "paddleocr"}


def recognize_timetable(data: bytes, mime_type: str) -> list[dict]:
    image = _read_image(data, mime_type)
    if not _cached_model_dirs():
        raise RuntimeError("Local OCR models are missing")
    with _engine_lock:
        blocks = []
        for result in _get_engine().predict(image):
            for text, box in zip(result["rec_texts"], result["rec_boxes"]):
                if text.strip():
                    blocks.append({"text": text.strip()[:300], "box": [int(value) for value in box]})
                if len(blocks) >= 800:
                    raise InvalidImage("Too many text regions; crop the timetable and retry")
        return blocks
