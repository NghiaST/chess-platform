# Chess Platform

A full-stack chess web application built with React, Node.js, and PostgreSQL.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| State | Zustand, React Query |
| Chess | chess.js, react-chessboard |
| Backend | Node.js, Express, TypeScript |
| Realtime | Socket.IO (ready for Phase 5) |
| Database | PostgreSQL, Prisma ORM |
| DevOps | Docker, Docker Compose |

## Project Structure

```
chess-platform/
├── frontend/          # React + Vite frontend
├── backend/           # Express + TypeScript API
├── database/prisma/   # Prisma schema
├── docker/            # Docker Compose
└── README.md
```

## Development Setup

### Prerequisites
- Node.js 20+
- Docker Desktop
- Git

### 1. Clone & Install

```bash
git clone <repo-url>
cd chess-platform

# Install backend deps
cd backend && npm install

# Install frontend deps  
cd ../frontend && npm install
```

### 2. Start Database (Docker)

```bash
cd docker
docker compose up postgres -d
```

### 3. Setup Database Schema

```bash
cd backend
# Copy prisma schema
cp ../database/prisma/schema.prisma ./prisma/schema.prisma

# Run migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate
```

### 4. Start Backend

```bash
cd backend
npm run dev
# API running at http://localhost:4000
```

### 5. Start Frontend

```bash
cd frontend
npm run dev
# App running at http://localhost:5173
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| GET | /api/users/me | Get current user |
| GET | /api/users/:id | Get user by ID |
| POST | /api/games/create | Create game |
| GET | /api/games/:id | Get game by ID |
| POST | /api/games/:id/move | Make a move |
| POST | /api/games/:id/resign | Resign game |
| GET | /api/leaderboard | Top players |

## Feature Roadmap

- [x] Phase 1 — Chess game vs bot
- [x] Phase 2 — Auth (register/login/JWT)
- [ ] Phase 3 — Game history & replay
- [ ] Phase 4 — ELO rating & leaderboard
- [ ] Phase 5 — Real-time multiplayer (Socket.IO)

## Docker (Full Stack)

```bash
cd docker
docker compose up --build
```

Access at http://localhost:5173
