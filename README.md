# DiscordLLMBot

DiscordLLMBot is a lightweight Discord bot that uses Google's Gemini (Generative AI) REST API to generate contextual, persona-driven replies inside Discord servers. It is designed as a configurable MVP with in-memory conversation context, file-based persistence, and developer-friendly tooling (auto-restart watcher, structured logging).

---

**Repository layout**

- `src/` — application source
  - `index.js` — main entry point and event loop (thin: just setup + event registration)
  - `llm/gemini.js` — Gemini REST client with retry/backoff
  - `memory/context.js` — in-memory per-channel message history with persistence
  - `personality/` — persona and relationships handling
    - `botPersona.js` — loads bot identity and speaking style
    - `relationships.js` — per-guild, per-user relationship store and initialization
  - `core/` — business logic (moved from utils/)
    - `prompt.js` — builds prompts for Gemini from persona, relationship, and context
    - `replyDecider.js` — decision logic (Phase A/B) for when to reply
    - `responseDelay.js` — human-like delay calculation
  - `events/` — event handlers (moved from index.js)
    - `clientReady.js` — bot ready event handler
    - `messageCreate.js` — message handling and reply logic
    - `guildCreate.js` — guild join event handler
    - `guildMemberAdd.js` — member join event handler
    - `index.js` — event loader
  - `utils/` — helper utilities (logger, profileUpdater, sanitizeName only)
    - `logger.js` — structured logger (file + console)
    - `profileUpdater.js` — sync Discord profile (username/avatar) with config
    - `sanitizeName.js` — sanitize names for Windows-safe filenames
  - `config/` — configuration
    - `bot.json` — main config (persona, memory, api, replyBehavior, logger)
- `data/` — runtime persisted data (per-guild folders with sanitized names)
  - `Server Name 1/` — folder per guild (sanitized to be Windows-safe)
    - `relationships.json` — per-guild, per-user relationship store
    - `contexts/` — folder containing per-channel message history
      - `<channelId>.json` — messages for this channel
  - `Server Name 2/` — another guild's data
- `scripts/` — helper scripts
  - `watch-restart.js` — dev watcher that restarts the bot on `src/` changes and writes restart markers to the log
- `discordllmbot.log` — runtime log file (rotated/truncated on startup)
- `package.json` — npm scripts and metadata

---

## Features & Design

- Persona-driven prompts: the bot persona is defined in `src/config/bot.json` and injected into every prompt. Customize `name`, `description`, `speakingStyle`, and `globalRules` to control how the bot behaves.

- Per-user relationships: when the bot joins a guild it initializes `data/relationships.json` entries for each human member using `bot.defaultRelationship` from `bot.json`. Each relationship stores `username`, `displayName`, `attitude`, `behavior`, and `boundaries`. These entries are included (compactly) in prompts so the LLM can tailor replies.

- Contextual memory: recent channel messages (authorId, author name, content) are kept in memory (bounded by `memory.maxMessages`) and persisted per-channel in `data/contexts/`.

- Reply decision logic: Phase A/B implemented
  - `replyBehavior` in `bot.json` controls how the bot decides whether to reply (modes: `mention-only`, `active`, `passive`, `disabled`), `replyProbability`, delay window, ignore lists, and keywords.
  - Strategy pattern (`src/strategies/replyStrategies.js`) provides `MentionOnly`, `Passive`, `Active`, and `Disabled` strategies. `ActiveStrategy` looks at recent context and simple heuristics.

- Gemini client: `src/llm/gemini.js` sends prompts to Gemini REST API with configurable `api.geminiModel`, `api.retryAttempts`, and `api.retryBackoffMs`. The client honors `Retry-After` headers for rate-limited responses.

- Structured logging: `src/utils/logger.js` writes multi-level logs to both console and `discordllmbot.log`. The log file is truncated to the last `logger.maxLogLines` on startup (configurable in `bot.json`). Specialized log levels: `API`, `MESSAGE`, `INFO`, `WARN`, `ERROR`.

- Dev watcher: `scripts/watch-restart.js` restarts the bot on changes in `src/` and appends restart markers to the log so you can inspect where a restart occurred.

---

## Configuration (`src/config/bot.json`)

Important fields:

- `bot`: persona fields
  - `name`, `username`, `description`, `avatarUrl`
  - `speakingStyle`: an array of human-readable style hints
  - `globalRules`: list of rules the bot should always follow
  - `defaultRelationship`: used when initializing per-user entries on guild join

- `memory.maxMessages`: how many messages to keep per-channel in memory

- `api`:
  - `geminiModel`: e.g. `gemini-2.0-flash`
  - `retryAttempts`: integer retries for Gemini client
  - `retryBackoffMs`: base backoff in ms used to scale exponential backoff

- `replyBehavior`: controls Phase A/B reply logic
  - `mode`: `mention-only`, `active`, `passive`, `disabled`
  - `replyProbability`, `minDelayMs`, `maxDelayMs`, `ignoreUsers`, `ignoreChannels`, `ignoreKeywords`, `requireMention`, `engagementMode`

- `logger.maxLogLines`: integer, how many lines to keep from previous log when starting

See [src/config/bot.json](src/config/bot.json) for defaults.

---

## Environment Variables

The bot requires the following environment variables (use a `.env` file in development):

- `DISCORD_TOKEN` — Discord bot token
- `GEMINI_API_KEY` — API key for Google Gemini/Vertex AI

You can create a `.env` file in the project root for development with these values.

---

## Running the bot

Install dependencies and run:

```bash
npm install
npm start
```

During development, use the watcher which restarts on changes and writes restart markers to the log:

```bash
npm run dev
```

Data storage: When the bot starts or joins a server, it automatically creates a per-guild folder (`data/<Server Name>/`) and populates:
- `relationships.json` — per-user relationship entries for the guild
- `contexts/<channelId>.json` — per-channel message history files

Log file: `discordllmbot.log` — the watcher writes restart markers and the logger truncates the file on startup to keep the last `logger.maxLogLines` (configurable in `bot.json`).

---

## Key Implementation Notes

- Relationship persistence: `src/personality/relationships.js` maintains in-memory caches per guild (`guildRelationships[guildId]`) and saves to `data/<Guild Name>/relationships.json` using the persistence layer. Relationships include per-user `username`, `displayName`, `attitude`, `behavior`, and `boundaries`.

- Conversation context: `src/memory/context.js` maintains per-channel message history in memory (`guildContexts[guildId][channelId]`) and persists to `data/<Guild Name>/contexts/<channelName>.json` (human-readable filenames).

- Event handling: `src/events/` contains all Discord event handlers separated from main application logic for better modularity.

- Member enumeration: the bot requests the `Guild Members` intent and will attempt to `guild.members.fetch()` on startup/guild join to populate per-user relationship entries. If fetch fails (or is disabled) it falls back to cached members.

- Logging: prefer `logger.api()` for external API calls (Gemini and Discord profile updates), `logger.message()` for message-level events (mentions/replies), and `logger.info()/warn()/error()` for operational logs.

---

## Extending the bot

Suggested next steps you can implement:

- Admin commands: add Discord commands for admins to inspect and edit `relationships.json` entries in-chat (eg. `!rel set <userId> <json>`).
- Per-guild override UI: add a simple web dashboard or CLI to manage `replyBehavior` and `defaultRelationship` per-guild.
- More advanced reply strategies: add context-aware scoring, conversation topic detection, and rate-limiting heuristics.
- Tests: add unit tests for `replyDecider`, `responseDelay`, and `prompt` to validate behavior.

---

## Troubleshooting

- If Gemini returns `429 Resource exhausted`, check `api.retryAttempts` and `api.retryBackoffMs` in `bot.json` and ensure `GEMINI_API_KEY` has billing/quota enabled.
- If you see repeated avatar update attempts on startup, ensure `bot.username` and `bot.avatarUrl` in `bot.json` match the bot's Discord profile, or let the code update once (it now strips query params when comparing).
- If member population is slow or fails, ensure the bot has the `Server Members Intent` enabled in the Discord Developer Portal.

---

## Files to inspect when debugging

- [src/index.js](src/index.js)
- [src/events/](src/events/) — event handlers
- [src/core/](src/core/) — business logic
- [src/llm/gemini.js](src/llm/gemini.js)
- [src/utils/logger.js](src/utils/logger.js)
- [src/personality/relationships.js](src/personality/relationships.js)
- [src/config/bot.json](src/config/bot.json)

---

If you want, I can also:

- Add in-chat admin commands for relationship management.
- Add automated tests and CI config.
- Add a small web UI for editing per-guild configs.

Tell me which of those you'd like next.