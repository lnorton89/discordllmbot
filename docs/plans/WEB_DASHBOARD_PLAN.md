> **Note:** This is a historical plan. The features described here may have been implemented or superseded. See `README.md` for current status.

# Web Dashboard Implementation Plan

## Objective
Create a modern, dark-mode enabled web dashboard to control the DiscordLLMBot, manage relationships, and view server status.

## Architecture

### 1. Frontend (`app/`)
- **Framework:** Vite + React
- **Styling:** Tailwind CSS
- **Components:** Shadcn/UI (Radix UI primitives)
- **State Management:** TanStack Query (React Query) for API caching
- **Routing:** React Router
- **Features:**
    - **Dashboard:** General stats (uptime, connected servers, recent activity).
    - **Settings:** Visual editor for `bot.json` (Persona, API keys, Reply Behavior).
    - **Server View:** List of guilds the bot is in.
    - **User Manager:** View and edit User Relationships (Attitude, Behavior, Boundaries) per guild.
    - **Logs:** Real-time log viewer (via WebSocket/Socket.io).
    - **Playground:** Chat with the bot directly in the browser to test persona changes.
    - **Container Control:** Restart the bot container directly from the UI.

### 2. Backend API (`api/`)
A dedicated Express.js service separate from the bot process.
- **Container Name:** `discordllmbot-api`
- **Port:** 3000
- **Responsibilities:**
    - Read/Write `bot.json` (Shared Volume).
    - Read/Write Database (Relationships, History).
    - Communicate with `bot` container for runtime status.
    - **Validation:** Validate config changes with `zod` before saving.
    - **Auth:** Simple JWT-based authentication (password from `.env`).
    - **Real-time:** Emit logs via Socket.io.
- **Endpoints:**
    - `GET /api/config` - Read config.
    - `POST /api/config` - Update config (validated).
    - `GET /api/relationships` - Query DB for users.
    - `POST /api/chat` - Direct LLM chat (Playground).
    - `POST /api/system/restart` - Restart bot container.

### 3. Bot Service (`src/`)
The existing Discord bot.
- **Container Name:** `discordllmbot-bot` (Renamed from `server`)
- **Responsibilities:**
    - Connect to Discord.
    - Watch `bot.json` for changes (Hot Reload).
    - Sync Guild/Channel data to DB (so API can read it).

### 4. Shared Code (`shared/`)
A new directory to hold code used by both `bot` and `api`.
- **Contents:**
    - Database connection logic (`storage/`).
    - Config loader and types.
    - Logger utility.
- **Implementation Strategy:**
    - **Development:** Docker Volume mount. The `shared` directory on host is mounted to `/usr/src/app/shared` (or similar) in both containers.
    - **Production:** `COPY` instruction in Dockerfile to bake the shared code into the images.
    - **Node Resolution:** Use relative imports `../../shared` or configure `package.json` workspaces / path aliases for cleaner imports.

### 5. Infrastructure (Docker)
- **Services:** `bot`, `api`, `dashboard`, `db`, `pgadmin`.
- **Volumes:**
    - Shared Config Volume: Mounted to both `bot` and `api` to share `bot.json`.
    - Docker Socket: Mounted to `api` container (read-only) to allow restarting the bot.
    - **Shared Code Volume:** `./src/shared:/usr/src/app/src/shared` (for dev hot-reload).

## Implementation Steps

### Phase 1: Shared Code Refactoring
1.  Create `src/shared/` directory.
2.  Move `src/storage`, `src/config`, and `src/utils/logger.js` to `src/shared/`.
3.  Refactor `src/` (Bot) to import from `src/shared/`.
4.  Verify Bot still works with new structure.

### Phase 2: API Service Creation
1.  Create `src/api/` directory with its own `package.json`.
2.  Implement Express server using `src/shared` code for DB/Config.
3.  Implement Socket.io for logs.
4.  Implement JWT Auth and Zod validation.
5.  Create `Dockerfile.api`.

### Phase 3: Bot Updates
1.  Rename `server` service to `bot` in `docker-compose.yml`.
2.  Ensure Bot reloads config when `bot.json` changes.
3.  Update `Dockerfile` (Bot) to copy `shared` folder.

### Phase 4: Frontend Scaffolding
1.  Create `app/` directory (Frontend).
2.  Initialize Vite React project.
3.  Install Tailwind CSS and Shadcn/UI CLI.
4.  Implement Login page and Dashboard layout.
5.  Implement Log Viewer (Socket.io client) and Playground.
6.  Create `Dockerfile.dashboard`.

### Phase 5: Docker Integration
1.  Update `docker-compose.yml` to include `api` and `dashboard` services.
2.  Configure shared volumes and Docker socket mounting.
3.  Ensure `api` container has access to Docker socket (for restarts).

### Phase 6: Documentation
1.  Update `README.md` with new architecture.
2.  Update `docs/src/architecture.md`.
3.  Create `docs/src/dashboard-guide.md`.

## Missing/New Settings Required
To support the dashboard, we need to ensure `bot.json` or `.env` supports:
- `API_PORT`: Port for the Express server (default 3000).
- `DASHBOARD_PASSWORD`: Password for accessing the dashboard.
- `JWT_SECRET`: Secret for signing session tokens.

## Dependencies to Add
- **Root:** `express`, `cors`, `socket.io`, `jsonwebtoken`, `zod`, `dockerode` (for container control).
- **App:** `react`, `react-dom`, `vite`, `tailwindcss`, `postcss`, `autoprefixer`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-*`, `socket.io-client`.
