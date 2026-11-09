"""One account identity with an immutable contact and a versioned profile."""
import base64
from io import BytesIO
import re

from PIL import Image, ImageOps
from sqlalchemy import ForeignKey, LargeBinary, String, select
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.services.auth import Account, digest


class Binding(Base):
    __tablename__ = "account_bindings"
    account_id: Mapped[str] = mapped_column(ForeignKey(Account.id), primary_key=True)
    identifier: Mapped[str] = mapped_column(String(254), unique=True)
    kind: Mapped[str] = mapped_column(String(8))


class Profile(Base):
    __tablename__ = "account_profiles"
    account_id: Mapped[str] = mapped_column(ForeignKey(Account.id), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(40))
    school: Mapped[str] = mapped_column(String(100), default="")
    major: Mapped[str] = mapped_column(String(100), default="")
    grade: Mapped[str] = mapped_column(String(8), default="")
    avatar: Mapped[bytes | None] = mapped_column(LargeBinary(65535))
    version: Mapped[int] = mapped_column(default=1)


def normalize_identifier(value: str) -> tuple[str, str] | None:
    value = value.strip()
    if "@" in value:
        local, _, domain = value.rpartition("@")
        if (len(value) <= 254 and 1 <= len(local) <= 64 and
                re.fullmatch(r"[a-zA-Z0-9!#$%&'*+/=?^_{}|~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_{}|~-]+)*", local) and
                re.fullmatch(r"(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}", domain)):
            return value.lower(), "email"
        return None
    phone = re.sub(r"[ ()-]", "", value)
    if re.fullmatch(r"1[3-9][0-9]{9}", phone):
        phone = "+86" + phone
    if re.fullmatch(r"\+[1-9][0-9]{7,14}", phone):
        return phone, "phone"
    return None


def legacy_owner(db, typed: str, canonical: str) -> str | None:
    aliases = {typed.strip(), canonical}
    if canonical.startswith("+86") and len(canonical) == 14:
        aliases.add(canonical[3:])
    return db.scalar(select(Account.id).outerjoin(Binding).where(
        Account.name_key.in_({digest(alias) for alias in aliases}), Binding.account_id.is_(None)
    ))


def profile_payload(account: Account, binding: Binding | None, profile: Profile | None) -> dict:
    avatar = profile.avatar if profile else None
    return {
        "account_id": account.id,
        "identifier": binding.identifier if binding else None,
        "binding_kind": binding.kind if binding else None,
        "display_name": profile.display_name if profile else account.username[:40],
        "school": profile.school if profile else "",
        "major": profile.major if profile else "",
        "grade": profile.grade if profile else "",
        "avatar": "data:image/jpeg;base64," + base64.b64encode(avatar).decode("ascii") if avatar else "",
        "version": profile.version if profile else 0,
    }


MAX_AVATAR_BYTES = 5 * 1024 * 1024
AVATAR_TYPES = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def encode_avatar(data: bytes, mime_type: str) -> bytes:
    try:
        with Image.open(BytesIO(data)) as image:
            if image.format != AVATAR_TYPES[mime_type] or image.width * image.height > 12_000_000:
                raise ValueError("Unsupported avatar image")
            photo = ImageOps.fit(ImageOps.exif_transpose(image).convert("RGB"), (256, 256), Image.Resampling.LANCZOS)
            output = BytesIO()
            photo.save(output, format="JPEG", quality=82, optimize=True)
            return output.getvalue()
    except (OSError, Image.DecompressionBombError) as exc:
        raise ValueError("Invalid avatar image") from exc
