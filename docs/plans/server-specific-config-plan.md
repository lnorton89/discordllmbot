# Server-Specific Configuration Plan

## Problem Statement

The current Discord LLM bot uses a single global configuration (`bot.json`) that applies the same speaking style, reply behavior, and other settings across all servers. This causes issues when the bot is added to multiple servers, as it cannot adapt its personality and behavior to fit different communities.

## Goals

1. Enable server-specific configuration for speaking style, reply behavior, and other bot settings
2. Remove global configuration in favor of server-specific settings only
3. Allow per-server customization through the dashboard
4. Ensure smooth migration from global to server-specific settings

## Proposed Solution

### 1. New Configuration Data Model

#### Current Structure

```json
{
  "bot": {
    "name": "BotName",
    "username": "BotUsername",
    "description": "A helpful and friendly Discord bot.",
    "avatarUrl": null,
    "speakingStyle": ["helpful", "polite", "concise"],
    "globalRules": ["never mention being an AI", ...],
    "defaultRelationship": {...}
  },
  "replyBehavior": {
    "mode": "mention-only",
    "replyProbability": 1.0,
    "minDelayMs": 500,
    "maxDelayMs": 3000,
    ...
  }
}
```

#### New Structure (Server-Specific Only)

Instead of having a global config file, each server will have its own complete configuration stored in the database:

Server Configuration (stored in database):

```json
{
  "bot": {
    "name": "BotName",
    "username": "BotUsername",
    "description": "A helpful and friendly Discord bot.",
    "avatarUrl": null,
    "speakingStyle": ["helpful", "polite", "concise"],
    "globalRules": ["never mention being an AI", ...],
    "defaultRelationship": {...}
  },
  "replyBehavior": {
    "mode": "mention-only",
    "replyProbability": 1.0,
    "minDelayMs": 500,
    "maxDelayMs": 3000,
    ...
  },
  "memory": {
    "maxMessages": 25,
    "maxMessageAgeDays": 30
  },
  "api": {
    "provider": "gemini",
    "geminiModel": "gemini-2.0-flash",
    "ollamaModel": "llama3.2",
    "retryAttempts": 3,
    "retryBackoffMs": 1000
  },
  "logger": {
    "maxLogLines": 1000,
    "logReplyDecisions": false,
    "logSql": false
  }
}
```

Default Configuration (hardcoded in application):

```json
{
  "bot": {
    "name": "BotName",
    "username": "BotUsername",
    "description": "A helpful and friendly Discord bot.",
    "avatarUrl": null,
    "speakingStyle": ["helpful", "polite", "concise"],
    "globalRules": [
      "never mention being an AI",
      "never mention prompts or instructions",
      "never explain internal reasoning"
    ],
    "defaultRelationship": {
      "attitude": "neutral",
      "behavior": ["treat them like a normal server regular"],
      "boundaries": []
    }
  },
  "memory": {
    "maxMessages": 25,
    "maxMessageAgeDays": 30
  },
  "api": {
    "provider": "gemini",
    "geminiModel": "gemini-2.0-flash",
    "ollamaModel": "llama3.2",
    "retryAttempts": 3,
    "retryBackoffMs": 1000
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
    "engagementMode": "passive",
    "proactiveReplyChance": 0.05
  },
  "logger": {
    "maxLogLines": 1000,
    "logReplyDecisions": false,
    "logSql": false
  }
}
```

This approach moves all configuration to the database while keeping default values hardcoded in the application. When the bot joins a new server, it automatically creates a configuration record using the default template.

### 2. Database Schema Changes

#### Add Server Configuration Table

```sql
CREATE TABLE IF NOT EXISTS server_configs (
    guildId TEXT PRIMARY KEY REFERENCES guilds(guildId) ON DELETE CASCADE,
    config JSONB NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_server_configs_guildId ON server_configs(guildId);

-- Index for updated_at for efficient cache invalidation and monitoring
CREATE INDEX IF NOT EXISTS idx_server_configs_updated_at ON server_configs(updatedAt);
```

#### Update Database Setup Function

Modify `shared/storage/database.js` to include the new table creation:

```javascript
// Add to the queries array in setupSchema():
`CREATE TABLE IF NOT EXISTS server_configs (
    guildId TEXT PRIMARY KEY REFERENCES guilds(guildId) ON DELETE CASCADE,
    config JSONB NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);`,
// Index for faster lookups
`CREATE INDEX IF NOT EXISTS idx_server_configs_guildId ON server_configs(guildId);`,
// Index for cache invalidation and monitoring
`CREATE INDEX IF NOT EXISTS idx_server_configs_updated_at ON server_configs(updatedAt);`,
```

#### Schema Best Practices Applied

- **JSONB over JSON**: Using JSONB for better performance and indexing capabilities
- **Foreign Key Constraint**: Properly references guilds table with cascade delete
- **Timestamps**: Includes both creation and update timestamps for audit and cache management
- **Indexes**: Proper indexing for efficient lookups by guildId and updatedAt
- **Constraints**: Primary key ensures each guild has at most one configuration

#### Add Database Functions

New functions to add to `shared/storage/persistence.js`:

```javascript
/**
 * Gets server-specific configuration
 * @param {string} guildId - The guild ID
 * @returns {Promise<Object|null>} Server config or null if not found
 */
export async function getServerConfig(guildId) {
  const db = await getDb();
  // Use prepared statement to prevent SQL injection
  const result = await db.query(
    "SELECT config, updatedAt FROM server_configs WHERE guildId = $1",
    [guildId],
  );
  return result.rows.length > 0 ? result.rows[0].config : null;
}

/**
 * Saves server-specific configuration with validation
 * @param {string} guildId - The guild ID
 * @param {Object} config - The server configuration
 * @returns {Promise<void>}
 */
export async function saveServerConfig(guildId, config) {
  const db = await getDb();
  // Validate config structure before saving to prevent malformed data
  if (!validateConfigStructure(config)) {
    throw new Error("Invalid configuration structure");
  }

  await db.query(
    `
        INSERT INTO server_configs (guildId, config, updatedAt)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (guildId)
        DO UPDATE SET config = $2, updatedAt = CURRENT_TIMESTAMP
    `,
    [guildId, config],
  );
}

/**
 * Validates the configuration structure to prevent unsafe data
 * @param {Object} config - The configuration to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateConfigStructure(config) {
  // Basic validation to ensure config is an object and has expected structure
  if (!config || typeof config !== "object") {
    return false;
  }

  // Add more specific validation as needed
  // For example, check that sensitive fields aren't included
  // or that certain required fields exist

  return true;
}

/**
 * Deletes server-specific configuration (reset to default)
 * @param {string} guildId - The guild ID
 * @returns {Promise<void>}
 */
export async function deleteServerConfig(guildId) {
  const db = await getDb();
  await db.query("DELETE FROM server_configs WHERE guildId = $1", [guildId]);
}

/**
 * Gets all server configurations with pagination
 * @param {number} offset - Number of records to skip
 * @param {number} limit - Maximum number of records to return
 * @returns {Promise<Array>} Array of server configs with guild info
 */
export async function getAllServerConfigs(offset = 0, limit = 100) {
  const db = await getDb();
  const result = await db.query(
    `
        SELECT sc.guildId, sc.config, g.guildName, sc.updatedAt
        FROM server_configs sc
        JOIN guilds g ON sc.guildId = g.guildId
        ORDER BY sc.updatedAt DESC
        LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  );
  return result.rows;
}

/**
 * Gets recently updated server configurations (for cache invalidation)
 * @param {Date} since - Only return configs updated since this date
 * @returns {Promise<Array>} Array of recently updated server configs
 */
export async function getRecentlyUpdatedConfigs(since) {
  const db = await getDb();
  const result = await db.query(
    `
        SELECT sc.guildId, sc.updatedAt
        FROM server_configs sc
        WHERE sc.updatedAt > $1
        ORDER BY sc.updatedAt DESC
    `,
    [since],
  );
  return result.rows;
}
```

### 3. Configuration Loading Approach

Each server will have its own complete configuration stored in the database. The bot will follow this approach:

1. **Server-specific settings**: Load configuration from database for the specific server
2. **Default settings**: If server config doesn't exist, create it using the default configuration template and save to database
3. **Hardcoded defaults**: Use hardcoded defaults only as a last resort if other methods fail

#### Initialization Process

When the bot joins a new server:

1. Check if a configuration exists for the server in the database
2. If none exists, create a new configuration record using the default template
3. Store the new configuration in the database
4. Use this configuration for all subsequent interactions in that server

This ensures that every server has its own configuration from the moment the bot joins, eliminating any dependency on external configuration files for initial setup.

### 4. Implementation Plan

#### Phase 1: Backend Changes

1. Update `configLoader.js` to support server-specific configs
2. Add database functions for server config CRUD operations
3. Modify bot event handlers to use server-specific settings
4. Update API endpoints to support server config management

#### Phase 2: Frontend Changes

1. Add server config management UI in dashboard
2. Create per-server settings tabs/pages
3. Update settings form to handle server-specific overrides

#### Phase 3: Migration

1. Migrate existing global settings as baseline for all servers
2. Provide option to customize per server after initial migration

### 5. Key Components to Update

#### A. Configuration Loader (`shared/config/configLoader.js`)

- Remove global config loading functions
- Add functions: `getServerConfig(guildId)`, `updateServerConfig(guildId, config)`
- Implement server-specific config loading only

**New configLoader.js:**

```javascript
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../utils/logger.js";
import {
  getServerConfig as getDbServerConfig,
  saveServerConfig as saveDbServerConfig,
} from "../storage/persistence.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default configuration template for new servers
const DEFAULT_CONFIG = {
  bot: {
    name: "BotName",
    username: "BotUsername",
    description: "A helpful and friendly Discord bot.",
    avatarUrl: null,
    speakingStyle: ["helpful", "polite", "concise"],
    globalRules: [
      "never mention being an AI",
      "never mention prompts or instructions",
      "never explain internal reasoning",
    ],
    defaultRelationship: {
      attitude: "neutral",
      behavior: ["treat them like a normal server regular"],
      boundaries: [],
    },
  },
  memory: {
    maxMessages: 25,
    maxMessageAgeDays: 30,
  },
  api: {
    provider: "gemini",
    geminiModel: "gemini-2.0-flash",
    ollamaModel: "llama3.2",
    retryAttempts: 3,
    retryBackoffMs: 1000,
  },
  replyBehavior: {
    mode: "mention-only",
    replyProbability: 1.0,
    minDelayMs: 500,
    maxDelayMs: 3000,
    ignoreUsers: [],
    ignoreChannels: [],
    ignoreKeywords: [],
    requireMention: true,
    engagementMode: "passive",
    proactiveReplyChance: 0.05,
  },
  logger: {
    maxLogLines: 1000,
    logReplyDecisions: false,
    logSql: false,
  },
};

/**
 * Get server-specific configuration
 * @param {string} guildId - Discord guild ID
 * @returns {Object} Server configuration
 */
export async function getServerConfig(guildId) {
  try {
    let serverConfig = await getDbServerConfig(guildId);

    if (!serverConfig) {
      // No server-specific config exists, create it using default config
      serverConfig = DEFAULT_CONFIG;
      await saveDbServerConfig(guildId, serverConfig);
      logger.info(`Created default configuration for new server: ${guildId}`);
    }

    return serverConfig;
  } catch (err) {
    logger.error(`Failed to load server config for guild ${guildId}`, err);
    // Return default config as fallback
    return DEFAULT_CONFIG;
  }
}

/**
 * Update server-specific configuration
 * @param {string} guildId - Discord guild ID
 * @param {Object} newConfig - New server configuration
 */
export async function updateServerConfig(guildId, newConfig) {
  try {
    await saveDbServerConfig(guildId, newConfig);
    logger.info(`Updated server config for guild ${guildId}`);
  } catch (err) {
    logger.error(`Failed to update server config for guild ${guildId}`, err);
    throw err;
  }
}

/**
 * Get bot configuration for specific server
 * @param {string} guildId - Discord guild ID
 * @returns {Object} Bot configuration
 */
export async function getBotConfig(guildId) {
  const config = await getServerConfig(guildId);
  return config.bot;
}

/**
 * Get reply behavior for specific server
 * @param {string} guildId - Discord guild ID
 * @returns {Object} Reply behavior configuration
 */
export async function getReplyBehavior(guildId) {
  const config = await getServerConfig(guildId);
  return config.replyBehavior || {};
}

/**
 * Get memory settings for specific server
 * @param {string} guildId - Discord guild ID
 * @returns {Object} Memory configuration
 */
export async function getMemoryConfig(guildId) {
  const config = await getServerConfig(guildId);
  return config.memory || {};
}

/**
 * Get API settings for specific server
 * @param {string} guildId - Discord guild ID
 * @returns {Object} API configuration
 */
export async function getApiConfig(guildId) {
  const config = await getServerConfig(guildId);
  return config.api || {};
}

/**
 * Get logger settings for specific server
 * @param {string} guildId - Discord guild ID
 * @returns {Object} Logger configuration
 */
export async function getLoggerConfig(guildId) {
  const config = await getServerConfig(guildId);
  return config.logger || {};
}

/**
 * Clear cache when configuration is updated
 * @param {string} guildId - Discord guild ID
 */
export function clearServerConfigCache(guildId) {
  serverConfigCache.delete(guildId);
}

// Remove the old loadConfig and related functions since we're no longer using global config
```

#### B. Message Handler (`bot/src/events/messageCreate.js`)

- Update to use `getServerConfig(message.guild.id)` instead of global config
- Modify prompt building to incorporate server-specific rules and speaking styles

**Updated messageCreate.js:**

```javascript
// Import the new server config functions
import {
  getBotConfig,
  getApiConfig,
  getReplyBehavior,
  getMemoryConfig,
} from "../../../shared/config/configLoader.js";

export async function handleMessageCreate(message, client) {
  if (message.author.bot) return;
  if (!message.guild) return;

  const cleanMessage = message.content.replace(/<@!?\d+>/g, "").trim();

  // Get server-specific configs
  const botConfig = await getBotConfig(message.guild.id);
  const replyBehavior = await getReplyBehavior(message.guild.id);

  // ... rest of the function using server-specific configs ...

  // Check if we should reply using server-specific reply behavior
  const isMentioned = message.mentions.has(client.user);
  const replyDecision = shouldReply({
    message,
    isMentioned,
    replyBehavior,
    relationship,
    context,
    botName: botConfig.name,
  });

  // ... rest of the function continues normally ...
}
```

#### C. Reply Decider (`bot/src/core/replyDecider.js`)

- Update to accept the pre-fetched `replyBehavior` object as a parameter
- This makes the function "pure" by removing I/O and avoids redundant database/cache lookups

**Updated replyDecider.js:**

```javascript
// The function now accepts the replyBehavior object directly.
// It should not perform its own data fetching.
export function shouldReply({
  message,
  isMentioned,
  replyBehavior,
  relationship = {},
  context = [],
  botName = "",
}) {
  // ... rest of the function logic remains the same but uses the passed-in replyBehavior object
}
```

#### D. API Server (`bot/src/api/server.js`)

- Add endpoints for server config management:
  - `GET /api/servers/:guildId/config` - Get server-specific config
  - `POST /api/servers/:guildId/config` - Update server-specific config
  - `DELETE /api/servers/:guildId/config` - Reset server config to default

**New API endpoints:**

```javascript
// Add to the API server routes
app.get("/api/servers/:guildId/config", async (req, res) => {
  try {
    const { guildId } = req.params;
    const serverConfig = await getServerConfig(guildId);
    res.json(serverConfig);
  } catch (err) {
    logger.error("Failed to get server config", err);
    res.status(500).json({ error: "Failed to get server config" });
  }
});

app.post("/api/servers/:guildId/config", async (req, res) => {
  try {
    const { guildId } = req.params;
    const newConfig = req.body;

    // Validate that it's an object
    if (!newConfig || typeof newConfig !== "object") {
      return res.status(400).json({ error: "Invalid config format" });
    }

    await updateServerConfig(guildId, newConfig);
    // Clear cache to ensure fresh config is loaded on next access
    clearServerConfigCache(guildId);
    res.json({ message: "Server config updated successfully" });
  } catch (err) {
    logger.error("Failed to update server config", err);
    res.status(500).json({ error: "Failed to update server config" });
  }
});

// The DELETE endpoint now truly deletes the server's custom configuration record.
// On the next request, the configLoader will see no config exists and automatically
// create and save a new one from the default template. This is a cleaner RESTful approach.
app.delete("/api/servers/:guildId/config", async (req, res) => {
  try {
    const { guildId } = req.params;
    // Delete the specific configuration from the database
    await deleteServerConfig(guildId);
    // Clear cache to ensure the default is loaded on next access
    clearServerConfigCache(guildId);
    res.json({ message: "Server config reset to default." });
  } catch (err) {
    logger.error("Failed to reset server config", err);
    res.status(500).json({ error: "Failed to reset server config" });
  }
});
```

#### E. Dashboard Components

- Remove global settings management for server-specific fields (since we're removing global config)
- Consolidate all server-specific configuration management into the `Servers.jsx` component
- Add a "Server Config" tab to the expanded view of each server in the list

### 6. Dashboard UI Changes

#### Servers Page Enhancement

The `Servers.jsx` component will now be the central hub for all server management, including detailed configuration.

**Enhanced Servers Component (`dashboard/src/components/Servers.jsx`):**

```jsx
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Snackbar,
  Alert,
  Chip,
  Tooltip,
  Avatar,
  Tabs,
  Tab,
  TablePagination,
  Card,
  CardContent,
  CardHeader,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from "@mui/material";
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AddLink as AddLinkIcon,
  People as PeopleIcon,
  Forum as ForumIcon,
  Settings as SettingsIcon,
  Tune as TuneIcon,
  Cached as CachedIcon,
} from "@mui/icons-material";

function Servers() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [botInfo, setBotInfo] = useState(null);
  const [expandedServerId, setExpandedServerId] = useState(null);
  const [relationships, setRelationships] = useState({});
  const [loadingRelationships, setLoadingRelationships] = useState({});
  const [channels, setChannels] = useState({});
  const [loadingChannels, setLoadingChannels] = useState({});
  const [serverConfigs, setServerConfigs] = useState({}); // Store server-specific configs
  const [loadingConfigs, setLoadingConfigs] = useState({});
  const [savingConfigs, setSavingConfigs] = useState({});
  const [editingUser, setEditingUser] = useState(null);
  const [editData, setEditData] = useState(null);
  const [serverTabs, setServerTabs] = useState({}); // Track tab state per server
  const [message, setMessage] = useState({
    open: false,
    text: "",
    severity: "success",
  });

  // Fetch server configurations
  const fetchServerConfig = async (guildId) => {
    if (loadingConfigs[guildId]) return;

    setLoadingConfigs((prev) => ({ ...prev, [guildId]: true }));
    try {
      const res = await axios.get(`/api/servers/${guildId}/config`);
      setServerConfigs((prev) => ({ ...prev, [guildId]: res.data }));
    } catch (err) {
      console.error(`Failed to fetch config for guild ${guildId}`, err);
    } finally {
      setLoadingConfigs((prev) => ({ ...prev, [guildId]: false }));
    }
  };

  // Debounced update function
  const updateServerConfigDebounced = (guildId, newConfig) => {
    setServerConfigs((prev) => ({ ...prev, [guildId]: newConfig }));
    setSavingConfigs((prev) => ({ ...prev, [guildId]: true }));

    if (debounceTimers.current[guildId]) {
      clearTimeout(debounceTimers.current[guildId]);
    }

    debounceTimers.current[guildId] = setTimeout(async () => {
      try {
        await axios.post(`/api/servers/${guildId}/config`, newConfig);
      } catch (err) {
        console.error("Failed to save server config", err);
      } finally {
        setSavingConfigs((prev) => ({ ...prev, [guildId]: false }));
      }
    }, 1500);
  };

  // Reset server to default configuration
  const resetToDefault = async (guildId) => {
    if (
      window.confirm(
        "Are you sure you want to reset this server's configuration to default?",
      )
    ) {
      try {
        await axios.delete(`/api/servers/${guildId}/config`);
        // Remove from cache to force reload of default
        setServerConfigs((prev) => {
          const newState = { ...prev };
          delete newState[guildId];
          return newState;
        });
        setMessage({
          open: true,
          text: "Server configuration reset to default.",
          severity: "info",
        });
      } catch (err) {
        console.error("Failed to reset server config", err);
        setMessage({
          open: true,
          text: "Error resetting server configuration.",
          severity: "error",
        });
      }
    }
  };

  // Handle quick toggle for common settings
  const toggleQuickSetting = async (guildId, settingPath, value) => {
    const currentConfig =
      serverConfigs[guildId] || (await fetchDefaultConfig());
    const newConfig = updateNestedValue(currentConfig, settingPath, value);
    await updateServerConfig(guildId, newConfig);
  };

  // Helper function to update nested config values
  const updateNestedValue = (obj, path, value) => {
    const keys = path.split(".");
    const result = JSON.parse(JSON.stringify(obj)); // Deep clone
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...current[keys[i]] };
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    return result;
  };

  // Fetch default config for new servers
  const fetchDefaultConfig = async () => {
    try {
      const res = await axios.get("/api/config"); // Get default template
      return res.data;
    } catch (err) {
      console.error("Failed to fetch default config", err);
      return {}; // Return empty object as fallback
    }
  };

  // ... existing fetchServers, fetchRelationships, fetchChannels functions ...

  const toggleExpand = (guildId) => {
    if (expandedServerId === guildId) {
      setExpandedServerId(null);
    } else {
      setExpandedServerId(guildId);
      setServerTabs((prev) => ({ ...prev, [guildId]: 0 }));
      // Pre-fetch data when expanding
      if (!relationships[guildId] && !loadingRelationships[guildId]) {
        fetchRelationships(guildId);
      }
      if (!channels[guildId] && !loadingChannels[guildId]) {
        fetchChannels(guildId);
      }
      if (!serverConfigs[guildId] && !loadingConfigs[guildId]) {
        fetchServerConfig(guildId);
      }
    }
  };

  const handleTabChange = (guildId, tabIndex) => {
    setServerTabs((prev) => ({ ...prev, [guildId]: tabIndex }));
  };

  // Close snackbar
  const handleCloseSnack = () => {
    setMessage({ ...message, open: false });
  };

  // ... existing JSX rendering code ...
}

// Row Component for each server in the table
function Row({
  server,
  expanded,
  onExpand,
  onLeave,
  onEditUser,
  onIgnoreToggle,
  relationships,
  loadingRelationships,
  channels,
  loadingChannels,
  onChannelToggle,
  serverConfigs,
  loadingConfigs,
  onConfigUpdate,
  onResetToDefault,
  onQuickToggle,
  serverTabs,
  onTabChange,
}) {
  const isOpen = expanded === server.id;
  const currentTab = serverTabs[server.id] || 0;
  const serverConfig = serverConfigs[server.id];
  const isConfigLoading = loadingConfigs[server.id];

  const handleTabChange = (event, newValue) => {
    onTabChange(server.id, newValue);
  };

  return (
    <>
      <TableRow
        sx={{
          "& > *": { borderBottom: "unset" },
          cursor: "pointer",
          "&:hover": { backgroundColor: "action.hover" },
        }}
        onClick={() => onExpand(server.id)}
      >
        {/* Existing row content */}
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onExpand(server.id);
            }}
          >
            {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          {/* Server name and info */}
        </TableCell>
        <TableCell align="right">{/* Join date */}</TableCell>
        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={() => onLeave(server.id)}
          >
            Leave
          </Button>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Tabs
                value={currentTab}
                onChange={handleTabChange}
                sx={{ mb: 2 }}
              >
                <Tab
                  icon={<PeopleIcon />}
                  iconPosition="start"
                  label="User Relationships"
                />
                <Tab
                  icon={<ForumIcon />}
                  iconPosition="start"
                  label="Channel Monitoring"
                />
                <Tab
                  icon={<SettingsIcon />}
                  iconPosition="start"
                  label="Server Config"
                />
              </Tabs>

              {/* User Relationships Tab Panel */}
              <Box hidden={currentTab !== 0}>
                {/* Existing relationships content */}
              </Box>

              {/* Channel Monitoring Tab Panel */}
              <Box hidden={currentTab !== 1}>
                {/* Existing channels content */}
              </Box>

              {/* Server Configuration Tab Panel */}
              <Box hidden={currentTab !== 2}>
                {isConfigLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                    <CircularProgress size={24} />
                    <Typography
                      variant="body2"
                      sx={{ ml: 2, alignSelf: "center" }}
                    >
                      Loading configuration...
                    </Typography>
                  </Box>
                ) : serverConfig ? (
                  <Card>
                    <CardHeader
                      title="Server Configuration"
                      subheader="Customize bot settings for this server"
                      action={
                        <Button
                          variant="outlined"
                          color="warning"
                          size="small"
                          onClick={() => onResetToDefault(server.id)}
                          startIcon={<CachedIcon />}
                        >
                          Reset to Default
                        </Button>
                      }
                    />
                    <CardContent>
                      <Grid container spacing={3}>
                        {/* Quick Configuration Section */}
                        <Grid item xs={12}>
                          <Typography variant="h6" gutterBottom>
                            Quick Settings
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={6} sm={3}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={
                                      serverConfig.replyBehavior?.mode ===
                                      "active"
                                    }
                                    onChange={(e) =>
                                      onQuickToggle(
                                        server.id,
                                        "replyBehavior.mode",
                                        e.target.checked
                                          ? "active"
                                          : "mention-only",
                                      )
                                    }
                                    color="primary"
                                  />
                                }
                                label="Active Mode"
                              />
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={
                                      serverConfig.replyBehavior
                                        ?.requireMention !== false
                                    }
                                    onChange={(e) =>
                                      onQuickToggle(
                                        server.id,
                                        "replyBehavior.requireMention",
                                        e.target.checked,
                                      )
                                    }
                                    color="primary"
                                  />
                                }
                                label="Require Mention"
                              />
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <FormControl fullWidth>
                                <InputLabel>Reply Probability</InputLabel>
                                <Select
                                  value={
                                    serverConfig.replyBehavior
                                      ?.replyProbability || 1.0
                                  }
                                  onChange={(e) =>
                                    onQuickToggle(
                                      server.id,
                                      "replyBehavior.replyProbability",
                                      e.target.value,
                                    )
                                  }
                                  label="Reply Probability"
                                >
                                  <MenuItem value={0.1}>10%</MenuItem>
                                  <MenuItem value={0.3}>30%</MenuItem>
                                  <MenuItem value={0.5}>50%</MenuItem>
                                  <MenuItem value={0.8}>80%</MenuItem>
                                  <MenuItem value={1.0}>100%</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <FormControl fullWidth>
                                <InputLabel>Engagement Mode</InputLabel>
                                <Select
                                  value={
                                    serverConfig.replyBehavior
                                      ?.engagementMode || "passive"
                                  }
                                  onChange={(e) =>
                                    onQuickToggle(
                                      server.id,
                                      "replyBehavior.engagementMode",
                                      e.target.value,
                                    )
                                  }
                                  label="Engagement Mode"
                                >
                                  <MenuItem value="passive">Passive</MenuItem>
                                  <MenuItem value="active">Active</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                          </Grid>
                        </Grid>

                        {/* Full Configuration Link */}
                        <Grid item xs={12}>
                          <Button
                            variant="contained"
                            fullWidth
                            onClick={() =>
                              (window.location.href = `/server-config/${server.id}`)
                            }
                            startIcon={<TuneIcon />}
                          >
                            View Full Configuration
                          </Button>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ) : (
                  <Alert severity="info">
                    No custom configuration set for this server. Using default
                    settings.
                  </Alert>
                )}
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default Servers;
```
