import base64
import json
import os
import sqlite3
import time

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from flask import Flask, jsonify, request
from flask_bcrypt import Bcrypt
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
bcrypt = Bcrypt(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "users.db")

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


@app.route("/questions/meta", methods=["GET"])
def questions_meta():
    return jsonify({"total": len(QUESTION_CHUNKS)})


@app.route("/questions/chunk/<int:index>", methods=["GET"])
def encrypted_question_chunk(index):
    if index < 0 or index >= len(QUESTION_CHUNKS):
        return jsonify({"message": "Chunk not found"}), 404

    ttl_ms = 250
    expires_at_ms = int(time.time() * 1000) + ttl_ms
    question_bytes = json.dumps(QUESTION_CHUNKS[index]).encode("utf-8")

    # Ephemeral AES-256 key per chunk request.
    ephemeral_key = bytearray(os.urandom(32))
    nonce = os.urandom(12)
    aesgcm = None
    encrypted_payload = None

    try:
        aesgcm = AESGCM(bytes(ephemeral_key))
        encrypted_payload = aesgcm.encrypt(nonce, question_bytes, None)
        return jsonify(
            {
                "index": index,
                "expires_at_ms": expires_at_ms,
                "algorithm": "AES-256-GCM",
                "nonce_b64": _b64(nonce),
                "ciphertext_b64": _b64(encrypted_payload),
                "ephemeral_key_b64": _b64(bytes(ephemeral_key)),
            }
        )
    finally:
        _secure_wipe(ephemeral_key)
        question_bytes = b""
        encrypted_payload = b""
        aesgcm = None


@app.route("/")
def home():
    return "Backend Running"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
