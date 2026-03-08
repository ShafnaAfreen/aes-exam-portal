import base64
import hashlib
import json
import math
import os
import sqlite3
import time
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from flask import Flask, jsonify, request
from flask_bcrypt import Bcrypt
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
bcrypt = Bcrypt(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "users.db")

# Geofence policy: only this area can fetch/decrypt chunk material.
# Replace with your actual exam-center coordinates.
ALLOWED_CENTER_LAT = 12.8421545
ALLOWED_CENTER_LON = 80.1575656
ALLOWED_RADIUS_METERS = 1000

# Exam access window in local timezone.
# Update these values for each exam slot.
EXAM_TIMEZONE = "Asia/Kolkata"
EXAM_START_LOCAL = "2026-03-08 10:00:00"
EXAM_END_LOCAL = "2026-03-08 15:00:00"


# ==========================
# INIT DATABASE
# ==========================

def init_db():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()

init_db()

# ==========================
# REGISTER USER (one-time setup)
# ==========================

@app.route("/register", methods=["POST"])
def register():
    data = request.json or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")

    try:
        conn = sqlite3.connect(DATABASE)
        c = conn.cursor()
        c.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, hashed_password)
        )
        conn.commit()
        conn.close()
        return jsonify({"message": "User registered successfully"})
    except sqlite3.IntegrityError:
        return jsonify({"message": "User already exists"}), 400

# ==========================
# QUESTIONS (chunk source)
# ==========================

QUESTION_CHUNKS = [
    {
        "id": 1,
        "q": "Distance between two shafts shall not be less than ____?",
        "options": ["7 M", "10.5 M", "13.5 M", "15.5 M", "18.5 M"]
    },
    {
        "id": 2,
        "q": "What is AES?",
        "options": ["Hash", "Encryption", "Protocol", "Network", "Database"]
    },
    {
        "id": 3,
        "q": "Define Zero Trust.",
        "options": ["Firewall", "Always Verify", "VPN", "Server", "Client"]
    }
]
# ==========================
# LOGIN
# ==========================

@app.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    c.execute("SELECT password_hash FROM users WHERE username = ?", (username,))
    user = c.fetchone()
    conn.close()

    if user and bcrypt.check_password_hash(user[0], password):
        return jsonify({"message": "Login successful"})
    else:
        return jsonify({"message": "Invalid credentials"}), 401


def _b64(data):
    return base64.b64encode(data).decode("ascii")


def _secure_wipe(byte_buf):
    # Best-effort memory wipe for mutable buffers.
    if isinstance(byte_buf, bytearray):
        for i in range(len(byte_buf)):
            byte_buf[i] = 0


def _derive_binding_key(reg_no, device_id, geo_lat, geo_lon, time_window, salt):
    geo_cell = f"{geo_lat:.3f},{geo_lon:.3f}"
    material = f"{reg_no}|{device_id}|{geo_cell}|{time_window}|".encode("utf-8") + salt
    digest = hashlib.sha256(material).digest()
    return bytearray(digest)


def _haversine_meters(lat1, lon1, lat2, lon2):
    r = 6371000  # Earth radius in meters.
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _parse_local_to_utc(ts, tz_name):
    local_tz = ZoneInfo(tz_name)
    local_dt = datetime.strptime(ts, "%Y-%m-%d %H:%M:%S").replace(tzinfo=local_tz)
    return local_dt.astimezone(timezone.utc)


def _exam_window_error():
    now_utc = datetime.now(timezone.utc)
    exam_start = _parse_local_to_utc(EXAM_START_LOCAL, EXAM_TIMEZONE)
    exam_end = _parse_local_to_utc(EXAM_END_LOCAL, EXAM_TIMEZONE)
    # Strict window: [start, end). At end time or later, access is denied.
    if now_utc < exam_start or now_utc >= exam_end:
        return (
            jsonify(
                {
                    "message": "Access denied: outside exam time window",
                    "now_utc": now_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "exam_timezone": EXAM_TIMEZONE,
                    "exam_start_local": EXAM_START_LOCAL,
                    "exam_end_local": EXAM_END_LOCAL,
                    "exam_start_utc": exam_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "exam_end_utc": exam_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
            ),
            403,
        )
    return None


@app.route("/questions/meta", methods=["GET"])
def questions_meta():
    exam_error = _exam_window_error()
    if exam_error:
        return exam_error
    return jsonify({"total": len(QUESTION_CHUNKS)})


@app.route("/debug/policy", methods=["GET"])
def debug_policy():
    now_utc = datetime.now(timezone.utc)
    exam_start = _parse_local_to_utc(EXAM_START_LOCAL, EXAM_TIMEZONE)
    exam_end = _parse_local_to_utc(EXAM_END_LOCAL, EXAM_TIMEZONE)
    allowed = exam_start <= now_utc < exam_end
    return jsonify(
        {
            "now_utc": now_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "exam_timezone": EXAM_TIMEZONE,
            "exam_start_local": EXAM_START_LOCAL,
            "exam_end_local": EXAM_END_LOCAL,
            "exam_start_utc": exam_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "exam_end_utc": exam_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "allowed_now": allowed,
        }
    )


@app.route("/questions/chunk/<int:index>", methods=["GET"])
def encrypted_question_chunk(index):
    if index < 0 or index >= len(QUESTION_CHUNKS):
        return jsonify({"message": "Chunk not found"}), 404

    exam_error = _exam_window_error()
    if exam_error:
        return exam_error

    ttl_ms = 250
    expires_at_ms = int(time.time() * 1000) + ttl_ms
    time_window = int(time.time() // 30)
    question_bytes = json.dumps(QUESTION_CHUNKS[index]).encode("utf-8")
    reg_no = (request.headers.get("X-Registration-No") or "").strip()
    device_id = (request.headers.get("X-Device-Id") or "").strip()
    geo_lat_raw = (request.headers.get("X-Geo-Lat") or "").strip()
    geo_lon_raw = (request.headers.get("X-Geo-Lon") or "").strip()

    if not reg_no or not device_id or not geo_lat_raw or not geo_lon_raw:
        return jsonify({"message": "Missing binding headers"}), 400

    try:
        geo_lat = float(geo_lat_raw)
        geo_lon = float(geo_lon_raw)
    except ValueError:
        return jsonify({"message": "Invalid geolocation headers"}), 400
    distance_m = _haversine_meters(
        geo_lat, geo_lon, ALLOWED_CENTER_LAT, ALLOWED_CENTER_LON
    )
    if distance_m > ALLOWED_RADIUS_METERS:
        return (
            jsonify(
                {
                    "message": "Access denied: outside allowed exam zone",
                    "distance_m": round(distance_m, 2),
                    "allowed_radius_m": ALLOWED_RADIUS_METERS,
                }
            ),
            403,
        )

    # Ephemeral AES-256 key per chunk request.
    ephemeral_key = bytearray(os.urandom(32))
    binding_salt = os.urandom(16)
    key_nonce = os.urandom(12)
    nonce = os.urandom(12)
    binding_key = None
    wrapped_ephemeral_key = None
    aesgcm = None
    encrypted_payload = None

    try:
        binding_key = _derive_binding_key(
            reg_no, device_id, geo_lat, geo_lon, time_window, binding_salt
        )
        key_wrap = AESGCM(bytes(binding_key))
        wrapped_ephemeral_key = key_wrap.encrypt(key_nonce, bytes(ephemeral_key), None)
        aesgcm = AESGCM(bytes(ephemeral_key))
        encrypted_payload = aesgcm.encrypt(nonce, question_bytes, None)
        return jsonify(
            {
                "index": index,
                "expires_at_ms": expires_at_ms,
                "time_window": time_window,
                "algorithm": "AES-256-GCM",
                "nonce_b64": _b64(nonce),
                "ciphertext_b64": _b64(encrypted_payload),
                "binding_salt_b64": _b64(binding_salt),
                "key_nonce_b64": _b64(key_nonce),
                "wrapped_key_b64": _b64(wrapped_ephemeral_key),
            }
        )
    finally:
        _secure_wipe(ephemeral_key)
        _secure_wipe(binding_key)
        question_bytes = b""
        wrapped_ephemeral_key = b""
        encrypted_payload = b""
        aesgcm = None


@app.route("/")
def home():
    return "Backend Running"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
