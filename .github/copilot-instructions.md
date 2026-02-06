# Copilot Instructions for DiscordLLMBot

## Architecture Overview

This is a Discord bot that generates contextual replies using Google's Gemini API. The bot maintains a human personality and can customize behavior per user.

**Data Flow:**
1. User mentions bot → Message stored in **channel-specific memory** (max 12 messages)
2. Prompt builder combines: bot persona + user relationship + conversation context
3. Gemini API generates reply → Bot responds in Discord

## Module Responsibilities

- **`index.js`** (entry point): Listens to Discord events, orchestrates the pipeline
- **`llm/gemini.js`**: Single function `generateReply(prompt)` - HTTP calls to Gemini API
- **`memory/context.js`**: In-memory channel-specific message history (uses `memory[channelId]` object)
- **`personality/botPersona.js`**: Centralized bot identity exported as `botPersona` object
- **`personality/relationships.js`**: Per-guild, per-user behavior customization (exported as keyed object `relationships[guildId][userId]`)
- **`utils/prompt.js`**: Builds the final prompt string from all components

## Critical Patterns

### 1. In-Memory Data Structure
All state uses object maps keyed by Discord IDs. No database.
```javascript
// context.js: memory[channelId] = [{author, content}, ...]
// relationships.js: relationships[guildId][userId] = {attitude, behavior, boundaries}
```
**Implication:** Data is volatile - bot restart loses all history and relationships.

### 2. Prompt Engineering as Core Logic
The entire bot behavior is driven by the **prompt template** in `prompt.js`. Changing bot behavior means modifying:
1. `botPersona` object (global traits)
2. `relationship` config (per-user overrides)
3. Prompt template structure itself

**Convention:** Persona description and rules are lowercase, concise strings. Relationship attitudes match the tone set in botPersona.

### 3. Message Filtering in index.js
```javascript
if (message.author.bot) return  // Ignore bots
if (!message.guild) return       // Guild-only (no DMs)
if (!message.mentions.has(client.user)) return  // Requires mention
```
**Important:** Context includes the triggering message—code removes it with `.slice(0, -1)` before prompting to avoid the bot echoing.

### 4. Random Reply Delay
`Math.random() * 2000` ms delay simulates human response time. Keep this or replace with a different human-like pattern, but don't remove entirely.

## Environment & Secrets

Required environment variables (via `.env` or deployment):
- `DISCORD_TOKEN`: From Discord Developer Portal
- `GEMINI_API_KEY`: From Google Cloud (free tier available)

## Development Workflow

```bash
npm start           # Run bot locally
# Set DISCORD_TOKEN and GEMINI_API_KEY in .env
docker build -t discordllm .   # Build container
docker run --env-file .env discordllm  # Run in container
```

**Testing:** No test suite. Add messages to any Discord server where bot is a member and has MessageContent intent. Monitor `console.error()` logs for API failures.

## Extending the Bot

### Adding New Behavior
1. **Global personality trait?** → Modify `botPersona` in `personality/botPersona.js`
2. **Per-user customization?** → Update relationship config via `setRelationship()` in `personality/relationships.js`
3. **New API integration?** → Create new module in `llm/` (follow `gemini.js` pattern: export single named function)
4. **New memory dimension?** → Add to context object or extend `relationships` structure

### Common Tasks
- **Change bot name:** Update `botPersona.name` (also update Discord bot username for consistency)
- **Adjust context window:** Change `MAX_MESSAGES` in `memory/context.js`
- **Add LLM fallback:** Modify `generateReply()` error handling in `index.js`
- **Per-guild settings:** Extend relationship object or create `guilds.js` module (keyed by guildId)

## Code Style & Conventions

- **Module exports:** Single default export or named exports, no mixing
- **Function naming:** Verb-first (`getContext`, `buildPrompt`, `generateReply`)
- **Nullish coalescing:** Use `??` for defaults (see `memory.js` and `relationships.js`)
- **Error handling:** Catch at `index.js` message handler, log to console, reply with fallback message
- **No persistence:** All data in memory—consider adding `.json` file persistence if relationships need to survive restarts

## Discord.js Integration Notes

- **Intents used:** `Guilds`, `GuildMessages`, `MessageContent` (required for reading message text)
- **Partials:** `Channel` (for DM handling, though bot currently ignores DMs)
- **Message mentions check:** Always verify `message.mentions.has(client.user)` before processing
- **Reply method:** Use `message.reply()` not `message.channel.send()` to maintain thread context
