# DiscordLLMBot

DiscordLLMBot is a lightweight Discord bot that uses Google's Gemini (Generative AI) REST API to generate contextual, persona-driven replies inside Discord servers. It is designed as a configurable MVP with a PostgreSQL database for persistence, a web dashboard for management, and developer-friendly tooling (Docker-based development environment).

---

**Repository layout**

- `bot/` — Discord bot application
  - `src/` — application source
  - `Dockerfile.bot` — Docker configuration for the bot
- `api/` — Express.js API for the dashboard
  - `Dockerfile.api` — Docker configuration for the API
- `dashboard/` — Vite + React frontend dashboard
  - `Dockerfile.dashboard` — Docker configuration for the dashboard
- `shared/` — common logic and configuration used by bot and api
- `docs/` — Documentation
  - `src/` — VitePress source files
  - `Dockerfile.docs` — Docker configuration for the documentation server
- `data/` — runtime persisted data (mounted Docker volumes)
  - `postgres/` — PostgreSQL database files
  - `pgadmin/` — pgAdmin 4 data
- `package.json` — root package.json for monorepo workspaces and scripts

---

## Features & Design

- **Persona-driven prompts**: the bot persona is defined in `shared/config/bot.json` and injected into every prompt. Customize `name`, `description`, `speakingStyle`, and `globalRules` to control how the bot behaves.

- **Per-user relationships**: when the bot joins a guild it initializes database entries for each human member using `bot.defaultRelationship` from `bot.json`. Each relationship stores `username`, `displayName`, `attitude`, `behavior`, and `boundaries`. These entries are included (compactly) in prompts so the LLM can tailor replies.

- **Contextual memory**: recent channel messages (authorId, author name, content) are stored in the PostgreSQL database (bounded by `memory.maxMessages`).

- **Reply decision logic**:
  - `replyBehavior` in `bot.json` controls how the bot decides whether to reply (modes: `mention-only`, `active`, `passive`, `disabled`), `replyProbability`, delay window, ignore lists, and keywords.
  - Strategy pattern (`bot/src/strategies/replyStrategies.js`) provides `MentionOnly`, `Passive`, `Active`, and `Disabled` strategies.

- **Web Dashboard**: A React-based dashboard (running on port 5173 by default) allows you to view logs, manage relationships, and configure the bot.

- **Gemini client**: `bot/src/llm/gemini.js` sends prompts to Gemini REST API with configurable `api.geminiModel`, `api.retryAttempts`, and `api.retryBackoffMs`.

- **Internal API**: The bot runs an internal Express API (port 3001) for hot-reloading configuration and managing guild operations.

---

## Configuration (`shared/config/bot.json`)

Important fields:

- `bot`: persona fields
  - `name`, `username`, `description`, `avatarUrl`
  - `speakingStyle`: an array of human-readable style hints
  - `globalRules`: list of rules the bot should always follow
  - `defaultRelationship`: used when initializing per-user entries on guild join

- `memory.maxMessages`: how many messages to keep per-channel in memory (and DB)

- `api`:
  - `geminiModel`: e.g. `gemini-1.5-flash`
  - `retryAttempts`: integer retries for Gemini client
  - `retryBackoffMs`: base backoff in ms used to scale exponential backoff

- `replyBehavior`: controls the bot's reply decision logic and behavior.
  - `mode`: (`"mention-only"`, `"active"`, `"passive"`, `"disabled"`) — The core toggle for when the bot considers replying:
    - `"mention-only"`: Replies only when explicitly @mentioned.
    - `"active"`: Replies when mentioned, or sometimes proactively joins conversations (e.g., based on recent context, direct questions).
    - `"passive"`: Similar to `"mention-only"`, often used with other stricter rules.
    - `"disabled"`: Bot remains completely silent, observing but never replying.
  - `replyProbability`: (`0.0` - `1.0`) — The chance the bot will reply even when a reply is triggered (e.g., `0.8` means 80% chance).
  - `minDelayMs`, `maxDelayMs`: (`number`) — The minimum and maximum delay (in milliseconds) for a human-like response time.
  - `ignoreUsers`: (`array<string>`) — A list of Discord user IDs the bot should never reply to.
  - `ignoreChannels`: (`array<string>`) — A list of Discord channel IDs where the bot should remain silent.
  - `ignoreKeywords`: (`array<string>`) — A list of keywords or phrases (case-insensitive) that, if present in a message, will prevent the bot from replying.
  - `requireMention`: (`boolean`) — If `true`, the bot *must* be @mentioned to consider replying, even if `mode` is set to `"active"`.
  - `proactiveReplyChance`: (`0.0` - `1.0`) — (Only applies in `"active"` mode) The random chance the bot will proactively reply to a message even if no explicit mention or question is present. A value of `0.05` means a 5% chance.

- `logger.maxLogLines`: integer, how many lines to keep from previous log when starting

See [shared/config/bot.json.defaults](shared/config/bot.json.defaults) for default values.

---

## Environment Variables
- `DISCORD_TOKEN`: From Discord Developer Portal
- `GEMINI_API_KEY`: From Google Cloud (free tier available)
- `POSTGRES_DB`: The name of the database to use.
- `POSTGRES_USER`: The username for the database.
- `POSTGRES_PASSWORD`: The password for the database.
- `DATABASE_URL`: The connection string for the database.
- `POSTGRES_PORT`: The port for the database.
- `PGADMIN_DEFAULT_EMAIL`: The email for the pgAdmin user.
- `PGADMIN_DEFAULT_PASSWORD`: The password for the pgAdmin user.

---

## Running the bot

Install dependencies and run:

```bash
docker-compose up --build
```

Access the services:
- **Dashboard**: http://localhost:5173
- **API**: http://localhost:3000
- **Documentation**: http://localhost:5174
- **pgAdmin**: http://localhost:5050 (Login with email/password from .env)

During development, the `bot` service is configured with a mounted volume and `nodemon` for automatic restarts on code changes.

Data storage: When the bot starts or joins a server, it automatically creates database entries for the guild and its members.

Log file: `discordllmbot.log` — the logger truncates the file on startup to keep the last `logger.maxLogLines` (configurable in `bot.json`).

---

## Key Implementation Notes

- **Relationship persistence**: `bot/src/personality/relationships.js` maintains in-memory caches per guild (`guildRelationships[guildId]`) and saves to the PostgreSQL database using the persistence layer (`shared/storage/persistence.js`). Relationships include per-user `username`, `displayName`, `attitude`, `behavior`, and `boundaries`.

- **Conversation context**: `bot/src/memory/context.js` maintains per-channel message history in memory (`guildContexts[guildId][channelId]`) and persists to the database.

- **Event handling**: `bot/src/events/` contains all Discord event handlers separated from main application logic for better modularity.

- **Member enumeration**: the bot requests the `Guild Members` intent and will attempt to `guild.members.fetch()` on startup/guild join to populate per-user relationship entries. If fetch fails (or is disabled) it falls back to cached members.

- **Logging**: prefer `logger.api()` for external API calls (Gemini and Discord profile updates), `logger.message()` for message-level events (mentions/replies), and `logger.info()/warn()/error()` for operational logs.

---

## Extending the bot

Suggested next steps you can implement:

- **Admin commands**: add Discord commands for admins to inspect and edit relationships in-chat (eg. `!rel set <userId> <json>`).
- **More advanced reply strategies**: add context-aware scoring, conversation topic detection, and rate-limiting heuristics.
- **Tests**: add unit tests for `replyDecider`, `responseDelay`, and `prompt` to validate behavior.
- **Improve Dashboard**: Add more visualizations and controls to the web dashboard
- Web Dashboard: Use the provided `dashboard` and `api` services to manage the bot via a web interface.
- Admin commands: add Discord commands for admins to inspect and edit relationships in-chat (eg. `!rel set <userId> <json>`).
- More advanced reply strategies: add context-aware scoring, conversation topic detection, and rate-limiting heuristics.
- Tests: add unit tests for `replyDecider`, `responseDelay`, and `prompt` to validate behavior.

---

## Troubleshooting

- If Gemini returns `429 Resource exhausted`, check `api.retryAttempts` and `api.retryBackoffMs` in `bot.json` and ensure `GEMINI_API_KEY` has billing/quota enabled.
- If you see repeated avatar update attempts on startup, ensure `bot.username` and `bot.avatarUrl` in `bot.json` match the bot's Discord profile, or let the code update once (it now strips query params when comparing).
- If member population is slow or fails, ensure the bot has the `Server Members Intent` enabled in the Discord Developer Portal.

---

## Files to inspect when debugging

- [bot/src/index.js](bot/src/index.js)
- [bot/src/events/](bot/src/events/) — event handlers
- [bot/src/core/](bot/src/core/) — business logic
- [bot/src/llm/gemini.js](bot/src/llm/gemini.js)
- [shared/utils/logger.js](shared/utils/logger.js)
- [bot/src/personality/relationships.js](bot/src/personality/relationships.js)
- [shared/config/bot.json](shared/config/bot.json)
