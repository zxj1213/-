"""First-party account sign-in and refresh endpoints."""
from collections import Counter
from ipaddress import ip_address
import logging
import secrets
from threading import Lock
from time import monotonic
from typing import Literal
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DbSession

from app.config import settings
from app.database import get_db
from app.services import account as identity, auth


logger = logging.getLogger("uvicorn.error.studyflow.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])
public_paths = {"/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/logout"}
_rate_lock = Lock()
_attempts: Counter = Counter()
_window = 0


class Credentials(BaseModel):
    username: str = Field(min_length=1, max_length=254)
    password: SecretStr = Field(min_length=1, max_length=128)


class Registration(Credentials):
    display_name: str = Field(min_length=1, max_length=40)
    school: str = Field(default="", max_length=100)
    major: str = Field(default="", max_length=100)
    grade: Literal["", "大一", "大二", "大三", "大四"] = ""


class PasswordCheck(BaseModel):
    password: SecretStr = Field(min_length=1, max_length=128)


class PasswordChange(PasswordCheck):
    new_password: SecretStr = Field(min_length=8, max_length=128)


def _origin(request: Request):
    origin = request.headers.get("origin", "")
    source = urlsplit(origin) if origin in settings.CORS_ORIGINS else None
    if (
        not source or source.netloc.lower() != request.headers.get("host", "").lower()
        or request.headers.get("sec-fetch-site", "same-origin") != "same-origin"
        or (source.scheme != "https" and not (source.scheme == "http" and source.hostname in {"localhost", "127.0.0.1", "::1"}))
    ):
        logger.warning("auth_origin_rejected")
        raise HTTPException(403, "Auth requires a trusted same-origin HTTPS site or local loopback")
    return source


def _rate_limit(request: Request, account_key: str):
    global _window
    window = int(monotonic() // 60)
    address = request.client.host if request.client else "unknown"
    with _rate_lock:
        if window != _window:
            _attempts.clear()
            _window = window
        keys = (("client", address), ("account", account_key))
        if any(_attempts[key] >= limit for key, limit in zip(keys, (40, 8))):
            logger.warning("auth_password_rate_limited")
            raise HTTPException(429, "Too many authentication attempts", headers={"Retry-After": "60"})
        _attempts.update(keys)


def _account_header(request: Request) -> str:
    account_id = request.headers.get("x-studyflow-account", "")
    return account_id if len(account_id) == 32 else ""


def _clear_cookie(response: Response):
    response.delete_cookie(auth.COOKIE, path=auth.COOKIE_PATH, secure=True, httponly=True, samesite="strict")


def _tokens(response: Response, account_id: str, tokens):
    access, refresh, access_ttl, refresh_ttl = tokens
    response.set_cookie(auth.COOKIE, refresh, max_age=refresh_ttl, path=auth.COOKIE_PATH,
                        secure=True, httponly=True, samesite="strict")
    return {"access_token": access, "expires_in": access_ttl, "account_id": account_id}


def _signed_in(request: Request, response: Response, db: DbSession, account_id: str):
    previous = request.cookies.get(auth.COOKIE, "")
    if previous and len(previous) <= 128:
        db.execute(update(auth.Session).where(auth.Session.refresh_digest == auth.digest(previous)).values(revoked=True))
    tokens = auth.new_session(db, account_id)
    db.commit()
    logger.info("auth_session_started")
    return _tokens(response, account_id, tokens)


@router.post("/register", status_code=201)
def register(body: Registration, request: Request, response: Response, db: DbSession = Depends(get_db)):
    source = _origin(request)
    if not settings.AUTH_PUBLIC_REGISTRATION:
        address = request.client.host if request.client else ""
        try:
            local = ip_address(address).is_loopback
        except ValueError:
            local = False
        if not local or source.hostname not in {"localhost", "127.0.0.1", "::1"}:
            raise HTTPException(403, "New accounts must be registered locally")
    contact = identity.normalize_identifier(body.username)
    name = body.display_name.strip()
    password = body.password.get_secret_value()
    if not contact or not name or len(password) < 8:
        raise HTTPException(422, "A phone or email, display name and password of at least 8 characters are required")
    identifier, kind = contact
    name_key = auth.digest(identifier)
    _rate_limit(request, name_key)
    if identity.legacy_owner(db, body.username, identifier):
        raise HTTPException(409, "Account already exists")
    account_id = secrets.token_hex(16)
    account = auth.Account(id=account_id, username=name, name_key=auth.digest("account:" + account_id),
                           password_hash=auth.hash_password(password))
    db.add(account)
    try:
        db.flush()
        db.add(identity.Binding(account_id=account_id, identifier=identifier, kind=kind))
        db.add(identity.Profile(account_id=account_id, display_name=name, school=body.school.strip(),
                                major=body.major.strip(), grade=body.grade))
        db.flush()
    except IntegrityError:
        db.rollback()
        logger.warning("auth_register_conflict")
        raise HTTPException(409, "Account already exists")
    return _signed_in(request, response, db, account.id)


@router.post("/login")
def login(body: Credentials, request: Request, response: Response, db: DbSession = Depends(get_db)):
    _origin(request)
    username = body.username.strip()
    contact = identity.normalize_identifier(username)
    _rate_limit(request, auth.digest(contact[0] if contact else username))
    account = db.scalar(select(auth.Account).join(identity.Binding).where(
        identity.Binding.identifier == contact[0]
    )) if contact else None
    if not account:
        account = db.scalar(select(auth.Account).outerjoin(identity.Binding).where(
            auth.Account.name_key == auth.digest(username), identity.Binding.account_id.is_(None)
        ))
    password = body.password.get_secret_value()
    if not (auth.verify_password(password, account.password_hash) if account else auth.verify_password(password)):
        logger.warning("auth_login_failed")
        raise HTTPException(401, "Invalid credentials")
    if account is None:
        raise HTTPException(401, "Invalid credentials")
    # Serialize issuance with password changes for this account.
    changed = db.execute(update(auth.Account).where(
        auth.Account.id == account.id, auth.Account.password_hash == account.password_hash
    ).values(password_hash=account.password_hash))
    if changed.rowcount != 1:
        logger.warning("auth_login_credentials_changed")
        raise HTTPException(401, "Invalid credentials")
    return _signed_in(request, response, db, account.id)


@router.post("/refresh")
def refresh(request: Request, response: Response, db: DbSession = Depends(get_db)):
    _origin(request)
    account_id = _account_header(request)
    tokens, reused = auth.rotate_session(db, request.cookies.get(auth.COOKIE, ""), account_id)
    if not tokens:
        logger.warning("auth_refresh_reuse" if reused else "auth_refresh_failed")
        raise HTTPException(401, "Session expired or account changed")
    return _tokens(response, account_id, tokens)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: DbSession = Depends(get_db)):
    _origin(request)
    account_id = _account_header(request)
    cookie = request.cookies.get(auth.COOKIE, "")
    bearer, _, access = request.headers.get("authorization", "").partition(" ")
    auth.revoke_session(db, cookie, account_id, access if bearer.lower() == "bearer" else "")
    db.commit()
    if cookie and len(cookie) <= 128:
        owner = db.scalar(select(auth.Session.account_id).where(auth.Session.refresh_digest == auth.digest(cookie)))
        if owner and owner != account_id:
            return
    _clear_cookie(response)
    logger.info("auth_session_ended")


def _checked_account(request: Request, password: str, db: DbSession):
    _origin(request)
    account = db.get(auth.Account, request.state.auth_user_id)
    if not account:
        raise HTTPException(401, "Session expired")
    _rate_limit(request, account.name_key)
    if not auth.verify_password(password, account.password_hash):
        logger.warning("auth_password_check_failed")
        raise HTTPException(403, "Invalid current password")
    return account


@router.post("/verify-password", status_code=204)
def verify_password(body: PasswordCheck, request: Request, db: DbSession = Depends(get_db)):
    _checked_account(request, body.password.get_secret_value(), db)


@router.post("/password")
def change_password(body: PasswordChange, request: Request, response: Response, db: DbSession = Depends(get_db)):
    password = body.password.get_secret_value()
    account = _checked_account(request, password, db)
    new_password = body.new_password.get_secret_value()
    if new_password == password:
        raise HTTPException(422, "New password must differ from the current password")
    changed = db.execute(update(auth.Account).where(
        auth.Account.id == account.id, auth.Account.password_hash == account.password_hash
    ).values(password_hash=auth.hash_password(new_password)))
    if changed.rowcount != 1:
        logger.warning("auth_password_change_conflict")
        raise HTTPException(409, "Credentials changed")
    auth.revoke_all(db, account.id)
    tokens = auth.new_session(db, account.id)
    db.commit()
    logger.info("auth_password_changed")
    return _tokens(response, account.id, tokens)
