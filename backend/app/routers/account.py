"""Authenticated account binding and profile endpoints."""
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.auth import PasswordCheck, _checked_account
from app.services import account as identity, auth


router = APIRouter(prefix="/api/account", tags=["account"])
user_methods = {"/api/account/profile": {"GET", "PUT"}, "/api/account/avatar": {"POST"}, "/api/account/bind": {"POST"}}


class ProfileEdit(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    display_name: str = Field(min_length=1, max_length=40)
    school: str = Field(default="", max_length=100)
    major: str = Field(default="", max_length=100)
    grade: Literal["", "大一", "大二", "大三", "大四"] = ""
    version: int = Field(ge=0)


class ContactBinding(PasswordCheck):
    identifier: str = Field(min_length=1, max_length=254)
    profile: ProfileEdit | None = None


def _profile(db, account):
    return identity.profile_payload(account, db.get(identity.Binding, account.id), db.get(identity.Profile, account.id))


def _write(db, account, version, values):
    if version == 0:
        profile = identity.Profile(account_id=account.id, display_name=account.username[:40])
        for key, value in values.items():
            setattr(profile, key, value)
        db.add(profile)
    else:
        changed = db.execute(update(identity.Profile).where(
            identity.Profile.account_id == account.id, identity.Profile.version == version
        ).values(**values, version=version + 1))
        if changed.rowcount != 1:
            raise HTTPException(409, "Profile has changed")
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Profile has changed") from exc
    return _profile(db, account)


@router.get("/profile")
def get_profile(request: Request, version: int | None = None, bound: bool | None = None, db: Session = Depends(get_db)):
    account = db.get(auth.Account, request.state.auth_user_id)
    binding = db.get(identity.Binding, account.id)
    revision = db.query(identity.Profile.version).filter_by(account_id=account.id).scalar() or 0
    if version == revision and bound == bool(binding):
        return Response(status_code=304)
    return identity.profile_payload(account, binding, db.get(identity.Profile, account.id))


@router.put("/profile")
def update_profile(body: ProfileEdit, request: Request, db: Session = Depends(get_db)):
    return _write(db, db.get(auth.Account, request.state.auth_user_id), body.version, body.model_dump(exclude={"version"}))


@router.post("/avatar")
def upload_avatar(request: Request, version: int = Form(ge=0), file: UploadFile = File(...), db: Session = Depends(get_db)):
    if file.content_type not in identity.AVATAR_TYPES:
        raise HTTPException(415, "Only JPEG, PNG and WebP are supported")
    data = file.file.read(identity.MAX_AVATAR_BYTES + 1)
    if len(data) > identity.MAX_AVATAR_BYTES:
        raise HTTPException(413, "Avatar exceeds 5 MiB")
    try:
        avatar = identity.encode_avatar(data, file.content_type)
    except ValueError as exc:
        raise HTTPException(422, "Invalid or oversized avatar image") from exc
    return _write(db, db.get(auth.Account, request.state.auth_user_id), version, {"avatar": avatar})


@router.post("/bind")
def bind_contact(body: ContactBinding, request: Request, db: Session = Depends(get_db)):
    account = _checked_account(request, body.password.get_secret_value(), db)
    if db.get(identity.Binding, account.id):
        raise HTTPException(409, "The login account is immutable")
    contact = identity.normalize_identifier(body.identifier)
    if not contact:
        raise HTTPException(422, "Enter a valid phone number or email")
    identifier, kind = contact
    legacy = identity.legacy_owner(db, body.identifier, identifier)
    if legacy and legacy != account.id:
        raise HTTPException(409, "Identifier in use")
    db.add(identity.Binding(account_id=account.id, identifier=identifier, kind=kind))
    if body.profile and body.profile.version == 0 and not db.get(identity.Profile, account.id):
        db.add(identity.Profile(account_id=account.id, **body.profile.model_dump(exclude={"version"})))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Account already bound or identifier in use") from exc
    return _profile(db, account)
