"""Extract searchable text with the original document positions."""
from contextlib import closing
from io import BytesIO
import posixpath
from threading import Lock
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile

import pypdfium2 as pdfium

from app.services import paddle_ocr


FORMATS = {".pdf": "PDF", ".pptx": "PPT", ".docx": "Word", ".txt": "笔记", ".md": "笔记"}
MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_TEXT = 300_000
MAX_SOURCE_UNITS = 2000
MAX_PDF_PAGES = 200
MAX_SCAN_PAGES = 15
MAX_XML_BYTES = 30 * 1024 * 1024

_pdf_lock = Lock()
_word = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
_slide = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
_draw = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
_rel_id = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


class InvalidMaterial(ValueError):
    pass


class ScanUnavailable(RuntimeError):
    pass


def _pdf_pages(data):
    scanned = 0
    # PDFium cannot run concurrently on different threads, even for different files.
    with _pdf_lock, closing(pdfium.PdfDocument(data)) as document:
        if len(document) > MAX_PDF_PAGES:
            raise InvalidMaterial(f"PDF 最多支持 {MAX_PDF_PAGES} 页，请拆分后上传。")
        for number, page in enumerate(document, 1):
            with closing(page), closing(page.get_textpage()) as textpage:
                text = textpage.get_text_bounded().strip()
                if not text:
                    scanned += 1
                    if scanned > MAX_SCAN_PAGES:
                        raise InvalidMaterial(f"单份 PDF 最多识别 {MAX_SCAN_PAGES} 张无文字层的页面，请拆分后上传。")
                    width, height = page.get_size()
                    if min(width, height) <= 0:
                        raise InvalidMaterial("PDF 页面尺寸无效。")
                    scale = min(2.5, 2400 / max(width, height))
                    with closing(page.render(scale=scale)) as bitmap:
                        image = BytesIO()
                        bitmap.to_pil().save(image, format="PNG")
                    try:
                        text = paddle_ocr.recognize_text(image.getvalue(), "image/png")
                    except Exception as exc:
                        raise ScanUnavailable("扫描页识别暂不可用，请确认后端已安装 PaddleOCR 和模型。") from exc
                yield "page", number, text


def _office_sections(data, extension):
    with ZipFile(BytesIO(data)) as archive:
        entries = archive.infolist()
        xml_size = sum(entry.file_size for entry in entries if entry.filename.endswith((".xml", ".rels")))
        if len(entries) > MAX_SOURCE_UNITS or xml_size > MAX_XML_BYTES:
            raise InvalidMaterial("Office 文件结构过大，请拆分后上传。")

        def xml(path):
            entry = archive.getinfo(path)
            if entry.file_size > MAX_XML_BYTES or entry.flag_bits & 1:
                raise InvalidMaterial("Office 文件内容过大或已加密。")
            raw = archive.read(entry)
            # Office XML parts have no need for custom entities or document types.
            if b"<!DOCTYPE" in raw.replace(b"\0", b""):
                raise InvalidMaterial("Office 文件包含不支持的 XML 声明。")
            return ElementTree.fromstring(raw)

        if extension == ".docx":
            root = xml("word/document.xml")
            word = _word if root.tag == _word + "document" else "{http://purl.oclc.org/ooxml/wordprocessingml/main}"
            if root.tag != word + "document":
                raise InvalidMaterial("无法读取 Word 正文。")
            for number, paragraph in enumerate(root.iter(word + "p"), 1):
                yield "paragraph", number, "".join(node.text or "" for node in paragraph.iter(word + "t"))
            return

        presentation = xml("ppt/presentation.xml")
        slide_ns, draw_ns, relation_id = _slide, _draw, _rel_id
        if presentation.tag == "{http://purl.oclc.org/ooxml/presentationml/main}presentation":
            slide_ns = "{http://purl.oclc.org/ooxml/presentationml/main}"
            draw_ns = "{http://purl.oclc.org/ooxml/drawingml/main}"
            relation_id = "{http://purl.oclc.org/ooxml/officeDocument/relationships}id"
        relationships = xml("ppt/_rels/presentation.xml.rels")
        targets = {
            item.get("Id"): item.get("Target", "")
            for item in relationships
            if item.get("Type", "").endswith("/slide") and item.get("TargetMode") != "External"
        }
        for number, slide in enumerate(presentation.iter(slide_ns + "sldId"), 1):
            target = targets.get(slide.get(relation_id), "")
            path = posixpath.normpath(target.lstrip("/") if target.startswith("/") else f"ppt/{target}")
            if not target or not path.startswith("ppt/") or not path.endswith(".xml"):
                raise InvalidMaterial("幻灯片缺少有效的页面来源。")
            root = xml(path)
            lines = ("".join(node.text or "" for node in p.iter(draw_ns + "t")) for p in root.iter(draw_ns + "p"))
            yield "slide", number, "\n".join(line for line in lines if line.strip())


def _text_sections(data):
    encodings = ("utf-16",) if data.startswith((b"\xff\xfe", b"\xfe\xff")) else ("utf-8-sig", "gb18030")
    for encoding in encodings:
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise InvalidMaterial("文本编码无法识别，请保存为 UTF-8 后重试。")
    if "\0" in text:
        raise InvalidMaterial("文件不是可读的纯文本。")
    return (("paragraph", i, paragraph) for i, paragraph in enumerate(text.replace("\r\n", "\n").split("\n"), 1))


def extract(data: bytes, extension: str) -> dict:
    chunks = []
    size = 0
    try:
        if extension == ".pdf":
            sections = _pdf_pages(data)
        elif extension in {".docx", ".pptx"}:
            sections = _office_sections(data, extension)
        else:
            sections = _text_sections(data)
        with closing(sections):
            for kind, position, raw in sections:
                text = raw.strip()
                size += len(text)
                if size > MAX_TEXT or position > MAX_SOURCE_UNITS:
                    raise InvalidMaterial("资料正文超过检索容量，请拆分后上传。")
                if text:
                    chunks.append({"kind": kind, "position": position, "text": text})
    except (BadZipFile, ElementTree.ParseError, KeyError, OSError, pdfium.PdfiumError, NotImplementedError) as exc:
        raise InvalidMaterial("无法读取文件。请确认格式正确，PDF 未加密，且文件未损坏。") from exc
    if not chunks:
        raise InvalidMaterial("没有提取到可检索的文字。")
    return {"type": FORMATS[extension], "chunks": chunks}
