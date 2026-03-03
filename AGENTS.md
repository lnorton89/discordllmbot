# AGENTS.md - DiscordLLMBot Developer Guide

## Overview

This repository is a monorepo:

- `bot/` - Discord bot + Express/Socket.io API (TypeScript)
- `dashboard/` - React dashboard (TypeScript, Vite, MUI)
- `shared/` - shared DB/config/logger utilities
- `docs/` - VitePress docs site

DiscordLLMBot generates contextual replies using LLM APIs (Google Gemini, Ollama, or Qwen). The bot maintains persona and can customize behavior per user and per server.

**Data Flow:**
1. User message → stored in PostgreSQL
2. Prompt builder combines: bot persona + user relationship + conversation context + knowledge graph memory
3. LLM API (Gemini/Ollama/Qwen) generates reply → Bot responds in Discord

---

## Build, lint, and type-check commands

### Root (Monorepo with Turbo)
```bash
npm run dev           # Start bot, db, dashboard with Docker
npm run dev:build     # Rebuild and start
npm run dev:down      # Stop containers
npm run dev:all       # Start all services including docs
npm run dev:logs      # Follow all logs
npm run build         # Build all workspaces (Turbo cached)
npm run lint          # Lint all workspaces (parallel)
npm run type-check    # Type-check all workspaces
npm run test          # Run tests across workspaces
npm run docs          # Run docs dev server
npm run graph         # Generate dependency graph
npm run graph:circular # Check for circular dependencies
```

### Turbo-Specific Commands
```bash
npm run build:bot          # Build only bot workspace
npm run build:dashboard    # Build only dashboard
npm run build:shared       # Build only shared utilities
npm run turbo:clean        # Clean Turbo cache
npm run graph:svg          # Generate interactive SVG dependency graph
```

### Bot
```bash
cd bot
npm run dev           # Start with nodemon
npm run lint
npm run type-check
npm run start         # node dist/index.js
```

### Dashboard
```bash
cd dashboard
npm run dev           # Start Vite dev server (port 5173)
npm run lint
npm run type-check
npm run build         # Production build
npm run preview       # Preview production build
```

---

## 2.1. Turbo Monorepo Integration

This project uses [Turborepo](https://turbo.build/) for optimized monorepo builds:

- **Parallel execution** - Lint/type-check run across all workspaces simultaneously
- **Remote caching** - Build cache shared via `turbo-cache` Docker volume
- **Smart rebuilds** - Only affected packages are rebuilt
- **Task pipelines** - Dependencies built in correct order (shared → bot → dashboard)

**Configuration:**
- `turbo.json` - Task definitions and cache settings
- `.turboignore` - Files excluded from cache consideration
- `docker-compose.yml` - Turbo cache volume mounted to all services

**Docker Integration:**
- Bot, dashboard, and docs services mount the `turbo-cache` volume
- Turbo config (`turbo.json`) is mounted into containers
- Each service runs filtered Turbo tasks (e.g., `--filter=discordllmbot`)

See [TURBO.md](TURBO.md) for detailed documentation.

---

## Current configuration/data model (important)

Configuration has been normalized and persisted in typed DB columns.

### Global config (`global_config`)

Represents system-wide config and maps to:

- `botPersona`: `username`, `description`, `globalRules[]`
- `llm`: `provider`, `geminiModel`, `ollamaModel`, `qwenModel`, `retryAttempts`, `retryBackoffMs`
- `memory`: `maxMessages`, `maxMessageAgeDays`
- `logger`: `maxLogLines`, `logReplyDecisions`, `logSql`
- `sandbox`: `enabled`, `timeoutMs`, `allowedCommands[]`

### Server config (`server_configs`)

Represents per-guild settings and maps to:

- `nickname` (optional)
- `speakingStyle[]`
- `replyBehavior`:
  - `replyProbability`
  - `minDelayMs`
  - `maxDelayMs`
  - `mentionOnly`
  - `ignoreUsers[]`
  - `ignoreChannels[]`
  - `ignoreKeywords[]`
  - `guildSpecificChannels`

### Backward compatibility policy

- Legacy JSON blob config compatibility has been removed.
- If schema/data is incompatible during local development, rebuild/reset DB.

---

## Project Structure

```
bot/src/
  index.ts              # Main entry, Discord client setup
  api/
    server.ts           # Express + Socket.io API (port 3000)
    routes/             # Modular route handlers
    socket.ts           # Socket.io event handlers
  llm/                  # LLM providers (gemini, ollama, qwen)
  memory/
    context.ts          # Per-channel message history
    knowledgeGraph.ts   # Long-term semantic memory
  personality/          # Bot persona + relationships
  core/                 # Prompt building, reply decisions
  sandbox/              # Docker sandbox executor for isolated command execution
  events/               # Discord event handlers
  utils/                # Utility functions

shared/
  storage/              # Database connection, persistence
  config/               # Configuration loading
  utils/                # Logger, shared utilities

dashboard/src/
  pages/                # Route pages (Dashboard, Settings, Servers, Logs, Playground)
  components/           # Reusable UI components
  hooks/                # Custom React hooks
  services/             # API calls to bot
  theme.ts              # MUI dark theme
```

---

## Bot code style guidelines

- 4-space indentation
- Single quotes
- Semicolons required
- Use `.js` extensions for local imports
- Prefer `const`; use `let` only when reassigning
- Use nullish coalescing (`??`) for defaults
- Wrap async work in `try/catch` and log through shared logger

Logger methods:
- `logger.error`, `logger.warn`, `logger.info`, `logger.api`, `logger.message`, `logger.sql`

**Null Handling**
```javascript
// Good
const mode = replyBehavior.mode ?? 'mention-only';
const prob = typeof replyBehavior.replyProbability === 'number' ? replyBehavior.replyProbability : 1.0;

// Bad
const mode = replyBehavior.mode || 'mention-only';
```

**Imports**
```javascript
// Good
import { logger } from '../../shared/utils/logger.js';
import { loadConfig } from '../../shared/config/configLoader.js';
```

---

## Dashboard code style guidelines

- Use TypeScript types from `@types` where available
- Use aliases: `@theme`, `@pages`, `@components`, `@hooks`, `@services`, `@types`
- Functional components and hooks
- Use MUI components and `sx` styling
- Keep server/global config shapes aligned with `dashboard/src/types/index.ts`

**Import examples:**
```typescript
import theme from '@theme';
import { Dashboard, Settings } from '@pages';
import { useHealth } from '@hooks';
```

---

## Key runtime behaviors

- Reply decision no longer uses legacy mode-based strategy routing in primary flow.
- Current decision path uses ignore checks + relationship ignored + `mentionOnly` + probability.
- Channel context and user relationships are cached in memory and persisted to PostgreSQL.
- Dashboard settings use debounced auto-save (1-second delay) to prevent API spam.

---

## Key implementation patterns

1. **Strategy Pattern** - Reply behaviors are configurable via `replyBehavior` settings
2. **Exponential Backoff** - Retry logic with jitter in LLM calls
3. **In-memory Cache + DB Persistence** - `guildRelationships` and `guildContexts` cached in memory, persisted to PostgreSQL
4. **Lock Mechanism** - Prevents race conditions during schema setup
5. **Configuration** - All config in PostgreSQL (`global_config`, `server_configs` tables)
6. **Docker Sandbox** - Isolated container execution for user commands via Docker-in-Docker (DinD)

---

## Database schema

Key tables:
- `global_config` — System-wide settings (typed columns)
- `server_configs` — Per-server overrides (typed columns)
- `guilds` — Joined servers
- `relationships` — Per-user relationship data
- `relationship_behaviors` — Behavior definitions for relationships
- `relationship_boundaries` — Boundary definitions for relationships
- `messages` — Message history
- `bot_replies` — Reply analytics
- `knowledge_graph` — Long-term memory nodes and edges

---

## Environment variables

```bash
# Discord
DISCORD_TOKEN=
DISCORD_CLIENT_ID=

# LLM Provider
GEMINI_API_KEY=
OLLAMA_API_URL=
QWEN_API_KEY=

# Optional Qwen OAuth (PKCE device flow)
QWEN_OAUTH_CLIENT_ID=

# PostgreSQL
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_PORT=
DATABASE_URL=

# pgAdmin
PGADMIN_DEFAULT_EMAIL=
PGADMIN_DEFAULT_PASSWORD=

# Ports
API_PORT=3000
DASHBOARD_PORT=5173
DOCS_PORT=5174

# Ollama (Docker)
OLLAMA_API_URL=http://host.docker.internal:11434

# Qwen OpenAI-compatible endpoint
QWEN_API_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

---

## Common debugging pointers

1. Check root log file (`discordllmbot.log`).
2. Inspect message flow in `bot/src/events/messageCreate.ts`.
3. Inspect reply checks in `bot/src/core/replyDecider.ts`.
4. Use dashboard Logs page for real-time stream.
5. Verify configuration in database (use pgAdmin at http://localhost:5050).

---

## Common tasks

### Adding a Feature
1. Determine module location (memory, llm, personality, core, api)
2. Consider prompt impact
3. Use relationships for per-user data
4. Add logging via logger utility
5. Add API endpoint in `bot/src/api/server.ts` if dashboard integration needed

### Debugging
1. Check `discordllmbot.log` for errors and API traces
2. Review `bot/src/events/messageCreate.ts` for message flow
3. Check `bot/src/core/replyDecider.ts` for reply decision logic
4. Use dashboard Logs page for real-time logs
5. Verify configuration in database (use pgAdmin at http://localhost:5050)
6. Check knowledge graph memory in `bot/src/memory/knowledgeGraph.ts`

---

## Recent Updates

- **Knowledge Graph Memory**: Integrated long-term semantic memory system (`bot/src/memory/knowledgeGraph.ts`)
- **Qwen OAuth**: Automatic token refresh on 401 errors
- **Modular API**: Refactored `server.ts` into modular route files in `bot/src/api/routes/`
- **Docker Networking**: Fixed service discovery and proxy configuration
- **Type Safety**: Added path aliases and centralized constants
- **Socket.io**: Implemented single shared socket pattern, fixed memory leaks
