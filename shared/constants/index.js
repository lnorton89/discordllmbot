/**
 * Shared Constants
 *
 * Centralized constants for use across bot, dashboard, and shared modules.
 *
 * @module shared/constants
 */
/**
 * OAuth & API Configuration
 */
export const OAUTH = {
    /** Qwen OAuth Device Authorization Flow */
    QWEN: {
        BASE_URL: 'https://chat.qwen.ai',
        DEVICE_CODE_ENDPOINT: '/api/v1/oauth2/device/code',
        TOKEN_ENDPOINT: '/api/v1/oauth2/token',
        DEFAULT_CLIENT_ID: 'f0304373b74a44d2b584a3fb70ca9e56',
        SCOPE: 'openid profile email model.completion',
        GRANT_TYPE: 'urn:ietf:params:oauth:grant-type:device_code',
        STATE_TTL_MS: 10 * 60 * 1000, // 10 minutes
    },
};
/**
 * Time Constants (in milliseconds)
 */
export const TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
};
/**
 * Cache Configuration
 */
export const CACHE = {
    CONFIG_TTL_MS: 5 * 60 * 1000, // 5 minutes
    SERVER_CONFIG_TTL_MS: 5 * 60 * 1000, // 5 minutes
};
/**
 * Database Defaults
 */
export const DATABASE = {
    CONNECTION_TIMEOUT_MS: 5000,
    IDLE_TIMEOUT_MS: 30000,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 2000,
};
/**
 * Logging Defaults
 */
export const LOGGING = {
    MAX_LOG_LINES: 1000,
    MAX_LOG_LINES_API: 500,
    MAX_LOG_LINES_DB: 200,
};
/**
 * LLM Provider Defaults
 */
export const LLM = {
    DEFAULT_PROVIDER: 'gemini',
    GEMINI: {
        DEFAULT_MODEL: 'gemini-2.0-flash',
        API_URL_BASE: 'https://generativelanguage.googleapis.com/v1beta/models',
    },
    OLLAMA: {
        DEFAULT_MODEL: 'llama3.2',
        DEFAULT_URL: 'http://localhost:11434',
    },
    QWEN: {
        DEFAULT_MODEL: 'qwen-plus',
    },
    RETRY: {
        DEFAULT_ATTEMPTS: 3,
        DEFAULT_BACKOFF_MS: 1000,
    },
};
/**
 * Memory & Context Defaults
 */
export const MEMORY = {
    DEFAULT_MAX_MESSAGES: 25,
    DEFAULT_MAX_MESSAGE_AGE_DAYS: 30,
};
/**
 * Sandbox Defaults
 */
export const SANDBOX = {
    ENABLED: false,
    TIMEOUT_MS: 30000,
    DEFAULT_IMAGE: 'alpine:latest',
    ALLOWED_COMMANDS: [
        'ps',
        'stats',
        'images',
        'top',
        'logs',
        'inspect',
        'version',
        'info',
        'df',
        'free',
        'uname',
    ],
};
/**
 * Discord Bot Defaults
 */
export const DISCORD = {
    BOT_PERMISSIONS: 274878229568,
    OAUTH_SCOPE: 'bot applications.commands',
    MAX_MESSAGE_LENGTH: 2000,
    MAX_EMBED_LENGTH: 4096,
};
/**
 * API & Server Defaults
 */
export const API = {
    DEFAULT_PORT: 3000,
    CORS_ORIGIN: '*',
    RATE_LIMIT: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: 100,
    },
};
/**
 * Environment Variable Names
 */
export const ENV = {
    DISCORD_TOKEN: 'DISCORD_TOKEN',
    DISCORD_CLIENT_ID: 'DISCORD_CLIENT_ID',
    DATABASE_URL: 'DATABASE_URL',
    GEMINI_API_KEY: 'GEMINI_API_KEY',
    OLLAMA_API_KEY: 'OLLAMA_API_KEY',
    OLLAMA_API_URL: 'OLLAMA_API_URL',
    QWEN_API_KEY: 'QWEN_API_KEY',
    QWEN_OAUTH_CLIENT_ID: 'QWEN_OAUTH_CLIENT_ID',
    API_PORT: 'API_PORT',
    VITE_API_URL: 'VITE_API_URL',
};
/**
 * URL Constants
 */
export const URLS = {
    /** Development URLs */
    DEV: {
        DASHBOARD: 'http://localhost:5173',
        API: 'http://localhost:3000',
        DOCS: 'http://localhost:5174',
        PGADMIN: 'http://localhost:5050',
    },
    /** Docker service URLs */
    DOCKER: {
        API: 'http://bot:3000',
        DASHBOARD: 'http://dashboard:5173',
    },
    /** LLM Provider URLs */
    LLM: {
        OLLAMA: 'http://localhost:11434',
    },
    /** Qwen OAuth URLs */
    QWEN: {
        BASE: 'https://chat.qwen.ai',
        PORTAL: 'https://portal.qwen.ai/v1',
        OAUTH_DEVICE_CODE: '/api/v1/oauth2/device/code',
        OAUTH_TOKEN: '/api/v1/oauth2/token',
    },
    /** Gemini API URLs */
    GEMINI: {
        BASE: 'https://generativelanguage.googleapis.com/v1beta/models',
    },
    /** Discord OAuth URLs */
    DISCORD: {
        OAUTH: 'https://discord.com/api/oauth2/authorize',
    },
    /** Socket.IO protocol conversion */
    SOCKET: {
        HTTP_TO_WS: {
            'http://': 'ws://',
            'https://': 'wss://',
        },
    },
};
