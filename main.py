"""HealthMonitor API.

Run with ``python main.py`` or ``uvicorn main:app --reload``. The API stores
accounts, settings, contact messages, and vital readings in a local SQLite DB.
"""

from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
from pathlib import Path
import re
import secrets
import sqlite3
from typing import Annotated, Any, Iterator

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, field_validator


DATABASE_PATH = Path(
    os.getenv("HEALTHMONITOR_DB", str(Path(__file__).with_name("health_monitor.sqlite3")))
)
PROJECT_DIR = Path(__file__).resolve().parent
FRONTEND_FILES = {
    "contact.css",
    "contact.html",
    "contact.js",
    "history.css",
    "history.html",
    "history.js",
    "index.html",
    "privacy.css",
    "privacy.html",
    "script.js",
    "settings.css",
    "settings.html",
    "settings.js",
    "style.css",
    "api.js",
    "theme.js",
}
SESSION_LIFETIME = timedelta(days=30)
PASSWORD_HASH_ITERATIONS = 310_000
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
bearer_scheme = HTTPBearer(auto_error=False)


@contextmanager
def database() -> Iterator[sqlite3.Connection]:
    """Open a short-lived SQLite connection with foreign keys enabled."""
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with database() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                max_hr INTEGER NOT NULL DEFAULT 150
            );
            CREATE TABLE IF NOT EXISTS vitals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                hr INTEGER NOT NULL,
                spo2 REAL NOT NULL,
                temp REAL NOT NULL,
                systolic INTEGER,
                diastolic INTEGER,
                resp INTEGER,
                glucose REAL,
                status TEXT NOT NULL,
                recorded_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_vitals_user_recorded
                ON vitals(user_id, recorded_at DESC);
            CREATE TABLE IF NOT EXISTS contact_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="HealthMonitor API",
    description="API for accounts, health readings, settings, and contact messages.",
    version="1.0.0",
    lifespan=lifespan,
)

# Authentication uses explicit bearer tokens, not cookies.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


class AccountInput(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must contain at least 2 non-space characters.")
        return value

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL_PATTERN.fullmatch(value):
            raise ValueError("Enter a valid email address.")
        return value


class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL_PATTERN.fullmatch(value):
            raise ValueError("Enter a valid email address.")
        return value


class VitalInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hr: int = Field(ge=30, le=250)
    spo2: float = Field(ge=50, le=100)
    temp: float = Field(ge=25, le=45)
    systolic: int | None = Field(default=None, ge=40, le=300)
    diastolic: int | None = Field(default=None, ge=20, le=200)
    resp: int | None = Field(default=None, ge=1, le=100)
    glucose: float | None = Field(default=None, ge=1, le=1000)


class SettingsInput(BaseModel):
    max_hr: int = Field(ge=60, le=220)


class ContactInput(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    message: str = Field(min_length=10, max_length=5000)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must contain at least 2 non-space characters.")
        return value

    @field_validator("message")
    @classmethod
    def clean_message(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 10:
            raise ValueError("Message must contain at least 10 non-space characters.")
        return value

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL_PATTERN.fullmatch(value):
            raise ValueError("Enter a valid email address.")
        return value


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_HASH_ITERATIONS
    )
    return f"{salt.hex()}:{derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    salt_hex, expected_hash = stored_hash.split(":", maxsplit=1)
    actual_hash = hash_password(password, bytes.fromhex(salt_hex)).split(":", maxsplit=1)[1]
    return hmac.compare_digest(actual_hash, expected_hash)


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = (utc_now() + SESSION_LIFETIME).isoformat()
    with database() as connection:
        connection.execute(
            "INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (token_hash, user_id, expires_at),
        )
        connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (utc_now().isoformat(),))
    return token


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to access this resource.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_hash = hashlib.sha256(credentials.credentials.encode("utf-8")).hexdigest()
    with database() as connection:
        row = connection.execute(
            """
            SELECT users.id, users.name, users.email
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ? AND sessions.expires_at > ?
            """,
            (token_hash, utc_now().isoformat()),
        ).fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session is invalid or expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return dict(row)


CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def reading_status(reading: VitalInput, max_hr: int) -> str:
    if reading.hr > max_hr:
        return f"CRITICAL: Heart rate above {max_hr} BPM"
    if reading.hr > 100:
        return "Alert: High resting heart rate"
    if reading.spo2 < 95:
        return "Warning: Low oxygen saturation"
    if reading.temp > 37.8:
        return "Warning: Elevated temperature"
    return "Normal"


def serialize_vital(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "hr": row["hr"],
        "spo2": row["spo2"],
        "temp": row["temp"],
        "systolic": row["systolic"],
        "diastolic": row["diastolic"],
        "resp": row["resp"],
        "glucose": row["glucose"],
        "status": row["status"],
        "recorded_at": row["recorded_at"],
    }


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: AccountInput) -> dict[str, Any]:
    created_at = utc_now().isoformat()
    try:
        with database() as connection:
            cursor = connection.execute(
                "INSERT INTO users(name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (payload.name, payload.email, hash_password(payload.password), created_at),
            )
            user_id = cursor.lastrowid
            connection.execute(
                "INSERT INTO settings(user_id, max_hr) VALUES (?, 150)", (user_id,)
            )
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from exc

    token = create_session(user_id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user_id, "name": payload.name, "email": payload.email},
    }


@app.post("/login")
def login(payload: LoginInput) -> dict[str, Any]:
    with database() as connection:
        row = connection.execute(
            "SELECT id, name, email, password_hash FROM users WHERE email = ?",
            (payload.email,),
        ).fetchone()
    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")

    return {
        "access_token": create_session(row["id"]),
        "token_type": "bearer",
        "user": {"id": row["id"], "name": row["name"], "email": row["email"]},
    }


@app.post("/logout")
def logout(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    _: CurrentUser,
) -> dict[str, str]:
    if credentials is None:
        raise HTTPException(status_code=401, detail="A bearer token is required.")
    token_hash = hashlib.sha256(credentials.credentials.encode("utf-8")).hexdigest()
    with database() as connection:
        connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
    return {"message": "Signed out successfully."}


@app.get("/me")
def get_profile(user: CurrentUser) -> dict[str, Any]:
    return user


@app.post("/vitals", status_code=status.HTTP_201_CREATED)
def add_vital(reading: VitalInput, user: CurrentUser) -> dict[str, Any]:
    with database() as connection:
        settings = connection.execute(
            "SELECT max_hr FROM settings WHERE user_id = ?", (user["id"],)
        ).fetchone()
        max_hr = settings["max_hr"] if settings else 150
        recorded_at = utc_now().isoformat()
        cursor = connection.execute(
            """
            INSERT INTO vitals(
                user_id, hr, spo2, temp, systolic, diastolic, resp, glucose, status, recorded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user["id"],
                reading.hr,
                reading.spo2,
                reading.temp,
                reading.systolic,
                reading.diastolic,
                reading.resp,
                reading.glucose,
                reading_status(reading, max_hr),
                recorded_at,
            ),
        )
        row = connection.execute(
            "SELECT * FROM vitals WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
    return serialize_vital(row)


@app.get("/vitals")
def latest_vital(user: CurrentUser) -> dict[str, Any]:
    with database() as connection:
        row = connection.execute(
            "SELECT * FROM vitals WHERE user_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1",
            (user["id"],),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="No readings have been recorded yet.")
    return serialize_vital(row)


@app.get("/history")
def get_history(
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> dict[str, Any]:
    with database() as connection:
        rows = connection.execute(
            "SELECT * FROM vitals WHERE user_id = ? ORDER BY recorded_at DESC, id DESC LIMIT ?",
            (user["id"], limit),
        ).fetchall()
    return {"items": [serialize_vital(row) for row in rows], "count": len(rows)}


@app.delete("/history")
def clear_history(user: CurrentUser) -> dict[str, int]:
    with database() as connection:
        cursor = connection.execute("DELETE FROM vitals WHERE user_id = ?", (user["id"],))
    return {"deleted": cursor.rowcount}


@app.get("/settings")
def get_settings(user: CurrentUser) -> dict[str, int]:
    with database() as connection:
        row = connection.execute(
            "SELECT max_hr FROM settings WHERE user_id = ?", (user["id"],)
        ).fetchone()
    return {"max_hr": row["max_hr"] if row else 150}


@app.post("/update_settings")
def update_settings(payload: SettingsInput, user: CurrentUser) -> dict[str, Any]:
    with database() as connection:
        connection.execute(
            """
            INSERT INTO settings(user_id, max_hr) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET max_hr = excluded.max_hr
            """,
            (user["id"], payload.max_hr),
        )
    return {"message": "Settings updated successfully.", "max_hr": payload.max_hr}


@app.post("/contact", status_code=status.HTTP_201_CREATED)
def submit_contact_message(payload: ContactInput) -> dict[str, Any]:
    with database() as connection:
        cursor = connection.execute(
            """
            INSERT INTO contact_messages(name, email, message, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (payload.name, payload.email, payload.message, utc_now().isoformat()),
        )
    return {"id": cursor.lastrowid, "message": "Your message has been received."}


@app.get("/", include_in_schema=False)
def serve_homepage() -> FileResponse:
    return FileResponse(PROJECT_DIR / "index.html", media_type="text/html")


@app.get("/favicon.ico", include_in_schema=False)
def serve_favicon() -> FileResponse:
    return FileResponse(PROJECT_DIR / "images" / "img1.png", media_type="image/png")


@app.get("/images/{asset_name}", include_in_schema=False)
def serve_image(asset_name: str) -> FileResponse:
    if asset_name != "img1.png":
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(PROJECT_DIR / "images" / asset_name)


@app.get("/{asset_name}", include_in_schema=False)
def serve_frontend_file(asset_name: str) -> FileResponse:
    if asset_name not in FRONTEND_FILES:
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(PROJECT_DIR / asset_name)


if __name__ == "__main__":
    print("HealthMonitor website and API running at http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)
