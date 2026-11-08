#!/usr/bin/env python3
"""
SILENT CLIENT // HARDENED PRODUCTION BACKEND SERVER
Security Rig:
- PBKDF2-HMAC-SHA256 salted password hashing (100,000 rounds)
- Rate limiting on API auth routes (anti brute-force & flood)
- Role-based Access Control (RBAC): Admin restricted routes (User ID 0 / Admin only)
- Security Headers (Anti-Clickjacking, NoSniff, XSS Protection)
- SQLite parameterized queries (SQL Injection immune)
"""

import os
import sys
import json
import sqlite3
import hashlib
import hmac
import secrets
import time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import mimetypes

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'silent.db')
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.execute('PRAGMA journal_mode = WAL;')
    conn.execute('PRAGMA busy_timeout = 5000;')
    conn.execute('PRAGMA foreign_keys = ON;')
    return conn

# In-Memory Rate Limiter: { ip: [timestamp1, timestamp2, ...] }
RATE_LIMIT_STORE = {}
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_AUTH = 10  # max 10 auth requests per minute per IP

def is_rate_limited(ip, max_requests=RATE_LIMIT_MAX_AUTH):
    now = time.time()
    # Prune stale entries if store grows too large
    if len(RATE_LIMIT_STORE) > 10000:
        stale = [k for k, v in RATE_LIMIT_STORE.items() if not v or now - v[-1] >= RATE_LIMIT_WINDOW]
        for k in stale:
            del RATE_LIMIT_STORE[k]
    if ip not in RATE_LIMIT_STORE:
        RATE_LIMIT_STORE[ip] = []
    # Filter out timestamps older than window
    RATE_LIMIT_STORE[ip] = [t for t in RATE_LIMIT_STORE[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(RATE_LIMIT_STORE[ip]) >= max_requests:
        return True
    RATE_LIMIT_STORE[ip].append(now)
    return False

def hash_pw(pw, salt=None):
    if not salt:
        salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
    return f"{salt}${pw_hash}"

def verify_pw(pw, stored_hash):
    if not stored_hash or '$' not in stored_hash:
        # Fallback for plain sha256 migration
        return hmac.compare_digest(hashlib.sha256(pw.encode('utf-8')).hexdigest(), stored_hash)
    salt, hash_val = stored_hash.split('$', 1)
    computed = hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
    return hmac.compare_digest(computed, hash_val)

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # 1. Users table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT NOT NULL,
            hwid TEXT,
            registration_date TEXT NOT NULL,
            days_left INTEGER DEFAULT 0,
            license_status TEXT DEFAULT 'Inactive',
            role TEXT DEFAULT 'Default',
            is_banned INTEGER DEFAULT 0
        )
    ''')
    
    # 2. Sessions table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # 3. License keys table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS keys (
            key_code TEXT PRIMARY KEY,
            days INTEGER NOT NULL,
            is_used INTEGER DEFAULT 0,
            used_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Seed founder account (ID 0 / Lassyy2) with Admin privileges
    cur.execute('SELECT COUNT(*) FROM users WHERE id = 0')
    if cur.fetchone()[0] == 0:
        admin_pw_hash = hash_pw('admin123')
        cur.execute('''
            INSERT INTO users (id, username, password_hash, email, hwid, registration_date, days_left, license_status, role)
            VALUES (0, 'Lassyy2', ?, 'baran@gmail.com', NULL, '07.11.2026', 365, 'Active', 'admin')
        ''', (admin_pw_hash,))
    else:
        # Ensure ID 0 has role admin
        cur.execute("UPDATE users SET role = 'admin' WHERE id = 0")
        
    # Seed promo keys
    cur.execute('INSERT OR IGNORE INTO keys (key_code, days) VALUES (?, ?)', ('SILENT-360-VIP', 360))
    cur.execute('INSERT OR IGNORE INTO keys (key_code, days) VALUES (?, ?)', ('SILENT-LIFETIME-2026', 9999))
    cur.execute('INSERT OR IGNORE INTO keys (key_code, days) VALUES (?, ?)', ('SILENT-30-DAYS', 30))
        
    conn.commit()
    conn.close()

def get_user_by_token(token):
    if not token:
        return None
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        SELECT u.id, u.username, u.email, u.hwid, u.registration_date, u.days_left, u.license_status, u.role, u.is_banned
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ?
    ''', (token,))
    row = cur.fetchone()
    conn.close()
    if row:
        if row[8] == 1: # Banned
            return None
        return {
            'id': row[0],
            'username': row[1],
            'email': row[2],
            'hwid': row[3],
            'registration_date': row[4],
            'days_left': row[5],
            'license_status': row[6],
            'role': row[7]
        }
    return None

class SilentRequestHandler(BaseHTTPRequestHandler):
    def get_client_ip(self):
        # Support Cloudflare / Reverse Proxy headers only when TRUST_PROXY is explicitly enabled
        if os.environ.get('TRUST_PROXY', '').lower() in ('1', 'true', 'yes'):
            cf_ip = self.headers.get('CF-Connecting-IP')
            if cf_ip:
                return cf_ip.strip()
            x_forwarded = self.headers.get('X-Forwarded-For')
            if x_forwarded:
                return x_forwarded.split(',')[0].strip()
        return self.client_address[0]

    def end_headers(self):
        # Security Headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            return {}
        if length > 1024 * 64: # Block large payloads > 64KB
            return {}
        raw = self.rfile.read(length).decode('utf-8', errors='ignore')
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def get_auth_token(self):
        token = self.headers.get('X-Session-Token')
        if not token:
            auth = self.headers.get('Authorization', '')
            if auth.startswith('Bearer '):
                token = auth[7:].strip()
        return token

    def do_GET(self):
        path = self.path.split('?')[0]
        
        # 1. API: Current Profile
        if path == '/api/me':
            token = self.get_auth_token()
            user = get_user_by_token(token)
            if not user:
                self.send_json({'ok': False, 'error': 'Unauthorized'}, status=401)
                return
            self.send_json({'ok': True, 'user': user})
            return

        # 2. API: Admin Dashboard Data (Strictly protected: User ID 0 or role admin only)
        if path == '/api/admin/users':
            token = self.get_auth_token()
            user = get_user_by_token(token)
            if not user or user.get('role') != 'admin':
                self.send_json({'ok': False, 'error': 'Forbidden: Admin access required'}, status=403)
                return

            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('SELECT id, username, email, hwid, registration_date, days_left, license_status, role, is_banned FROM users')
            rows = cur.fetchall()
            conn.close()
            
            user_list = [
                {
                    'id': r[0],
                    'username': r[1],
                    'email': r[2],
                    'hwid': r[3],
                    'registration_date': r[4],
                    'days_left': r[5],
                    'license_status': r[6],
                    'role': r[7],
                    'is_banned': bool(r[8])
                }
                for r in rows
            ]
            self.send_json({'ok': True, 'users': user_list})
            return

        # 3. Static Files
        if path == '/' or path == '':
            path = '/index.html'
            
        # Clean path against directory traversal
        norm_path = os.path.normpath(path.lstrip('/'))
        if norm_path.startswith('..'):
            self.send_response(403)
            self.end_headers()
            return

        file_path = os.path.join(STATIC_DIR, norm_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = 'application/octet-stream'
            
            with open(file_path, 'rb') as f:
                content = f.read()
                
            self.send_response(200)
            self.send_header('Content-Type', mime_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'public, max-age=3600')
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'404 Not Found')

    def do_POST(self):
        client_ip = self.get_client_ip()
        path = self.path.split('?')[0]
        body = self.read_json_body()

        # 1. Register with Rate Limiting & Input Validation
        if path == '/api/register':
            if is_rate_limited(client_ip):
                self.send_json({'ok': False, 'error': 'Слишком много попыток. Подождите минуту.'}, status=429)
                return

            username = body.get('username', '').strip()
            password = body.get('password', '')
            email = body.get('email', f"{username.lower()}@gmail.com").strip()
            
            if not username or len(username) < 3 or len(username) > 20:
                self.send_json({'ok': False, 'error': 'Никнейм должен быть от 3 до 20 символов'}, status=400)
                return

            if not password or len(password) < 4:
                self.send_json({'ok': False, 'error': 'Пароль должен быть не менее 4 символов'}, status=400)
                return

            conn = get_db_connection()
            cur = conn.cursor()
            try:
                cur.execute('SELECT MAX(id) FROM users')
                max_id = cur.fetchone()[0]
                next_id = 0 if max_id is None else max_id + 1
                
                salted_hash = hash_pw(password)
                cur.execute('''
                    INSERT INTO users (id, username, password_hash, email, hwid, registration_date, days_left, license_status, role)
                    VALUES (?, ?, ?, ?, NULL, '08.11.2026', 0, 'Inactive', 'Default')
                ''', (next_id, username, salted_hash, email))
                
                token = secrets.token_hex(32)
                cur.execute('INSERT INTO sessions (token, user_id) VALUES (?, ?)', (token, next_id))
                conn.commit()
                
                user = {
                    'id': next_id,
                    'username': username,
                    'email': email,
                    'hwid': None,
                    'registration_date': '08.11.2026',
                    'days_left': 0,
                    'license_status': 'Inactive',
                    'role': 'Default'
                }
                self.send_json({'ok': True, 'token': token, 'user': user})
            except sqlite3.IntegrityError:
                self.send_json({'ok': False, 'error': 'Пользователь с таким ником уже существует'}, status=400)
            finally:
                conn.close()
            return

        # 2. Login with Timing-Safe Verification & Rate Limiting
        if path == '/api/login':
            if is_rate_limited(client_ip):
                self.send_json({'ok': False, 'error': 'Слишком много попыток входа. Подождите 1 минуту.'}, status=429)
                return

            username = body.get('username', '').strip()
            password = body.get('password', '')
            
            if not username:
                self.send_json({'ok': False, 'error': 'Введите никнейм'}, status=400)
                return

            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('''
                SELECT id, username, password_hash, email, hwid, registration_date, days_left, license_status, role, is_banned
                FROM users WHERE username = ? COLLATE NOCASE
            ''', (username,))
            row = cur.fetchone()
            
            if not row:
                conn.close()
                self.send_json({'ok': False, 'error': 'Пользователь не найден'}, status=400)
                return

            if row[9] == 1:
                conn.close()
                self.send_json({'ok': False, 'error': 'Аккаунт заблокирован'}, status=403)
                return

            stored_hash = row[2]
            if not verify_pw(password, stored_hash):
                conn.close()
                self.send_json({'ok': False, 'error': 'Неверный пароль'}, status=400)
                return

            user_id = row[0]
            token = secrets.token_hex(32)
            cur.execute('INSERT INTO sessions (token, user_id) VALUES (?, ?)', (token, user_id))
            conn.commit()
            conn.close()

            user = {
                'id': row[0],
                'username': row[1],
                'email': row[3],
                'hwid': row[4],
                'registration_date': row[5],
                'days_left': row[6],
                'license_status': row[7],
                'role': row[8]
            }
            self.send_json({'ok': True, 'token': token, 'user': user})
            return

        # Authenticated Session Verification
        token = self.get_auth_token()
        user = get_user_by_token(token)
        if not user:
            self.send_json({'ok': False, 'error': 'Unauthorized'}, status=401)
            return

        user_id = user['id']

        # 3. Change Password
        if path == '/api/change-password':
            new_password = body.get('new_password', '').strip()
            if not new_password or len(new_password) < 4:
                self.send_json({'ok': False, 'error': 'Пароль должен быть не менее 4 символов'}, status=400)
                return
            
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('UPDATE users SET password_hash = ? WHERE id = ?', (hash_pw(new_password), user_id))
            conn.commit()
            conn.close()
            self.send_json({'ok': True, 'message': 'Пароль успешно обновлен'})
            return

        # 4. Change Email
        if path == '/api/change-email':
            new_email = body.get('new_email', '').strip()
            if not new_email or '@' not in new_email:
                self.send_json({'ok': False, 'error': 'Введите корректный email'}, status=400)
                return

            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('UPDATE users SET email = ? WHERE id = ?', (new_email, user_id))
            conn.commit()
            conn.close()
            self.send_json({'ok': True, 'email': new_email})
            return

        # 5. Activate License Key (Race-Condition Free Atomic Claim)
        if path == '/api/activate-key':
            key_code = body.get('key', '').strip().upper()
            if not key_code:
                self.send_json({'ok': False, 'error': 'Введите ключ активации'}, status=400)
                return

            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('SELECT days FROM keys WHERE key_code = ?', (key_code,))
            row = cur.fetchone()
            
            if not row:
                conn.close()
                self.send_json({'ok': False, 'error': 'Недействительный лицензионный ключ'}, status=400)
                return

            days = row[0]
            # Atomic update: only one request can update is_used from 0 to 1
            cur.execute('UPDATE keys SET is_used = 1, used_by = ? WHERE key_code = ? AND is_used = 0', (user_id, key_code))
            if cur.rowcount == 0:
                conn.close()
                self.send_json({'ok': False, 'error': 'Этот ключ уже активирован'}, status=400)
                return

            cur.execute('''
                UPDATE users 
                SET days_left = days_left + ?, license_status = 'Active' 
                WHERE id = ?
            ''', (days, user_id))
            conn.commit()
            
            cur.execute('SELECT days_left, license_status FROM users WHERE id = ?', (user_id,))
            new_days, new_status = cur.fetchone()
            conn.close()
            
            self.send_json({'ok': True, 'days_left': new_days, 'license_status': new_status})
            return

        # 6. Admin Only: Generate License Key
        if path == '/api/admin/generate-key':
            if user.get('role') != 'admin':
                self.send_json({'ok': False, 'error': 'Forbidden'}, status=403)
                return

            days = int(body.get('days', 360))
            new_key = f"SILENT-{secrets.token_hex(4).upper()}-{days}"
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('INSERT INTO keys (key_code, days) VALUES (?, ?)', (new_key, days))
            conn.commit()
            conn.close()
            self.send_json({'ok': True, 'key': new_key, 'days': days})
            return

        # 7. Logout
        if path == '/api/logout':
            if token:
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute('DELETE FROM sessions WHERE token = ?', (token,))
                conn.commit()
                conn.close()
            self.send_json({'ok': True})
            return

        self.send_json({'ok': False, 'error': 'Endpoint not found'}, status=404)

def run(port=8080):
    init_db()
    server_address = ('0.0.0.0', port)
    httpd = ThreadingHTTPServer(server_address, SilentRequestHandler)
    print(f"Silent Hardened Server running on http://0.0.0.0:{port}")
    httpd.serve_forever()

if __name__ == '__main__':
    env_port = os.environ.get('PORT')
    if env_port:
        port = int(env_port)
    elif len(sys.argv) > 1:
        port = int(sys.argv[1])
    else:
        port = 8080
    run(port)
