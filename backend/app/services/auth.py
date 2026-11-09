"""Server-side credentials and revocable, opaque browser sessions."""
from hashlib import scrypt, sha256
import secrets
from time import time

from sqlalchemy import Boolean, ForeignKey, Integer, String, delete, select, update
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, SessionLocal


ACCESS_SECONDS = 15 * 60
REFRESH_SECONDS = 7 * 24 * 60 * 60
COOKIE = "__Secure-studyflow_refresh"
COOKIE_PATH = "/api/auth"


class Account(Base):
    __tablename__ = "auth_accounts"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(64))
    name_key: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(String(128))


class Session(Base):
    __tablename__ = "auth_sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey(Account.id), index=True)
    refresh_digest: Mapped[str] = mapped_column(String(64), unique=True)
    expires: Mapped[int] = mapped_column(Integer, index=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class Access(Base):
    __tablename__ = "auth_access"
    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey(Session.id), index=True)
    expires: Mapped[int] = mapped_column(Integer, index=True)


class ConsumedRefresh(Base):
    __tablename__ = "auth_consumed_refresh"
    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey(Account.id), index=True)
    expires: Mapped[int] = mapped_column(Integer, index=True)


def digest(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    key = scrypt(password.encode("utf-8"), salt=salt, n=2**15, r=8, p=3, maxmem=64 * 1024**2, dklen=32)
    return salt.hex() + ":" + key.hex()


_dummy_hash = "00" * 16 + ":" + "00" * 32


def verify_password(password: str, stored: str = _dummy_hash) -> bool:
    return secrets.compare_digest(hash_password(password, bytes.fromhex(stored.split(":")[0])), stored)


def resolve_access(token: str) -> str | None:
    if not token or len(token) > 128:
        return None
    now = int(time())
    with SessionLocal() as db:
        return db.scalar(
            select(Session.account_id).join(Access, Access.session_id == Session.id).where(
                Access.digest == digest(token), Access.expires > now, Session.expires > now, Session.revoked.is_(False)
            )
        )


def _issue_access(db, session_id: str, expires: int, now: int) -> tuple[str, int]:
    db.execute(delete(Access).where(Access.expires <= now))
    token = secrets.token_urlsafe(32)
    expiry = min(expires, now + ACCESS_SECONDS)
    db.add(Access(digest=digest(token), session_id=session_id, expires=expiry))
    return token, expiry - now


def new_session(db, account_id: str) -> tuple[str, str, int, int]:
    now = int(time())
    expires = now + REFRESH_SECONDS
    db.execute(delete(ConsumedRefresh).where(ConsumedRefresh.expires <= now))
    db.execute(delete(Session).where(Session.expires <= now, ~Session.id.in_(select(Access.session_id))))
    refresh = secrets.token_urlsafe(32)
    session = Session(
        id=secrets.token_hex(16), account_id=account_id, refresh_digest=digest(refresh), expires=expires
    )
    db.add(session)
    db.flush()
    access, ttl = _issue_access(db, session.id, expires, now)
    return access, refresh, ttl, REFRESH_SECONDS


def revoke_all(db, account_id: str):
    db.execute(update(Session).where(Session.account_id == account_id).values(revoked=True))


def revoke_session(db, cookie: str, account_id: str, access: str):
    if cookie and len(cookie) <= 128:
        db.execute(update(Session).where(
            Session.refresh_digest == digest(cookie), Session.account_id == account_id
        ).values(revoked=True))
    if access and len(access) <= 128:
        db.execute(update(Session).where(
            Session.account_id == account_id,
            Session.id.in_(select(Access.session_id).where(Access.digest == digest(access)))
        ).values(revoked=True))


def rotate_session(db, cookie: str, account_id: str):
    if not cookie or len(cookie) > 128:
        return None, False
    now = int(time())
    old_digest = digest(cookie)
    session = db.scalar(select(Session).where(Session.refresh_digest == old_digest))
    if session and session.account_id == account_id and not session.revoked and session.expires > now:
        refresh = secrets.token_urlsafe(32)
        changed = db.execute(update(Session).where(
            Session.id == session.id, Session.refresh_digest == old_digest, Session.revoked.is_(False),
            Session.expires > now
        ).values(refresh_digest=digest(refresh)))
        if changed.rowcount == 1:
            expires = session.expires
            db.add(ConsumedRefresh(digest=old_digest, account_id=account_id, expires=expires))
            access, ttl = _issue_access(db, session.id, expires, now)
            db.commit()
            return (access, refresh, ttl, expires - now), False
        db.rollback()
    consumed = db.get(ConsumedRefresh, old_digest)
    if consumed and consumed.expires > now:
        revoke_all(db, consumed.account_id)
        db.commit()
        return None, True
    return None, False
