require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/* ============================================================
   CONFIGURATION
   ============================================================ */

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 8787);
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const DB_PATH = path.resolve(process.env.DB_PATH || "./data/magizh.db");
const DATABASE_URL = process.env.DATABASE_URL || "";
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3:8b";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "";
const ELEVENLABS_TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2";
const ELEVENLABS_STT_MODEL = process.env.ELEVENLABS_STT_MODEL || "scribe_v1";
const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || "").replace(/\/$/, "");
const DIST_DIR = path.resolve("./dist");

if (IS_PRODUCTION && (JWT_SECRET === "dev-only-change-me" || JWT_SECRET.length < 32)) {
  console.error("[Startup] JWT_SECRET must be set to a random string of at least 32 characters in production.");
  process.exit(1);
}

// Must match the language codes used by the frontend (LANGS in src/main.jsx).
const SUPPORTED_LANGUAGES = {
  en: "English",
  ta: "Tamil",
  hi: "Hindi",
  te: "Telugu",
  kn: "Kannada",
  ml: "Malayalam"
};

// Must match the vital types offered in the frontend VitalModal.
const VITAL_TYPES = ["Blood pressure", "Weight", "Heart rate", "Temperature"];

const LIMITS = {
  reminders: 100,
  contacts: 20,
  vitals: 200,
  feedPosts: 100,
  postLength: 500,
  commentLength: 300,
  questionLength: 2000,
  historyMessages: 10,
  historyMessageLength: 5000,
  speechLength: 5000
};

// Dummy hash so a login attempt for an unknown email takes as long as a real one.
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-password", 12);

/* ============================================================
   ERRORS, RATE LIMITS AND HTTP HELPERS
   ============================================================ */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const rateBuckets = new Map();

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new HttpError(429, "Too many requests. Please wait a moment and try again.");
  }
}

// Old buckets are removed periodically so memory stays bounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
}, 60_000).unref();

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store"
  });
  res.end(payload);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function readBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", chunk => {
      total += chunk.length;
      if (total > limit) {
        req.destroy();
        reject(new HttpError(413, "Request is too large."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8") || "{}";
      try {
        const parsed = JSON.parse(text);
        resolve(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
      } catch {
        reject(new HttpError(400, "Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function readRawBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", chunk => {
      total += chunk.length;
      if (total > limit) {
        req.destroy();
        reject(new HttpError(413, "Audio recording is too large."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/* ============================================================
   VALIDATION AND FORMATTING
   ============================================================ */

function requireText(value, maxLength, label) {
  const text = String(value ?? "").trim();
  if (text.length < 1 || text.length > maxLength) {
    throw new HttpError(400, `${label} must be between 1 and ${maxLength} characters.`);
  }
  return text;
}

function optionalText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function parseId(value) {
  if (!/^\d+$/.test(String(value))) throw new HttpError(404, "Not found.");
  return Number(value);
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function validateCredentials(name, email, password) {
  if (name.length < 2 || name.length > 100) return "Name must be between 2 and 100 characters.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  if (password.length < 8 || password.length > 128) return "Password must be between 8 and 128 characters.";
  return null;
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// PostgreSQL returns Date objects; SQLite returns UTC text without a zone marker.
function isoTime(value) {
  if (!value) return null;
  const date = value instanceof Date
    ? value
    : new Date(`${String(value).replace(" ", "T")}${String(value).endsWith("Z") ? "" : "Z"}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function publicUser(row) {
  return { id: Number(row.id), name: row.name, email: row.email, createdAt: isoTime(row.created_at) };
}

function cleanAIResponse(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/[*_~`]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/* ============================================================
   DATABASE (SQLite for development, PostgreSQL for production)
   ============================================================ */

let sqlite = null;
let pgPool = null;

function toPgPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function initPostgres() {
  const { Pool } = require("pg");
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
  });
  pgPool.on("error", error => console.error("[Postgres] idle client error:", error.message));

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      consent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data_json TEXT NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS vitals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ai_messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS community_posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS community_likes (
      post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS community_comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_vitals_user ON vitals(user_id);
    CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id);
  `);

  // Databases created before consent was recorded need the column added.
  await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ");
}

function initSqlite() {
  const Database = require("better-sqlite3");
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      consent_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS profiles (
      user_id INTEGER PRIMARY KEY,
      data_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS vitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS community_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS community_likes (
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (post_id, user_id),
      FOREIGN KEY(post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS community_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_vitals_user ON vitals(user_id);
    CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id);
  `);

  const userColumns = sqlite.prepare("PRAGMA table_info(users)").all().map(column => column.name);
  if (!userColumns.includes("consent_at")) {
    sqlite.exec("ALTER TABLE users ADD COLUMN consent_at TEXT");
  }
}

async function initDb() {
  if (DATABASE_URL) {
    await initPostgres();
  } else {
    initSqlite();
  }
}

const db = {
  async get(sql, params = []) {
    if (pgPool) return (await pgPool.query(toPgPlaceholders(sql), params)).rows[0];
    return sqlite.prepare(sql).get(...params);
  },
  async all(sql, params = []) {
    if (pgPool) return (await pgPool.query(toPgPlaceholders(sql), params)).rows;
    return sqlite.prepare(sql).all(...params);
  },
  async run(sql, params = []) {
    if (pgPool) return { changes: (await pgPool.query(toPgPlaceholders(sql), params)).rowCount };
    return { changes: sqlite.prepare(sql).run(...params).changes };
  },
  // Runs an INSERT and returns the new row id.
  async insert(sql, params = []) {
    if (pgPool) return (await pgPool.query(`${toPgPlaceholders(sql)} RETURNING id`, params)).rows[0].id;
    return Number(sqlite.prepare(sql).run(...params).lastInsertRowid);
  }
};

// Replaces all rows a user has in one of the list tables (reminders, contacts)
// inside a single transaction, so a failure never leaves the list half-written.
// `table` is always a hard-coded name from this file, never user input.
async function replaceUserRows(table, userId, items, limit) {
  const payloads = items
    .filter(item => item && typeof item === "object" && !Array.isArray(item))
    .slice(0, limit)
    .map(item => JSON.stringify(item));

  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
      for (const payload of payloads) {
        await client.query(`INSERT INTO ${table} (user_id, data_json) VALUES ($1, $2)`, [userId, payload]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return;
  }

  sqlite.transaction(() => {
    sqlite.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    const insert = sqlite.prepare(`INSERT INTO ${table} (user_id, data_json) VALUES (?, ?)`);
    for (const payload of payloads) insert.run(userId, payload);
  })();
}

async function listUserRows(table, userId, limit) {
  const rows = await db.all(
    `SELECT id, data_json FROM ${table} WHERE user_id = ? ORDER BY id DESC LIMIT ?`,
    [userId, limit]
  );
  return rows.map(row => ({ ...safeJson(row.data_json, {}), id: Number(row.id) }));
}

/* ============================================================
   AUTHENTICATION
   ============================================================ */

function requireUser(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) throw new HttpError(401, "Authentication required.");
  try {
    return jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    throw new HttpError(401, "Your session has expired. Please log in again.");
  }
}

function createToken(user) {
  return jwt.sign({ id: Number(user.id), email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
}

/* ============================================================
   EXTERNAL SERVICES (Ollama, ElevenLabs)
   ============================================================ */

async function askOllama({ question, history, profile, language }) {
  const languageName = SUPPORTED_LANGUAGES[language];
  const languageRule = language === "en"
    ? ""
    : `\n\nLANGUAGE: Reply entirely in ${languageName}, using simple everyday ${languageName}. Where a medical term is important, add the English term in brackets.`;

  const system = `You are Magizh AI, a maternal and child healthcare education assistant.

Answer naturally like a helpful human speaking to a pregnant mother or new mother.

STRICT RESPONSE FORMAT:
- Do NOT use Markdown.
- Do NOT use # headings.
- Do NOT use bullet points.
- Do NOT use numbered lists.
- Do NOT use asterisks.
- Do NOT use tables or the | character.
- Do NOT use hyphens as list markers.
- Do NOT use backticks or code blocks.
- Do NOT use Markdown emphasis.
- Use short paragraphs and simple sentences.
- Keep the response conversational and easy to listen to using text-to-speech.
- Do not begin responses with unnecessary headings such as "Answer:" or "Here are...".
- Answer the user's actual question first.

MEDICAL SAFETY:
Use the user's pregnancy/postnatal context when supplied, but never invent clinical facts.
Do not diagnose or prescribe.
Do not tell the user to change prescription medication without a clinician.
For urgent warning signs, clearly recommend prompt or emergency professional care.
If information depends on individual medical history, say so and recommend speaking with a clinician.
This is an educational assistant and not a replacement for a doctor.${languageRule}

User profile JSON: ${JSON.stringify(profile || {})}`;

  const messages = [
    { role: "system", content: system },
    ...history.slice(-LIMITS.historyMessages).map(message => ({
      // Only "user" and "assistant" roles are accepted from the client, so a
      // client cannot inject a system message.
      role: message.role === "ai" || message.role === "assistant" ? "assistant" : "user",
      content: String(message.text || message.content || "").slice(0, LIMITS.historyMessageLength)
    })),
    { role: "user", content: question }
  ];

  const headers = { "Content-Type": "application/json" };
  if (OLLAMA_API_KEY) headers.Authorization = `Bearer ${OLLAMA_API_KEY}`;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false, options: { temperature: 0.25 } }),
    signal: AbortSignal.timeout(60_000)
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  if (!response.ok) throw new Error(data.error || `Ollama returned HTTP ${response.status}`);

  const answer = data.message?.content?.trim() || data.response?.trim();
  if (!answer) throw new Error("Ollama returned an empty response");
  return cleanAIResponse(answer);
}

async function elevenLabsSpeak(text) {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    throw new Error("ElevenLabs is not configured. Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to the server environment.");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}`,
    {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: String(text).slice(0, LIMITS.speechLength),
        model_id: ELEVENLABS_TTS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }),
      signal: AbortSignal.timeout(60_000)
    }
  );

  const audio = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    let detail = audio.toString("utf8");
    try {
      detail = JSON.parse(detail).detail?.message || detail;
    } catch {
      // Keep the raw text when the body is not JSON.
    }
    throw new Error(detail || `ElevenLabs TTS returned HTTP ${response.status}`);
  }
  return audio;
}

async function elevenLabsTranscribe(file, languageCode) {
  if (!ELEVENLABS_API_KEY) throw new Error("ElevenLabs is not configured. Add ELEVENLABS_API_KEY to the server environment.");

  const form = new FormData();
  form.append("file", new Blob([file.buffer], { type: file.contentType }), file.filename);
  form.append("model_id", ELEVENLABS_STT_MODEL);
  if (languageCode) form.append("language_code", languageCode);

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY },
    body: form,
    signal: AbortSignal.timeout(60_000)
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  if (!response.ok) throw new Error(data.detail?.message || data.error || `ElevenLabs STT returned HTTP ${response.status}`);
  return data.text || "";
}

// Reads the multipart body and returns the audio file plus any text fields.
function parseMultipart(req, body) {
  const boundaryMatch = (req.headers["content-type"] || "").match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new HttpError(400, "Expected a multipart form upload.");

  const delimiter = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const fields = {};
  let file = null;

  const firstDelimiter = body.indexOf(delimiter);
  if (firstDelimiter === -1) throw new HttpError(400, "Audio file not found.");

  let start = firstDelimiter + delimiter.length;
  for (;;) {
    const end = body.indexOf(delimiter, start);
    if (end === -1) break;

    let part = body.subarray(start, end);
    if (part.subarray(0, 2).toString() === "\r\n") part = part.subarray(2);
    if (part.subarray(-2).toString() === "\r\n") part = part.subarray(0, -2);

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString("utf8");
      const content = part.subarray(headerEnd + 4);
      const name = headers.match(/name="([^"]+)"/i)?.[1];
      const filename = headers.match(/filename="([^"]*)"/i)?.[1];

      if (name === "audio" && filename !== undefined) {
        file = {
          filename: filename || "audio.webm",
          contentType: headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "audio/webm",
          buffer: Buffer.from(content)
        };
      } else if (name) {
        fields[name] = content.toString("utf8");
      }
    }

    start = end + delimiter.length;
    if (body.subarray(start, start + 2).toString() === "--") break;
  }

  if (!file) throw new HttpError(400, "Audio file not found.");
  return { file, fields };
}

/* ============================================================
   FORMATTERS FOR API RESPONSES
   ============================================================ */

function formatVital(row) {
  const data = safeJson(row.data_json, {});
  return {
    id: Number(row.id),
    type: data.type,
    value: data.value,
    note: data.note || "",
    recordedAt: isoTime(row.created_at)
  };
}

function formatPost(row, viewerId, commentsByPost) {
  return {
    id: Number(row.id),
    authorName: row.author_name,
    body: row.body,
    createdAt: isoTime(row.created_at),
    likes: Number(row.likes),
    likedByMe: Number(row.liked_by_me) > 0,
    mine: Number(row.user_id) === viewerId,
    comments: commentsByPost.get(Number(row.id)) || []
  };
}

function formatComment(row, viewerId) {
  return {
    id: Number(row.id),
    authorName: row.author_name,
    body: row.body,
    createdAt: isoTime(row.created_at),
    mine: Number(row.user_id) === viewerId
  };
}

/* ============================================================
   ROUTER
   ============================================================ */

const routes = [];

function route(method, pattern, handler, { auth = true } = {}) {
  const names = [];
  const regex = new RegExp(
    `^${pattern.replace(/:(\w+)/g, (_, name) => {
      names.push(name);
      return "([^/]+)";
    })}$`
  );
  routes.push({ method, regex, names, handler, auth });
}

route("GET", "/api/health", async ({ res }) => {
  sendJson(res, 200, {
    ok: true,
    database: pgPool ? "postgres" : "sqlite",
    ollama: { configured: Boolean(OLLAMA_API_KEY || OLLAMA_BASE_URL.includes("127.0.0.1") || OLLAMA_BASE_URL.includes("localhost")) },
    elevenlabs: { configured: Boolean(ELEVENLABS_API_KEY), voiceConfigured: Boolean(ELEVENLABS_VOICE_ID) }
  });
}, { auth: false });

route("POST", "/api/auth/signup", async ({ req, res }) => {
  rateLimit(`auth:${clientIp(req)}`, 20, 15 * 60_000);
  const body = await readBody(req);
  const name = String(body.name ?? "").trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");

  const problem = validateCredentials(name, email, password);
  if (problem) throw new HttpError(400, problem);
  if (body.consent !== true) {
    throw new HttpError(400, "Please accept the privacy notice to create an account.");
  }
  if (await db.get("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", [email])) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  const hash = await bcrypt.hash(password, 12);
  let id;
  try {
    id = await db.insert(
      "INSERT INTO users (name, email, password_hash, consent_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
      [name, email, hash]
    );
  } catch (error) {
    // Two signups with the same email can pass the check above at the same time.
    if (/unique|duplicate/i.test(error.message)) throw new HttpError(409, "An account with this email already exists.");
    throw error;
  }

  const user = await db.get("SELECT * FROM users WHERE id = ?", [id]);
  sendJson(res, 201, { token: createToken(user), user: publicUser(user), profile: null });
}, { auth: false });

route("POST", "/api/auth/login", async ({ req, res }) => {
  rateLimit(`auth:${clientIp(req)}`, 20, 15 * 60_000);
  const body = await readBody(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");

  const user = await db.get("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email]);
  const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !passwordMatches) throw new HttpError(401, "Invalid email or password.");

  const profileRow = await db.get("SELECT data_json FROM profiles WHERE user_id = ?", [user.id]);
  sendJson(res, 200, {
    token: createToken(user),
    user: publicUser(user),
    profile: profileRow ? safeJson(profileRow.data_json, null) : null
  });
}, { auth: false });

route("GET", "/api/auth/me", async ({ res, user }) => {
  const row = await db.get("SELECT * FROM users WHERE id = ?", [user.id]);
  if (!row) throw new HttpError(401, "Account not found.");
  const profileRow = await db.get("SELECT data_json FROM profiles WHERE user_id = ?", [user.id]);
  sendJson(res, 200, {
    user: publicUser(row),
    profile: profileRow ? safeJson(profileRow.data_json, null) : null
  });
});

// Permanently deletes the account and all of its data (cascades to every table).
route("DELETE", "/api/auth/account", async ({ req, res, user }) => {
  const body = await readBody(req);
  const row = await db.get("SELECT password_hash FROM users WHERE id = ?", [user.id]);
  const passwordMatches = row && await bcrypt.compare(String(body.password ?? ""), row.password_hash);
  if (!passwordMatches) throw new HttpError(401, "Password is incorrect.");

  await db.run("DELETE FROM users WHERE id = ?", [user.id]);
  sendJson(res, 200, { ok: true });
});

route("GET", "/api/profile", async ({ res, user }) => {
  const row = await db.get("SELECT data_json FROM profiles WHERE user_id = ?", [user.id]);
  sendJson(res, 200, { profile: row ? safeJson(row.data_json, null) : null });
});

route("PUT", "/api/profile", async ({ req, res, user }) => {
  const body = await readBody(req);
  const profile = body.profile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new HttpError(400, "A profile object is required.");
  }

  await db.run(
    `INSERT INTO profiles (user_id, data_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP`,
    [user.id, JSON.stringify(profile)]
  );
  const name = optionalText(profile.name, 100);
  if (name.length >= 2) await db.run("UPDATE users SET name = ? WHERE id = ?", [name, user.id]);

  sendJson(res, 200, { profile });
});

route("GET", "/api/reminders", async ({ res, user }) => {
  sendJson(res, 200, { reminders: await listUserRows("reminders", user.id, LIMITS.reminders) });
});

route("PUT", "/api/reminders", async ({ req, res, user }) => {
  const body = await readBody(req);
  await replaceUserRows("reminders", user.id, Array.isArray(body.reminders) ? body.reminders : [], LIMITS.reminders);
  sendJson(res, 200, { ok: true });
});

route("GET", "/api/contacts", async ({ res, user }) => {
  sendJson(res, 200, { contacts: await listUserRows("contacts", user.id, LIMITS.contacts) });
});

route("PUT", "/api/contacts", async ({ req, res, user }) => {
  const body = await readBody(req);
  await replaceUserRows("contacts", user.id, Array.isArray(body.contacts) ? body.contacts : [], LIMITS.contacts);
  sendJson(res, 200, { ok: true });
});

route("GET", "/api/vitals", async ({ res, user }) => {
  const rows = await db.all(
    "SELECT id, data_json, created_at FROM vitals WHERE user_id = ? ORDER BY id DESC LIMIT ?",
    [user.id, LIMITS.vitals]
  );
  sendJson(res, 200, { vitals: rows.map(formatVital) });
});

route("POST", "/api/vitals", async ({ req, res, user }) => {
  const body = await readBody(req);
  const type = String(body.type ?? "");
  if (!VITAL_TYPES.includes(type)) throw new HttpError(400, "Choose a valid vital type.");

  const value = requireText(body.value, 40, "Value");
  const note = optionalText(body.note, 300);
  const id = await db.insert(
    "INSERT INTO vitals (user_id, data_json) VALUES (?, ?)",
    [user.id, JSON.stringify({ type, value, note })]
  );
  sendJson(res, 201, { vital: { id, type, value, note, recordedAt: new Date().toISOString() } });
});

route("DELETE", "/api/vitals/:id", async ({ res, user, params }) => {
  const result = await db.run("DELETE FROM vitals WHERE id = ? AND user_id = ?", [parseId(params.id), user.id]);
  if (!result.changes) throw new HttpError(404, "Reading not found.");
  sendJson(res, 200, { ok: true });
});

route("GET", "/api/community/posts", async ({ res, user }) => {
  const posts = await db.all(
    `SELECT p.id, p.user_id, p.author_name, p.body, p.created_at,
       (SELECT COUNT(*) FROM community_likes l WHERE l.post_id = p.id) AS likes,
       (SELECT COUNT(*) FROM community_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked_by_me
     FROM community_posts p
     ORDER BY p.id DESC
     LIMIT ?`,
    [user.id, LIMITS.feedPosts]
  );

  const comments = await db.all(
    `SELECT id, post_id, user_id, author_name, body, created_at
     FROM community_comments
     WHERE post_id IN (SELECT id FROM community_posts ORDER BY id DESC LIMIT ?)
     ORDER BY id ASC`,
    [LIMITS.feedPosts]
  );

  const commentsByPost = new Map();
  for (const comment of comments) {
    const postId = Number(comment.post_id);
    if (!commentsByPost.has(postId)) commentsByPost.set(postId, []);
    commentsByPost.get(postId).push(formatComment(comment, user.id));
  }

  sendJson(res, 200, { posts: posts.map(post => formatPost(post, user.id, commentsByPost)) });
});

route("POST", "/api/community/posts", async ({ req, res, user }) => {
  const body = await readBody(req);
  const text = requireText(body.body, LIMITS.postLength, "Post");
  const author = await db.get("SELECT name FROM users WHERE id = ?", [user.id]);
  const authorName = author?.name || "Magizh member";
  const id = await db.insert(
    "INSERT INTO community_posts (user_id, author_name, body) VALUES (?, ?, ?)",
    [user.id, authorName, text]
  );
  sendJson(res, 201, {
    post: {
      id,
      authorName,
      body: text,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
      mine: true,
      comments: []
    }
  });
});

async function requirePost(postId) {
  const post = await db.get("SELECT id FROM community_posts WHERE id = ?", [postId]);
  if (!post) throw new HttpError(404, "Post not found.");
}

route("POST", "/api/community/posts/:id/like", async ({ res, user, params }) => {
  const postId = parseId(params.id);
  await requirePost(postId);

  const existing = await db.get(
    "SELECT 1 AS found FROM community_likes WHERE post_id = ? AND user_id = ?",
    [postId, user.id]
  );
  if (existing) {
    await db.run("DELETE FROM community_likes WHERE post_id = ? AND user_id = ?", [postId, user.id]);
  } else {
    await db.run("INSERT INTO community_likes (post_id, user_id) VALUES (?, ?)", [postId, user.id]);
  }

  const count = await db.get("SELECT COUNT(*) AS likes FROM community_likes WHERE post_id = ?", [postId]);
  sendJson(res, 200, { liked: !existing, likes: Number(count.likes) });
});

route("POST", "/api/community/posts/:id/comments", async ({ req, res, user, params }) => {
  const postId = parseId(params.id);
  await requirePost(postId);

  const body = await readBody(req);
  const text = requireText(body.body, LIMITS.commentLength, "Comment");
  const author = await db.get("SELECT name FROM users WHERE id = ?", [user.id]);
  const authorName = author?.name || "Magizh member";
  const id = await db.insert(
    "INSERT INTO community_comments (post_id, user_id, author_name, body) VALUES (?, ?, ?, ?)",
    [postId, user.id, authorName, text]
  );
  sendJson(res, 201, {
    comment: { id, authorName, body: text, createdAt: new Date().toISOString(), mine: true }
  });
});

// Only the author can delete a post or comment.
route("DELETE", "/api/community/posts/:id", async ({ res, user, params }) => {
  const result = await db.run("DELETE FROM community_posts WHERE id = ? AND user_id = ?", [parseId(params.id), user.id]);
  if (!result.changes) throw new HttpError(404, "Post not found.");
  sendJson(res, 200, { ok: true });
});

route("DELETE", "/api/community/comments/:id", async ({ res, user, params }) => {
  const result = await db.run("DELETE FROM community_comments WHERE id = ? AND user_id = ?", [parseId(params.id), user.id]);
  if (!result.changes) throw new HttpError(404, "Comment not found.");
  sendJson(res, 200, { ok: true });
});

route("POST", "/api/chat", async ({ req, res, user }) => {
  rateLimit(`chat:${user.id}`, 30, 60_000);
  const body = await readBody(req);
  const question = requireText(body.question, LIMITS.questionLength, "Question");
  const history = Array.isArray(body.history) ? body.history.filter(Boolean) : [];
  const profile = body.profile && typeof body.profile === "object" ? body.profile : null;
  const language = Object.hasOwn(SUPPORTED_LANGUAGES, body.language) ? body.language : "en";

  let answer;
  try {
    answer = await askOllama({ question, history, profile, language });
  } catch (error) {
    console.error("[Ollama]", error.message);
    throw new HttpError(503, "The assistant is unavailable right now. Please try again shortly.");
  }

  await db.run("INSERT INTO ai_messages (user_id, role, content) VALUES (?, ?, ?)", [user.id, "user", question]);
  await db.run("INSERT INTO ai_messages (user_id, role, content) VALUES (?, ?, ?)", [user.id, "assistant", answer]);
  sendJson(res, 200, { answer, language, provider: "ollama" });
});

route("POST", "/api/voice/speak", async ({ req, res, user }) => {
  rateLimit(`voice:${user.id}`, 30, 60_000);
  const body = await readBody(req, 100_000);
  const text = requireText(body.text, LIMITS.speechLength, "Text");

  let audio;
  try {
    audio = await elevenLabsSpeak(text);
  } catch (error) {
    console.error("[ElevenLabs TTS]", error.message);
    throw new HttpError(503, "Voice playback is unavailable right now.");
  }
  res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Length": audio.length, "Cache-Control": "no-store" });
  res.end(audio);
});

route("POST", "/api/voice/transcribe", async ({ req, res, user }) => {
  rateLimit(`voice:${user.id}`, 30, 60_000);
  const raw = await readRawBody(req, 15_000_000);
  const { file, fields } = parseMultipart(req, raw);
  const languageCode = Object.hasOwn(SUPPORTED_LANGUAGES, fields.language) ? fields.language : undefined;

  let text;
  try {
    text = await elevenLabsTranscribe(file, languageCode);
  } catch (error) {
    console.error("[ElevenLabs STT]", error.message);
    throw new HttpError(503, "Voice recognition is unavailable right now.");
  }
  sendJson(res, 200, { text });
});

async function handleApi(req, res, url) {
  let pathMatched = false;

  for (const entry of routes) {
    const match = entry.regex.exec(url.pathname);
    if (!match) continue;
    pathMatched = true;
    if (entry.method !== req.method) continue;

    const params = Object.fromEntries(entry.names.map((name, index) => [name, match[index + 1]]));
    const user = entry.auth ? requireUser(req) : null;
    return entry.handler({ req, res, url, params, user });
  }

  if (pathMatched) throw new HttpError(405, "Method not allowed.");
  throw new HttpError(404, "Not found.");
}

/* ============================================================
   STATIC FRONTEND (serves the Vite build in dist/)
   ============================================================ */

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function serveStatic(req, res, url) {
  const indexPath = path.join(DIST_DIR, "index.html");
  if (!isFile(indexPath)) return sendError(res, 404, "Not found.");

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return sendError(res, 400, "Bad request.");
  }

  // Resolve the request inside dist/ and refuse anything that escapes it.
  const requested = path.resolve(DIST_DIR, `.${path.posix.normalize(`/${pathname}`)}`);
  const insideDist = requested.startsWith(DIST_DIR + path.sep);
  const target = insideDist && isFile(requested) ? requested : indexPath;

  const isHashedAsset = target.startsWith(path.join(DIST_DIR, "assets") + path.sep);
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(target).toLowerCase()] || "application/octet-stream",
    "Cache-Control": isHashedAsset ? "public, max-age=31536000, immutable" : "no-cache"
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(target).pipe(res);
}

/* ============================================================
   HTTP SERVER
   ============================================================ */

function applyCors(res) {
  if (!FRONTEND_ORIGIN) return;
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Vary", "Origin");
}

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");

  try {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname.startsWith("/api/")) {
      applyCors(res);
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
      }
      return await handleApi(req, res, url);
    }

    if (req.method !== "GET" && req.method !== "HEAD") return sendError(res, 405, "Method not allowed.");
    return serveStatic(req, res, url);
  } catch (error) {
    if (error instanceof HttpError) return sendError(res, error.status, error.message);
    console.error("[Server]", error);
    return sendError(res, 500, "Something went wrong. Please try again.");
  }
});

process.on("unhandledRejection", reason => console.error("[unhandledRejection]", reason));

let devVite = null;

(async () => {
  try {
    await initDb();
    server.listen(PORT, () => {
      console.log(`\nMagizh backend: http://localhost:${PORT}`);
      console.log(`Database: ${DATABASE_URL ? "PostgreSQL" : `SQLite ${DB_PATH}`}`);
      console.log(`Ollama: ${OLLAMA_BASE_URL} | model: ${OLLAMA_MODEL}`);
      console.log(`ElevenLabs: ${ELEVENLABS_API_KEY ? "configured" : "NOT configured"}`);

      if (!IS_PRODUCTION) {
        const viteCommand = process.platform === "win32" ? "npx.cmd" : "npx";
        devVite = require("child_process").spawn(viteCommand, ["vite"], {
          stdio: "inherit",
          shell: process.platform === "win32"
        });
      }
    });

    const shutdown = () => {
      if (devVite && !devVite.killed) devVite.kill();
      if (sqlite) sqlite.close();
      if (pgPool) pgPool.end();
      server.close(() => process.exit(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("[Startup]", error);
    process.exit(1);
  }
})();
