# Magizh — Maternal & Child Healthcare Companion

This version keeps the existing Magizh frontend UI and adds a production-oriented backend.

## Included

- Login/signup with bcrypt password hashing and JWT authentication
- Persistent user profile, reminders and emergency contacts
- AI conversation storage
- Ollama local development support
- Ollama Cloud production support
- ElevenLabs speech-to-text and text-to-speech voice mode
- SQLite for simple local development
- PostgreSQL support for production (Render/managed PostgreSQL)
- Vite development proxy and optional separate-frontend API URL

## 1. Local development

```cmd
npm install
```

Copy `.env.example` to `.env` and use:

```env
PORT=8787
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=
DB_PATH=./data/magizh.db

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_API_KEY=

ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

Make sure Ollama is running:

```cmd
ollama run qwen3:8b
```

Then:

```cmd
npm run dev
```

Open `http://localhost:5173`.

## 2. Production with Ollama Cloud

Use the following backend environment variables:

```env
NODE_ENV=production
PORT=10000
JWT_SECRET=<long-random-secret>
DATABASE_URL=<managed-postgresql-connection-string>
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_MODEL=gpt-oss:20b-cloud
OLLAMA_API_KEY=<ollama-cloud-api-key>
ELEVENLABS_API_KEY=<elevenlabs-api-key>
ELEVENLABS_VOICE_ID=<elevenlabs-voice-id>
```

Never put `OLLAMA_API_KEY` or `ELEVENLABS_API_KEY` in frontend/Vite variables. They must remain server-side secrets.

## 3. Render deployment

Recommended production setup:

1. Create a PostgreSQL database in Render (or use another managed PostgreSQL provider).
2. Create a Render Web Service from this repository.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Set the environment variables above.
6. Use the PostgreSQL `DATABASE_URL` supplied by your database provider.

The server serves the Vite `dist` folder itself, so you can deploy the whole project as one Render web service. If you instead deploy the frontend separately on Vercel, set `VITE_API_BASE_URL` at Vercel to your Render backend URL and set `FRONTEND_ORIGIN` on Render to the Vercel origin.

## 4. API

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET/PUT /api/profile`
- `GET/PUT /api/reminders`
- `GET/PUT /api/contacts`
- `POST /api/chat`
- `POST /api/voice/transcribe`
- `POST /api/voice/speak`

## Database note

SQLite is convenient for local development. Production should use managed PostgreSQL because Render instances have ephemeral filesystems unless persistent storage is configured.
