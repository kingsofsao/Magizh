require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "";

let sqlite = null;
let pgPool = null;

function qmarksToPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function initDb() {
  if (DATABASE_URL) {
    const { Pool } = require("pg");
    pgPool = new Pool({ connectionString: DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } });
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data_json TEXT NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, data_json TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, data_json TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS vitals (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, data_json TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ai_messages (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    return;
  }

  const Database = require("better-sqlite3");
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS profiles (user_id INTEGER PRIMARY KEY, data_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS vitals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS ai_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
  `);
}

const db = {
  async get(sql, params = []) {
    if (pgPool) return (await pgPool.query(qmarksToPg(sql), params)).rows[0];
    return sqlite.prepare(sql).get(...params);
  },
  async all(sql, params = []) {
    if (pgPool) return (await pgPool.query(qmarksToPg(sql), params)).rows;
    return sqlite.prepare(sql).all(...params);
  },
  async run(sql, params = []) {
    if (pgPool) {
      const clean = qmarksToPg(sql);
      if (/^INSERT\s+/i.test(clean) && /RETURNING/i.test(clean)) return (await pgPool.query(clean, params)).rows[0];
      const result = await pgPool.query(clean, params);
      return { changes: result.rowCount, lastInsertRowid: null };
    }
    return sqlite.prepare(sql).run(...params);
  },
  async insertUser(name, email, hash) {
    if (pgPool) return (await pgPool.query("INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING id", [name, email, hash])).rows[0].id;
    return sqlite.prepare("INSERT INTO users (name,email,password_hash) VALUES (?,?,?)").run(name, email, hash).lastInsertRowid;
  },
  async transaction(fn) {
    if (!pgPool) return fn();
    const client = await pgPool.connect();
    try { await client.query("BEGIN"); await fn({ client }); await client.query("COMMIT"); }
    catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }
  }
};

async function queryWithClient(client, sql, params = []) { return (await client.query(qmarksToPg(sql), params)).rows; }

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload), "Cache-Control": "no-store" });
  res.end(payload);
}
function sendError(res, status, message) { return sendJson(res, status, { error: message }); }
function readBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; if (Buffer.byteLength(data) > limit) { req.destroy(); reject(new Error("Request too large")); } });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { reject(new Error("Invalid JSON")); } });
    req.on("error", reject);
  });
}
function readRawBody(req, limit = 15_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = []; let total = 0;
    req.on("data", chunk => { total += chunk.length; if (total > limit) { req.destroy(); reject(new Error("Audio request too large")); return; } chunks.push(chunk); });
    req.on("end", () => resolve(Buffer.concat(chunks))); req.on("error", reject);
  });
}
function authUser(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) throw new Error("Authentication required");
  return jwt.verify(header.slice(7), JWT_SECRET);
}
function createToken(user) { return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" }); }
function publicUser(row) { return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at }; }
function validateCredentials(name, email, password) {
  if (!name || name.trim().length < 2) return "Name must contain at least 2 characters";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
  if (!password || password.length < 8) return "Password must be at least 8 characters";
  return null;
}
function safeJson(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }

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

async function ollamaChat(question, history, profile) {
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
This is an educational assistant and not a replacement for a doctor.

User profile JSON: ${JSON.stringify(profile || {})}`;
  const messages = [{ role: "system", content: system }, ...history.slice(-10).map(m => ({ role: m.role === "ai" ? "assistant" : m.role, content: String(m.text || m.content || "").slice(0, 5000) })), { role: "user", content: question }];
  const headers = { "Content-Type": "application/json" }; if (OLLAMA_API_KEY) headers.Authorization = `Bearer ${OLLAMA_API_KEY}`;
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, { method: "POST", headers, body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false, options: { temperature: 0.25 } }) });
  const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = {}; }
  if (!response.ok) throw new Error(data.error || `Ollama returned HTTP ${response.status}`);
  const answer = data.message?.content?.trim() || data.response?.trim();
  if (!answer) throw new Error("Ollama returned an empty response");
  return cleanAIResponse(answer);
}
async function elevenLabsSpeak(text) {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) throw new Error("ElevenLabs is not configured. Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to .env.");
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}`, { method: "POST", headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" }, body: JSON.stringify({ text: String(text).slice(0, 5000), model_id: ELEVENLABS_TTS_MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }) });
  const audio = Buffer.from(await response.arrayBuffer()); if (!response.ok) { let detail = audio.toString("utf8"); try { detail = JSON.parse(detail).detail?.message || detail; } catch {} throw new Error(detail || `ElevenLabs TTS HTTP ${response.status}`); } return audio;
}
function multipartFromRequest(req, body) {
  const contentType = req.headers["content-type"] || ""; const match = contentType.match(/boundary="?([^";]+)"?/i); if (!match) throw new Error("Missing multipart boundary");
  const b = Buffer.from(`--${match[1]}`); const parts = body.toString("binary").split(b.toString("binary"));
  for (const part of parts) if (part.includes('filename="')) { const headerEnd = part.indexOf("\r\n\r\n"); if (headerEnd < 0) continue; const header = part.slice(0, headerEnd); let content = part.slice(headerEnd + 4); if (content.endsWith("\r\n")) content = content.slice(0, -2); return { filename: header.match(/filename="([^"]+)"/i)?.[1] || "audio.webm", contentType: header.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] || "audio/webm", buffer: Buffer.from(content, "binary") }; }
  throw new Error("Audio file not found");
}
async function elevenLabsTranscribe(file) {
  if (!ELEVENLABS_API_KEY) throw new Error("ElevenLabs is not configured. Add ELEVENLABS_API_KEY to .env.");
  const form = new FormData(); form.append("file", new Blob([file.buffer], { type: file.contentType }), file.filename); form.append("model_id", ELEVENLABS_STT_MODEL); form.append("language_code", "en");
  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": ELEVENLABS_API_KEY }, body: form });
  const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = {}; } if (!response.ok) throw new Error(data.detail?.message || data.error || `ElevenLabs STT HTTP ${response.status}`); return data.text || "";
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`); const pathname = url.pathname;
  if (req.method === "GET" && pathname === "/api/health") return sendJson(res, 200, { ok: true, database: DATABASE_URL ? "postgres" : "sqlite", ollama: { baseUrl: OLLAMA_BASE_URL, model: OLLAMA_MODEL, configured: Boolean(OLLAMA_API_KEY || OLLAMA_BASE_URL.includes("127.0.0.1")) }, elevenlabs: { configured: Boolean(ELEVENLABS_API_KEY), voiceConfigured: Boolean(ELEVENLABS_VOICE_ID) } });
  if (req.method === "POST" && pathname === "/api/auth/signup") {
    const body = await readBody(req); const name = String(body.name || "").trim(); const email = String(body.email || "").trim().toLowerCase(); const password = String(body.password || ""); const validation = validateCredentials(name, email, password); if (validation) return sendError(res, 400, validation);
    if (await db.get("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", [email])) return sendError(res, 409, "An account with this email already exists");
    const hash = await bcrypt.hash(password, 12); const id = await db.insertUser(name, email, hash); const user = await db.get("SELECT * FROM users WHERE id = ?", [id]); return sendJson(res, 201, { token: createToken(user), user: publicUser(user), profile: null });
  }
  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readBody(req); const email = String(body.email || "").trim().toLowerCase(); const password = String(body.password || ""); const user = await db.get("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email]); if (!user || !(await bcrypt.compare(password, user.password_hash))) return sendError(res, 401, "Invalid email or password");
    const profileRow = await db.get("SELECT data_json FROM profiles WHERE user_id = ?", [user.id]); return sendJson(res, 200, { token: createToken(user), user: publicUser(user), profile: profileRow ? safeJson(profileRow.data_json, null) : null });
  }
  let user; try { user = authUser(req); } catch (e) { if (pathname.startsWith("/api/")) return sendError(res, 401, "Authentication required"); }
  if (req.method === "GET" && pathname === "/api/auth/me") { const row = await db.get("SELECT * FROM users WHERE id = ?", [user.id]); if (!row) return sendError(res, 401, "Account not found"); const profileRow = await db.get("SELECT data_json FROM profiles WHERE user_id = ?", [user.id]); return sendJson(res, 200, { user: publicUser(row), profile: profileRow ? safeJson(profileRow.data_json, null) : null }); }
  if (req.method === "GET" && pathname === "/api/profile") { const row = await db.get("SELECT data_json FROM profiles WHERE user_id = ?", [user.id]); return sendJson(res, 200, { profile: row ? safeJson(row.data_json, null) : null }); }
  if (req.method === "PUT" && pathname === "/api/profile") { const body = await readBody(req); const profile = body.profile; if (!profile || typeof profile !== "object") return sendError(res, 400, "Profile object is required"); if (pgPool) await pgPool.query(`INSERT INTO profiles (user_id,data_json,updated_at) VALUES ($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET data_json=EXCLUDED.data_json, updated_at=CURRENT_TIMESTAMP`, [user.id, JSON.stringify(profile)]); else sqlite.prepare(`INSERT INTO profiles (user_id,data_json,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET data_json=excluded.data_json, updated_at=CURRENT_TIMESTAMP`).run(user.id, JSON.stringify(profile)); await db.run("UPDATE users SET name = ? WHERE id = ?", [String(profile.name || user.name), user.id]); return sendJson(res, 200, { profile }); }
  if (req.method === "GET" && pathname === "/api/reminders") { const rows = await db.all("SELECT id,data_json FROM reminders WHERE user_id=? ORDER BY id DESC", [user.id]); return sendJson(res, 200, { reminders: rows.map(r => ({ ...safeJson(r.data_json, {}), id: r.id })) }); }
  if (req.method === "PUT" && pathname === "/api/reminders") { const body = await readBody(req); const reminders = Array.isArray(body.reminders) ? body.reminders : []; if (pgPool) { await db.transaction(async ({ client }) => { await client.query("DELETE FROM reminders WHERE user_id=$1", [user.id]); for (const item of reminders.slice(0,100)) await client.query("INSERT INTO reminders (user_id,data_json) VALUES ($1,$2)", [user.id, JSON.stringify(item)]); }); } else { const tx = sqlite.transaction(() => { sqlite.prepare("DELETE FROM reminders WHERE user_id=?").run(user.id); const insert = sqlite.prepare("INSERT INTO reminders (user_id,data_json) VALUES (?,?)"); for (const item of reminders.slice(0,100)) insert.run(user.id, JSON.stringify(item)); }); tx(); } return sendJson(res,200,{ok:true}); }
  if (req.method === "GET" && pathname === "/api/contacts") { const rows = await db.all("SELECT id,data_json FROM contacts WHERE user_id=? ORDER BY id DESC", [user.id]); return sendJson(res,200,{contacts:rows.map(r=>({...safeJson(r.data_json,{}),id:r.id}))}); }
  if (req.method === "PUT" && pathname === "/api/contacts") { const body = await readBody(req); const contacts = Array.isArray(body.contacts) ? body.contacts : []; if (pgPool) { await db.transaction(async ({client})=>{ await client.query("DELETE FROM contacts WHERE user_id=$1",[user.id]); for(const item of contacts.slice(0,20)) await client.query("INSERT INTO contacts (user_id,data_json) VALUES ($1,$2)",[user.id,JSON.stringify(item)]); }); } else { const tx=sqlite.transaction(()=>{sqlite.prepare("DELETE FROM contacts WHERE user_id=?").run(user.id); const insert=sqlite.prepare("INSERT INTO contacts (user_id,data_json) VALUES (?,?)"); for(const item of contacts.slice(0,20)) insert.run(user.id,JSON.stringify(item));}); tx(); } return sendJson(res,200,{ok:true}); }
  if (req.method === "POST" && pathname === "/api/chat") { const body=await readBody(req); const question=String(body.question||"").trim(); if(!question)return sendError(res,400,"Question is required"); const history=Array.isArray(body.history)?body.history.filter(Boolean).slice(-10):[]; const profile=body.profile&&typeof body.profile==="object"?body.profile:null; try { const answer=await ollamaChat(question,history,profile); await db.run("INSERT INTO ai_messages (user_id,role,content) VALUES (?,?,?)",[user.id,"user",question]); await db.run("INSERT INTO ai_messages (user_id,role,content) VALUES (?,?,?)",[user.id,"assistant",answer]); return sendJson(res,200,{answer,provider:"ollama",model:OLLAMA_MODEL}); } catch(error){ console.error("[Ollama]",error.message); return sendError(res,503,`Ollama unavailable: ${error.message}`); } }
  if (req.method === "POST" && pathname === "/api/voice/speak") { try { const body=await readBody(req,100000); const text=String(body.text||"").trim(); if(!text)return sendError(res,400,"Text is required"); const audio=await elevenLabsSpeak(text); res.writeHead(200,{"Content-Type":"audio/mpeg","Content-Length":audio.length,"Cache-Control":"no-store"}); return res.end(audio); } catch(error){return sendError(res,503,error.message);} }
  if (req.method === "POST" && pathname === "/api/voice/transcribe") { try { const raw=await readRawBody(req); const file=multipartFromRequest(req,raw); const text=await elevenLabsTranscribe(file); return sendJson(res,200,{text}); } catch(error){return sendError(res,503,error.message);} }
  return sendError(res,404,"Not found");
}

function mime(file){const ext=path.extname(file).toLowerCase();return({".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon",".webp":"image/webp"})[ext]||"application/octet-stream";}
const distDir=path.resolve("./dist");
const server=http.createServer(async(req,res)=>{try{
  if(req.method==="OPTIONS" && req.url.startsWith("/api/")){res.writeHead(204,{"Access-Control-Allow-Origin":FRONTEND_ORIGIN||"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,PUT,OPTIONS"});return res.end();}
  if(req.url.startsWith("/api/")){if(FRONTEND_ORIGIN){res.setHeader("Access-Control-Allow-Origin",FRONTEND_ORIGIN);res.setHeader("Vary","Origin");}return await handleApi(req,res);}
  if(fs.existsSync(distDir)){let pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);if(pathname==="/")pathname="/index.html";const requested=path.join(distDir,pathname.replace(/^\/+/,""));if(fs.existsSync(requested)&&fs.statSync(requested).isFile()){const data=fs.readFileSync(requested);res.writeHead(200,{"Content-Type":mime(requested)});return res.end(data);}const index=path.join(distDir,"index.html");if(fs.existsSync(index)){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});return res.end(fs.readFileSync(index));}}
  res.writeHead(404,{"Content-Type":"text/plain"});res.end("Not found");
}catch(error){console.error("[Server]",error);sendError(res,500,error.message);}});

(async()=>{try{await initDb();server.listen(PORT,()=>{console.log(`\nMagizh backend: http://localhost:${PORT}`);console.log(`Database: ${DATABASE_URL?"PostgreSQL":"SQLite " + DB_PATH}`);console.log(`Ollama: ${OLLAMA_BASE_URL} | model: ${OLLAMA_MODEL}`);console.log(`ElevenLabs: ${ELEVENLABS_API_KEY?"configured":"NOT configured"}`);if(process.env.NODE_ENV!=="production"){const viteCommand=process.platform==="win32"?"npx.cmd":"npx";const vite=require("child_process").spawn(viteCommand,["vite"],{stdio:"inherit",shell:process.platform==="win32"});const shutdown=()=>{if(!vite.killed)vite.kill();if(sqlite)sqlite.close();if(pgPool)pgPool.end();server.close(()=>process.exit(0));};process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);}});}catch(error){console.error("[Startup]",error);process.exit(1);}})();
