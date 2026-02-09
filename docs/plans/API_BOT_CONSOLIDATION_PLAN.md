# API and Bot Consolidation Plan

## Overview
Merge the separate `api` and `bot` containers into a single `bot` container. This will allow for shared state, real-time updates via WebSockets, and simplified deployment.

## Goals
1.  Run the Express API and Discord Bot in the same Node.js process.
2.  Enable direct access to Bot state from the API.
3.  Remove the separate `api` container.
4.  Maintain existing API endpoints for the Dashboard.

## Steps

### 1. Dependency Analysis & Merge
- [ ] Check `api/package.json` dependencies.
- [ ] Add missing dependencies (express, socket.io, cors, etc.) to `bot/package.json`.
- [ ] Run `npm install` in `bot` directory.

### 2. Code Migration
- [ ] Create `bot/src/api/` directory.
- [ ] Move `api/index.js` logic to `bot/src/api/server.js` (or similar).
- [ ] Refactor API code to export a `startApi` function that accepts the Discord `client`.
- [ ] Update `bot/src/index.js` to import and start the API server.
- [ ] Ensure `shared` module imports are correct (paths might change relative to `bot` root).

### 3. Integration
- [ ] Pass the Discord `client` instance to the API.
- [ ] Replace internal HTTP calls (e.g., `axios.get('http://bot:3001/...')`) with direct function calls or event emitters.
- [ ] Implement WebSocket events for real-time bot status updates (logs, messages, etc.).

### 4. Docker & Configuration
- [ ] Update `docker-compose.yml`:
    - [ ] Remove `api` service.
    - [ ] Expose API port (3000) on `bot` service.
    - [ ] Update `dashboard` dependency to depend on `bot`.
- [ ] Update `bot/Dockerfile.bot` if necessary (usually just `npm install` covers it).
- [ ] Update `.env` or config to ensure API port is configured for the bot.

### 5. Dashboard Update
- [ ] Verify Dashboard connects to the correct URL. (Since we map port 3000 to host, it should still work if accessing via localhost. Internal docker networking might need check if dashboard uses internal DNS `api` vs `bot`).
- [ ] Update `vite.config.js` proxy if necessary (point to `bot` container instead of `api` if using internal names).

### 6. Cleanup
- [ ] Remove `api/` directory.
- [ ] Remove `api/Dockerfile.api`.

## Verification
- [ ] Bot starts up and connects to Discord.
- [ ] API endpoints respond (e.g., `/api/health`).
- [ ] Dashboard loads and displays data.
- [ ] Real-time logs work (Socket.io).
