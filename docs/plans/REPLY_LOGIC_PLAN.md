# Reply Logic & Configuration Plan

## Current State: Simple Mention-Only Model

### How It Currently Works
```
Message arrives → Check: Is it from a bot? → Check: In a guild? → Check: Bot mentioned?
                    (ignore)                    (ignore)           (process)
                                                                       ↓
                                            Load relationship + context → Generate reply
```

### Current Decision Flow
1. **WHO triggers a response?** Only messages with bot mention
2. **WHO does it reply to?** Always the message author (threaded reply)
3. **WHEN does it reply?** Immediately (randomized delay 0-2s)
4. **WHERE can it reply?** Any guild channel (not DMs, not other bots)

### Limitations
- ❌ Bot never initiates conversation
- ❌ Always replies (no "ignore" strategy)
- ❌ No off/on switch per guild/channel
- ❌ No probability-based responses (feels robotic)
- ❌ No ignore lists (users/channels)
- ❌ No context-aware reply decisions

---

## Proposed Configuration System: Reply Strategies

### New Config Fields (Add to `bot.json`)

```json
{
  "bot": {
    ...existing fields...
  },
  "replyBehavior": {
    "mode": "mention-only",
    "replyProbability": 1.0,
    "minDelayMs": 500,
    "maxDelayMs": 3000,
    "ignoreUsers": [],
    "ignoreChannels": [],
    "ignoreKeywords": [],
    "requireMention": true,
    "engagementMode": "passive"
  }
}
```

### Configuration Options Explained

#### 1. `mode` (Default: `"mention-only"`)
Controls **when** the bot decides to reply:

```
"mention-only"        → Only when @mentioned (current behavior)
"active"              → Mentions + will occasionally join convos
"passive"             → Mentions only, never initiates
"disabled"            → Silently logs but never replies
```

#### 2. `replyProbability` (Default: `1.0`)
Controls **how often** bot replies when triggered:

```
1.0    → Always reply when mentioned (100%)
0.8    → Reply to 80% of mentions (feels selective)
0.5    → Reply to 50% (very selective, "busy" vibe)
0.0    → Never reply (disabled)
```

**Use case:** Higher servers might want `0.7` so bot doesn't seem spammy.

#### 3. `minDelayMs` / `maxDelayMs` (Default: `500` / `3000`)
Human-like response timing:

```
Current: 500-2000ms (feels quick)
Option A: 1000-5000ms (deliberate, thinking)
Option B: 2000-8000ms (slow, distracted)
```

**Use case:** Different personalities need different speeds.

#### 4. `ignoreUsers` (Default: `[]`)
User IDs to never reply to:

```json
"ignoreUsers": ["123456789", "987654321"]
```

**Use case:** Mute specific users or bots.

#### 5. `ignoreChannels` (Default: `[]`)
Channel IDs where bot stays silent:

```json
"ignoreChannels": ["#spam", "#commands"]
```

**Use case:** Don't reply in off-topic channels.

#### 6. `ignoreKeywords` (Default: `[]`)
Words/phrases that trigger no reply:

```json
"ignoreKeywords": ["test", "bot commands", "debug"]
```

**Use case:** Avoid replying to meta discussions.

#### 7. `requireMention` (Default: `true`)
Can the bot reply without being mentioned?

```
true   → Must be @mentioned (current, safest)
false  → Can reply to context-relevant messages too
```

**Use case:** `false` allows bot to feel more natural (risky).

#### 8. `engagementMode` (Default: `"passive"`)
How proactively does bot participate?

```
"passive"    → Only reply when mentioned
"natural"    → Might chime in on related topics (experimental)
"aggressive" → Frequently joins conversations (spam risk)
```

---

## Implementation Plan: 3-Phase Rollout

### Phase A: Configuration Layer (2 hours)
**Goal:** Make existing mention-only mode configurable

**Tasks:**
1. Update `src/config/bot.json` with `replyBehavior` section
2. Create `src/utils/replyDecider.js`:
   - Function `shouldReply(message, botConfig, relationship)` → boolean
   - Checks: mentions, ignores, probability, keyword filters
3. Create `src/utils/responseDelay.js`:
   - Function `calculateDelay(config)` → ms with jitter
4. Update `index.js` to use these functions

**Result:** Config-driven mention-only mode (backward compatible)

---

### Phase B: Advanced Strategies (3-4 hours)
**Goal:** Support context-aware reply decisions

**Tasks:**
1. Create `src/strategies/replyStrategies.js`:
   - `MentionOnlyStrategy` (current)
   - `ActiveStrategy` (mentions + some context)
   - `PassiveStrategy` (mentions only, stricter)
   - `DisabledStrategy` (silent observer)

2. Update `shouldReply()` to use strategy pattern
3. Add logic to detect:
   - Is bot mentioned? → definitely reply
   - Does message reference bot recently? → maybe reply
   - Is topic related to bot's interests? → maybe reply
   - Probability roll → apply replyProbability

**Result:** Bot feels more natural, less robotic

---

### Phase C: Per-Guild Overrides (2 hours)
**Goal:** Different servers can have different reply behaviors

**Tasks:**
1. Create `src/config/guilds.json`:
   ```json
   {
     "guild_id_1": {
       "replyBehavior": { override settings }
     },
     "guild_id_2": { override settings }
   }
   ```

2. Create `src/config/guildConfigLoader.js`
3. Update `shouldReply()` to check guild-specific overrides first
4. Update `.clinerules` to document per-guild config

**Result:** Admins can customize bot per server

---

## Example Behaviors (How Config Drives Replies)

### Config A: "Mention Only, Always"
```json
"replyBehavior": {
  "mode": "mention-only",
  "replyProbability": 1.0,
  "requireMention": true
}
```
**Behavior:** Replies instantly to every mention. Professional, reliable.

### Config B: "Busy Professional"
```json
"replyBehavior": {
  "mode": "passive",
  "replyProbability": 0.8,
  "minDelayMs": 2000,
  "maxDelayMs": 8000,
  "ignoreKeywords": ["test", "spam"],
  "requireMention": true
}
```
**Behavior:** Ignores 20% of mentions, slow response, feels thoughtful.

### Config C: "Chatty"
```json
"replyBehavior": {
  "mode": "active",
  "replyProbability": 1.0,
  "minDelayMs": 500,
  "maxDelayMs": 2000,
  "requireMention": false,
  "engagementMode": "natural"
}
```
**Behavior:** Jumps into conversations, quick responses, feels natural.

---

## Current Code Location Review

| Component | File | Current State |
|-----------|------|---------------|
| Reply trigger | `src/index.js` line ~55 | Hardcoded `message.mentions.has()` |
| Delay logic | `src/index.js` line ~68 | Random `Math.random() * 2000` |
| Decision logic | None | Doesn't exist |
| Configuration | `src/config/bot.json` | No `replyBehavior` section |

---

## What Should Be Built First?

**My recommendation: Phase A → Phase B → Phase C**

This gives you:
1. **Week 1 (Phase A):** Full control over current mention-based behavior
2. **Week 2 (Phase B):** Natural-feeling replies without spamming
3. **Week 3 (Phase C):** Multi-server customization

---

## Questions for You

1. **Start with Phase A?** (2-3 hour foundation layer)
2. **What's your primary goal?**
   - Keep bot mention-only but more configurable
   - Make it feel more naturally conversational
   - Different behavior per server
3. **Any specific ignore keywords/users?**
4. **Preferred response speed?** (min/max delay)

Ready to implement Phase A?
