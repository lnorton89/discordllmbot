# MVP Roadmap for DiscordLLMBot

## Current State Assessment

### What's Working
✅ Core message pipeline (Discord → Gemini → Reply)  
✅ Persona system (botPersona.js)  
✅ Per-user relationship customization  
✅ Basic error fallback message  
✅ In-memory message context (12-message window)  

### Critical Gaps (MVP Blockers)

#### Tier 1: Must Have for Production
1. **Data Persistence** (Context, Relationships)
   - Context loses all history on restart
   - Relationships not persisted
   - **Impact:** Users experience broken history, relationships reset
   - **Scope:** Add JSON file + auto-save on shutdown

2. **Environment Validation**
   - No check for required env vars at startup
   - Silent failures if DISCORD_TOKEN or GEMINI_API_KEY missing
   - **Impact:** Cryptic errors, hard to debug
   - **Scope:** Add startup validation check

3. **Rate Limiting & Retry Logic**
   - No 429 (rate limit) handling from Gemini
   - No exponential backoff
   - **Impact:** Bot fails under load, poor user experience
   - **Scope:** Implement retry with exponential backoff

4. **Message Length Validation**
   - No check for Discord's 2000-char limit
   - Long replies crash without feedback
   - **Impact:** Bot fails on verbose Gemini responses
   - **Scope:** Truncate/split responses

5. **Error Specificity**
   - All errors → generic "brain lag" message
   - Can't distinguish API errors from timeout from invalid prompt
   - **Impact:** Hard to troubleshoot, poor debugging
   - **Scope:** Structured error handling by type

#### Tier 2: Important for MVP Quality
6. **Typing Indicator**
   - No "bot is typing..." while waiting for Gemini
   - **Impact:** Users think bot is broken (waiting 2-10s with no feedback)
   - **Scope:** `message.channel.sendTyping()` before API call

7. **Structured Logging**
   - Only console.error() called
   - No request tracking, no timestamps, no severity levels
   - **Impact:** Can't track what went wrong in production
   - **Scope:** Add basic logger with timestamp + level

8. **Configuration per Guild**
   - No way to customize context window size per guild
   - No per-guild bot behavior settings
   - **Impact:** One-size-fits-all, limits extensibility
   - **Scope:** Add guild config system (optional for MVP v1)

9. **Graceful Shutdown**
   - No cleanup on SIGTERM/SIGINT
   - Relationships not persisted before exit
   - **Impact:** Data loss on restart, doesn't respect container stop signals
   - **Scope:** Add shutdown handler

10. **README & Setup Instructions**
    - No documentation for setup/deployment
    - **Impact:** Hard for others (or you) to onboard
    - **Scope:** Add README with quick start

#### Tier 3: Nice to Have (Post-MVP)
- Prompt caching to reduce API calls
- Usage analytics/stats tracking
- Content filtering for nsfw/harmful
- Multi-model support (fallback to different LLM)
- Unit tests + integration tests
- Docker compose for local dev
- Message editing capabilities
- Reaction-based commands

---

## Recommended MVP Implementation Plan

### Phase 1: Critical Stability (2-3 hours)
**Priority:** Prevent data loss + handle errors gracefully

**Tasks:**
1. Add startup validation (❌→✅ all env vars present)
2. Add JSON file persistence:
   - `data/relationships.json` (save on change)
   - `data/contexts.json` (auto-save every 60s)
   - Load on startup
3. Add proper error handling with error types
4. Add typing indicator during API call
5. Add message length validation (split if >2000 chars)

**Files to create:**
- `src/storage/persistence.js` — Load/save JSON files
- `src/config/validation.js` — Startup checks
- `src/utils/logger.js` — Structured logging

**Testing:** Manual via Discord server

### Phase 2: Reliability (1-2 hours)
**Priority:** Make bot reliable under stress

**Tasks:**
1. Implement exponential backoff for Gemini API (3 retries)
2. Add graceful shutdown handler (SIGTERM, save all data)
3. Improve logging (all major operations timestamped)
4. Add response time tracking

**Files to modify:**
- `src/llm/gemini.js` — Add retry logic
- `src/index.js` — Add shutdown handler

### Phase 3: Extensibility (1 hour)
**Priority:** Set up for future features

**Tasks:**
1. Add guild-level config system (optional context size, response style)
2. Add helper function to update relationships easily
3. Clean up prompt.js to handle optional relationship fields

**Files to create:**
- `src/config/guilds.js` — Per-guild settings
- `src/utils/relationshipHelper.js` — Easy relationship updates

### Phase 4: Documentation (30 min)
**Priority:** Help users get started

**Tasks:**
1. Create README with:
   - Quick start (env vars, npm start)
   - How to customize personality
   - How to set per-user relationships
   - Troubleshooting guide
2. Add JSDoc comments to all exported functions

**Files to create:**
- `README.md`

---

## File Structure After Phase 2

```
src/
  index.js                    # Main event loop + graceful shutdown
  llm/
    gemini.js                 # API calls + retry logic
  memory/
    context.js                # In-memory context (with persistence hooks)
  storage/
    persistence.js            # NEW: Load/save JSON blobs
  config/
    validation.js             # NEW: Startup validation
    guilds.js                 # NEW (Phase 3): Per-guild config
  personality/
    botPersona.js
    relationships.js
  utils/
    prompt.js
    logger.js                 # NEW: Structured logging
    relationshipHelper.js      # NEW (Phase 3): CRUD helpers

data/
  relationships.json          # NEW (Phase 1)
  contexts/
    {channelId}.json          # NEW (Phase 1)
```

---

## Key Design Decisions

### Storage Format
- **Simple JSON files** (not SQLite/Postgres) — matches "no external dependencies" ethos
- Separate files per channel context (easier to manage, parallel writes)
- Relationships as single file (small, updated less frequently)
- Auto-load on startup, auto-save on change (relationships) or timer (context)

### Error Handling Strategy
- Create error types: `GeminiAPIError`, `RateLimitError`, `ValidationError`
- Retry only on retryable errors (5xx, rate limits, timeouts)
- Don't retry on auth failures or malformed requests
- Log all errors with context

### Logging Approach
- `logger.info()` for startup, shutdown, major events
- `logger.warn()` for handled errors, rate limits
- `logger.error()` for unhandled errors
- Include timestamp + severity for all logs

---

## Estimated Total Time: 4-6 hours

**Quick wins (start here):**
1. Startup validation (15 min)
2. Typing indicator (5 min)
3. Message truncation (15 min)
4. Logger utility (30 min)
5. File persistence (90 min)
6. Graceful shutdown (20 min)
7. Retry logic (45 min)
8. README (30 min)

**Total: ~4.5 hours for solid MVP**

---

## Questions for You

1. **Data Location**: Store JSON files in `data/` folder at project root, or elsewhere?
2. **Context Persistence**: Save every message, or periodic snapshots? (I recommend: save periodically, load on startup)
3. **Guild Config Priority**: Skip for Phase 1, or add minimal version (just context window size)?
4. **Logging Format**: Console-only, or also to file? JSON format or plain text?
5. **Start Priority**: Begin with Phase 1, or focus on a specific gap first?
