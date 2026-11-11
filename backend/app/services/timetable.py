"""Read timetable workbook cells without Excel or a network connection."""
from io import BytesIO
import posixpath
import re
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_ROWS = 500
MAX_COLUMNS = 40
_NS = {
    "s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "p": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def read_workbook(data: bytes) -> list[dict]:
    try:
        with ZipFile(BytesIO(data)) as archive:
            return _read_sheets(archive)
    except (BadZipFile, ET.ParseError, KeyError, UnicodeError, ValueError, RuntimeError, NotImplementedError) as exc:
        raise ValueError("Invalid or unsupported Excel workbook") from exc


def _read_sheets(archive: ZipFile) -> list[dict]:
    remaining = 4 * MAX_UPLOAD_BYTES

    def read_xml(name):
        nonlocal remaining
        size = archive.getinfo(name).file_size
        if size > MAX_UPLOAD_BYTES or size > remaining:
            raise ValueError("Workbook is too large after decompression")
        remaining -= size
        source = archive.read(name).decode("utf-8-sig")
        if "<!DOCTYPE" in source.upper():
            raise ValueError("Workbook XML cannot contain a DTD")
        return ET.fromstring(source)

    workbook = read_xml("xl/workbook.xml")
    relationships = read_xml("xl/_rels/workbook.xml.rels")
    paths = {
        item.get("Id"): posixpath.normpath(posixpath.join("xl", item.get("Target", ""))).lstrip("/")
        for item in relationships.findall("p:Relationship", _NS)
        if item.get("Type", "").endswith("/worksheet") and item.get("TargetMode") != "External"
    }
    shared = []
    if "xl/sharedStrings.xml" in archive.namelist():
        shared = [
            _cell_text(item)
            for item in read_xml("xl/sharedStrings.xml").findall("s:si", _NS)
        ]

    sheets = []
    for sheet in workbook.findall("s:sheets/s:sheet", _NS):
        name = paths.get(sheet.get("{" + _NS["r"] + "}id"), "")
        if not name.startswith("xl/worksheets/"):
            continue
        if len(sheets) >= 8:
            raise ValueError("Workbook contains too many worksheets")
        root = read_xml(name)
        rows = root.findall("s:sheetData/s:row", _NS)
        if len(rows) > MAX_ROWS:
            raise ValueError("Worksheet contains too many rows")
        sheets.append({"name": sheet.get("name", "")[:80], "rows": [_row_values(row, shared) for row in rows]})
    if not sheets:
        raise ValueError("Workbook has no worksheet")
    return sheets


def _cell_text(cell) -> str:
    return "".join(item.text or "" for item in cell.findall(".//s:t", _NS))[:1000]


def _row_values(row, shared: list[str]) -> list[str]:
    values = []
    for cell in row.findall("s:c", _NS):
        ref = re.fullmatch(r"([A-Z]{1,3})[0-9]{1,7}", cell.get("r", ""))
        if ref:
            column = 0
            for letter in ref[1]:
                column = column * 26 + ord(letter) - ord("A") + 1
            index = column - 1
        else:
            index = len(values)
        if index >= MAX_COLUMNS:
            continue
        kind = cell.get("t")
        value = cell.findtext("s:v", "", _NS)
        if kind == "inlineStr":
            value = _cell_text(cell)
        elif kind == "s":
            number = int(value)
            value = shared[number] if 0 <= number < len(shared) else ""
        elif kind == "e":
            value = ""
        values.extend([""] * (index + 1 - len(values)))
        values[index] = value[:1000]
    return values
