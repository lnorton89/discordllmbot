/**
 * Dashboard Constants
 *
 * Constants specific to the React dashboard.
 *
 * @module dashboard/src/constants
 */

/** Time constants in milliseconds */
const TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
} as const;

/** Logging defaults */
const LOGGING = {
    MAX_LOG_LINES: 1000,
    MAX_LOG_LINES_API: 500,
    MAX_LOG_LINES_DB: 200,
} as const;

/**
 * Dashboard Configuration
 */
export const DASHBOARD = {
    NAME: 'DiscordLLMBot Dashboard',
    VERSION: '0.0.0',
} as const;

/**
 * API Configuration
 */
export const API_CONFIG = {
    BASE_URL: import.meta.env.VITE_API_URL || '',
    TIMEOUT_MS: 30 * TIME.SECOND,
    RETRY_ATTEMPTS: 3,
} as const;

/**
 * Socket.io Configuration
 */
export const SOCKET = {
    RECONNECTION: true,
    RECONNECTION_ATTEMPTS: 5,
    RECONNECTION_DELAY_MS: 1000,
    TIMEOUT_MS: 20 * TIME.SECOND,
} as const;

/**
 * Polling Intervals (in milliseconds)
 */
export const POLLING = {
    HEALTH_CHECK_MS: 5 * TIME.SECOND,
    ANALYTICS_MS: 30 * TIME.SECOND,
    LOGS_MS: 1 * TIME.SECOND,
    DB_LOGS_MS: 1 * TIME.SECOND,
    BOT_STATUS_MS: 2 * TIME.SECOND,
} as const;

/**
 * Pagination Defaults
 */
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_ROWS_PER_PAGE: 20,
    ROWS_PER_PAGE_OPTIONS: [10, 20, 50, 100],
} as const;

/**
 * Log Viewer Configuration
 */
export const LOG_VIEWER = {
    MAX_LINES: LOGGING.MAX_LOG_LINES_API,
    DEFAULT_FILTERS: {
        ERROR: true,
        WARN: true,
        INFO: true,
        SQL: true,
        API: true,
        MESSAGE: true,
        OTHER: true,
    },
    AUTO_SCROLL: true,
} as const;

/**
 * Analytics Configuration
 */
export const ANALYTICS = {
    DEFAULT_DAYS: 7,
    MAX_DAYS: 90,
    POLLING_INTERVAL_MS: 30 * TIME.SECOND,
    CHART_COLORS: {
        PRIMARY: '#1976d2',
        SECONDARY: '#42424a',
        SUCCESS: '#2e7d32',
        WARNING: '#ed6c02',
        ERROR: '#d32f2f',
    },
} as const;

/**
 * UI Configuration
 */
export const UI = {
    DRAWER_WIDTH: 240,
    MOBILE_BREAKPOINT: 'sm',
    TABLET_BREAKPOINT: 'md',
    DESKTOP_BREAKPOINT: 'lg',
} as const;

/**
 * Route Paths
 */
export const ROUTES = {
    DASHBOARD: '/',
    ANALYTICS: '/analytics',
    SERVERS: '/servers',
    DATABASE: '/database',
    PLAYGROUND: '/playground',
    SETTINGS: '/settings',
    LOGS: '/logs',
} as const;

/**
 * Storage Keys (for localStorage)
 */
export const STORAGE = {
    THEME: 'dashboard-theme',
    SIDEBAR_COLLAPSED: 'sidebar-collapsed',
    ANALYTICS_DAYS: 'analytics-days',
} as const;
