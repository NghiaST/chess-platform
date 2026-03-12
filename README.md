# Chess Platform

A full-stack chess web application built with React, Node.js, and PostgreSQL.

## Live Demo

| | URL |
|---|---|
| **Frontend** | https://chess-platform-gold.vercel.app |
| **Backend API** | https://chess-platform-yeq5.onrender.com |
| **Database** | Neon (PostgreSQL serverless) |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| State | Zustand, React Query |
| Chess | chess.js, react-chessboard |
| Backend | Node.js, Express, TypeScript |
| Realtime | Socket.IO |
| Database | PostgreSQL, Prisma ORM |
| Hosting | Vercel (frontend), Render (backend), Neon (database) |
| DevOps | Docker, Docker Compose (local dev) |

## Features

- **Play vs Bot** — single-player against Stockfish-powered bot
- **Real-time PvP** — matchmaking queue, Socket.IO, 10-minute time control per side
- **Disconnect grace** — 30-second reconnect window before forfeit; rejoin banner on home page
- **Game History & Replay** — step through past games with Stockfish analysis, copy PGN/FEN
- **Study Mode** — play both colors, load FEN/PGN, undo/redo, click-to-jump, export PGN/FEN
- **ELO Rating & Leaderboard** — rating updates after each game
- **Auth** — register/login with email or username + JWT
- **Settings** — board theme, piece set, move highlights, premove toggle (persisted)

## Project Structure

```
chess-platform/
├── frontend/          # React + Vite SPA
├── backend/           # Express + TypeScript API + Socket.IO
├── database/prisma/   # Prisma schema
├── docker/            # Docker Compose for local dev
└── README.md
```

## Development Setup

### Prerequisites
- Node.js 20+
- Docker Desktop

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Start database

```bash
cd docker
docker compose up postgres -d
```

### 3. Run migrations

```bash
cd backend
cp ../database/prisma/schema.prisma ./prisma/schema.prisma
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Configure environment

```bash
# backend/.env — copy from backend/.env.example
cp backend/.env.example backend/.env
```

### 5. Start dev servers

```bash
# Terminal 1
cd backend && npm run dev    # http://localhost:4000

# Terminal 2
cd frontend && npm run dev   # http://localhost:5173
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /api/auth/register | Register |
| POST | /api/auth/login | Login (email or username) |
| GET | /api/users/me | Current user |
| GET | /api/users/:id | User profile |
| GET | /api/games/:id | Game by ID |
| POST | /api/games/:id/resign | Resign |
| GET | /api/leaderboard | Top players |
| POST | /api/analysis | Stockfish position analysis |

## Socket.IO Events

| Event | Direction | Description |
|---|---|---|
| `queue:join` / `queue:leave` | client→server | Enter/leave matchmaking |
| `queue:matched` | server→client | Match found |
| `game:join` | client→server | Join game room |
| `game:move` | client→server | Submit a move |
| `game:state` | server→client | Full game state |
| `game:ended` | server→client | Game over |
| `clock:state` | server→client | Clock sync |
| `clock:timeout` | server→client | Flag falls |
| `player:disconnected` | server→client | Opponent left (with deadline) |
| `player:reconnected` | server→client | Opponent rejoined |

## Tests

```bash
cd backend && npm test    # Jest — 94 tests
cd frontend && npm test   # Vitest — 16 tests
```

## Docker (full stack)

```bash
cd docker && docker compose up --build
# App at http://localhost:5173
```
