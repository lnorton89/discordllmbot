# Copilot Instructions for DiscordLLMBot

## Architecture Overview

This is a Discord bot that generates contextual replies using Google's Gemini API. The bot maintains a human personality and can customize behavior per user. The entire environment is containerized using Docker Compose.

**Data Flow:**
1. User mentions bot → Message stored in **PostgreSQL database**.
2. Prompt builder combines: bot persona + user relationship (from DB) + conversation context (from DB).
3. Gemini API generates reply → Bot responds in Discord.

## Module Responsibilities

- **`bot/src/index.js`** (entry point): Listens to Discord events, orchestrates the pipeline. Also exposes an internal API (port 3001) for management.
- **`bot/src/llm/gemini.js`**: Single function `generateReply(prompt)` - HTTP calls to Gemini API
- **`api/index.js`**: Express.js API for the dashboard
- **`dashboard/`**: Vite + React frontend dashboard
- **`shared/storage/database.js`**: Manages PostgreSQL connection and schema setup.
- **`shared/storage/persistence.js`**: Provides a data access layer for all database interactions (CRUD operations).
- **`shared/storage/lock.js`**: A locking mechanism to prevent race conditions during schema setup.
- **`bot/Dockerfile.bot`**: Docker configuration for the bot.
- **`api/Dockerfile.api`**: Docker configuration for the API.
- **`dashboard/Dockerfile.dashboard`**: Docker configuration for the dashboard.
- **`docs/Dockerfile.docs`**: Docker configuration for the documentation server.

## Critical Patterns

### 1. Database-Driven State
All state is persisted in a PostgreSQL database. The schema is defined in `shared/storage/database.js` and includes tables for `relationships`, `relationship_behaviors`, `relationship_boundaries`, and `messages`.

**Implication:** Data is persistent across bot restarts.


### 2. Prompt Engineering as Core Logic
The entire bot behavior is driven by the **prompt template** in `bot/src/core/prompt.js`. Changing bot behavior means modifying:
1. `botPersona` object (global traits, loaded from `shared/config/bot.json`)
2. `relationship` config (per-user overrides, stored in DB)
3. Prompt template structure itself

**Convention:** Persona description and rules are lowercase, concise strings. Relationship attitudes match the tone set in botPersona.

### 3. Message Filtering in index.js
```javascript
if (message.author.bot) return  // Ignore bots
if (!message.guild) return       // Guild-only (no DMs)
```
**Important:** Context includes the triggering message—code removes it with `.slice(0, -1)` before prompting to avoid the bot echoing.

### 4. Random Reply Delay
`calculateDelay(replyBehavior)` in `bot/src/core/responseDelay.js` simulates human response time. Keep this or replace with a different human-like pattern, but don't remove entirely.

## Environment & Secrets

Required environment variables (via `.env` or deployment):
- `DISCORD_TOKEN`: From Discord Developer Portal
- `GEMINI_API_KEY`: From Google Cloud (free tier available)
- `POSTGRES_DB`: The name of the database to use.
- `POSTGRES_USER`: The username for the database.
- `POSTGRES_PASSWORD`: The password for the database.
- `DATABASE_URL`: The connection string for the database.
- `POSTGRES_PORT`: The port for the database.
- `PGADMIN_DEFAULT_EMAIL`: The email for the pgAdmin user.
- `PGADMIN_DEFAULT_PASSWORD`: The password for the pgAdmin user.

## Development Workflow

```bash
docker-compose up --build
```

**Testing:** No test suite. Add messages to any Discord server where bot is a member and has MessageContent intent. Monitor `console.error()` logs for API failures.

## Extending the Bot

### Adding New Behavior
1. **Global personality trait?** → Modify `bot` section in `shared/config/bot.json`
2. **Per-user customization?** → Update relationship config via `setRelationship()` in `bot/src/personality/relationships.js` (or via Dashboard)
3. **New API integration?** → Create new module in `bot/src/llm/` (follow `gemini.js` pattern: export single named function)
4. **New memory dimension?** → Add to context object or extend `relationships` structure

### Common Tasks
- **Change bot name:** Update `bot.name` in `shared/config/bot.json` (also update Discord bot username for consistency)
- **Adjust context window:** Change `memory.maxMessages` in `shared/config/bot.json`
- **Add LLM fallback:** Modify `generateReply()` error handling in `bot/src/index.js`
- **Per-guild settings:** Extend relationship object or create `guilds.js` module (keyed by guildId)

## Code Style & Conventions

- **Module exports:** Single default export or named exports, no mixing
- **Function naming:** Verb-first (`getContext`, `buildPrompt`, `generateReply`)
- **Nullish coalescing:** Use `??` for defaults (see `memory/context.js` and `personality/relationships.js`)
- **Error handling:** Catch at `index.js` message handler, log to console, reply with fallback message
- **Persistence:** Use `shared/storage/persistence.js` for data access.

## Discord.js Integration Notes

- **Intents used:** `Guilds`, `GuildMessages`, `MessageContent` (required for reading message text)
- **Partials:** `Channel` (for DM handling, though bot currently ignores DMs)
- **Message mentions check:** Always verify `message.mentions.has(client.user)` before processing
- **Reply method:** Use `message.reply()` not `message.channel.send()` to maintain thread context
