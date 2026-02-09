# Copilot Instructions for DiscordLLMBot

## 1. Architecture Overview

This is a Discord bot that generates contextual replies using Google's Gemini API. The bot maintains a human personality and can customize behavior per user. The entire environment is containerized using Docker Compose.

**Data Flow:**
1. User mentions bot → Message stored in **PostgreSQL database**.
2. Prompt builder combines: bot persona + user relationship (from DB) + conversation context (from DB).
3. Gemini API generates reply → Bot responds in Discord.

---

## 2. File Organization

```
bot/
  src/
    index.js                           # Main entry point (setup + event registration + internal API)
    llm/gemini.js                      # External API calls + retry logic
    memory/context.js                  # Channel-specific history + persistence
    personality/                       # Bot identity & user config
    core/                              # Business logic
      prompt.js                       # Builds prompts for Gemini
      replyDecider.js                 # Decision logic for replying
      responseDelay.js                # Human-like delay calculation
    events/                            # Event handlers
      clientReady.js                  # Bot ready event handler
      messageCreate.js                # Message handling and reply logic
      guildCreate.js                  # Guild join event handler
      guildMemberAdd.js               # Member join event handler
      index.js                        # Event loader
    utils/                             # Helper utilities
      profileUpdater.js               # Sync Discord profile with config
      sanitizeName.js                 # Sanitize names
shared/
  storage/                           # Data I/O layer (database, persistence, lock)
  config/
    bot.json                        # Bot configuration (name, avatar, personality, API settings)
    configLoader.js                 # Config file parser and cache
    validation.js                   # Environment var validation
  utils/
    logger.js                       # Structured logger (file + console)

api/                                 # Express API for dashboard
dashboard/                           # Vite + React frontend
docs/
  sessions/                         # Session notes (auto-tracked)
  plans/                            # Project plan documents
  adr/                              # Architecture decisions

docker-compose.yml                   # Docker container orchestration
```

---

## 3. Module Responsibilities

- **`bot/src/index.js`**: Listens to Discord events, orchestrates the pipeline. Exposes an internal API (port 3001) for management.
- **`bot/src/llm/gemini.js`**: Handles all HTTP calls to the Gemini API, including retry logic.
- **`api/index.js`**: Express.js API that serves the web dashboard.
- **`dashboard/`**: Vite + React frontend for the web dashboard.
- **`shared/storage/persistence.js`**: Provides a data access layer for all database interactions (CRUD operations).
- **`shared/config/configLoader.js`**: Loads and validates the `bot.json` configuration.

---

## 4. Configuration (`shared/config/bot.json`)

The bot's behavior is primarily controlled by `shared/config/bot.json`.

- **`bot`**: Defines the bot's persona (`name`, `description`, `speakingStyle`).
- **`memory.maxMessages`**: Controls the number of messages to keep in the context window.
- **`api.geminiModel`**: Specifies the Gemini model to use (e.g., `gemini-1.5-flash`).
- **`replyBehavior`**: A critical section that governs when and how the bot replies.
  - `mode`: (`"mention-only"`, `"active"`, `"passive"`, `"disabled"`)
  - `replyProbability`: (`0.0` - `1.0`)
  - `minDelayMs`, `maxDelayMs`: (`number`)
  - `ignoreUsers`, `ignoreChannels`, `ignoreKeywords`: (`array<string>`)
  - `requireMention`: (`boolean`)
  - `proactiveReplyChance`: (`0.0` - `1.0`)

---

## 5. Environment & Secrets

Required environment variables (via `.env`):
- `DISCORD_TOKEN`: From the Discord Developer Portal.
- `GEMINI_API_KEY`: From Google Cloud.
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`: Database credentials.
- `DATABASE_URL`: Full connection string for PostgreSQL.
- `POSTGRES_PORT`: Port for the database.
- `PGADMIN_DEFAULT_EMAIL`, `PGADMIN_DEFAULT_PASSWORD`: Credentials for the pgAdmin dashboard.
