-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "GameResult" AS ENUM ('WHITE_WIN', 'BLACK_WIN', 'DRAW');

-- CreateEnum
CREATE TYPE "Color" AS ENUM ('w', 'b');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "whitePlayerId" TEXT NOT NULL,
    "blackPlayerId" TEXT,
    "isBotGame" BOOLEAN NOT NULL DEFAULT false,
    "botLevel" INTEGER,
    "status" "GameStatus" NOT NULL DEFAULT 'ACTIVE',
    "result" "GameResult",
    "fen" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moves" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "moveNumber" INTEGER NOT NULL,
    "san" TEXT NOT NULL,
    "uci" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "ratingBefore" INTEGER NOT NULL,
    "ratingAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_rating_idx" ON "users"("rating");

-- CreateIndex
CREATE INDEX "games_whitePlayerId_idx" ON "games"("whitePlayerId");

-- CreateIndex
CREATE INDEX "games_blackPlayerId_idx" ON "games"("blackPlayerId");

-- CreateIndex
CREATE INDEX "games_status_idx" ON "games"("status");

-- CreateIndex
CREATE INDEX "games_createdAt_idx" ON "games"("createdAt");

-- CreateIndex
CREATE INDEX "moves_gameId_idx" ON "moves"("gameId");

-- CreateIndex
CREATE INDEX "rating_history_userId_idx" ON "rating_history"("userId");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moves" ADD CONSTRAINT "moves_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
