/**
 * API Client for DiscordLLMBot
 * @module services/api
 */

import axios, { AxiosResponse } from 'axios';
import type {
  HealthResponse,
  AnalyticsResponse,
  Reply,
  Server,
  ServerConfig,
  Relationship,
  Channel,
  BotConfig,
  BotInfo,
  ChatResponse,
  AnalyticsOverview,
  AnalyticsVolume,
  AnalyticsDecisions,
  AnalyticsProviders,
  AnalyticsPerformance,
  AnalyticsUsers,
  AnalyticsChannels,
  AnalyticsErrors,
} from '@types';

/**
 * Axios instance with default configuration
 * Uses VITE_API_URL environment variable or defaults to /api
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ===========================================================================
// Health & Monitoring
// ===========================================================================

/**
 * Health check endpoints
 */
export const healthApi = {
  /**
   * Get bot health status
   * @returns Promise with uptime, CPU, and memory usage
   */
  getHealth: (): Promise<AxiosResponse<HealthResponse>> => api.get('/health'),
};

// ===========================================================================
// Analytics
// ===========================================================================

/**
 * Analytics and statistics endpoints
 */
export const analyticsApi = {
  getAnalytics: (): Promise<AxiosResponse<AnalyticsResponse>> => api.get('/analytics'),
  getReplies: (limit = 50): Promise<AxiosResponse<Reply[]>> => api.get(`/replies?limit=${limit}`),
  getOverview: (days = 7): Promise<AxiosResponse<AnalyticsOverview>> => api.get(`/analytics/overview?days=${days}`),
  getVolume: (days = 7): Promise<AxiosResponse<AnalyticsVolume>> => api.get(`/analytics/volume?days=${days}`),
  getDecisions: (days = 7): Promise<AxiosResponse<AnalyticsDecisions>> => api.get(`/analytics/decisions?days=${days}`),
  getProviders: (days = 7): Promise<AxiosResponse<AnalyticsProviders>> => api.get(`/analytics/providers?days=${days}`),
  getPerformance: (days = 7): Promise<AxiosResponse<AnalyticsPerformance>> => api.get(`/analytics/performance?days=${days}`),
  getUsers: (days = 7, guildId?: string, limit = 20): Promise<AxiosResponse<AnalyticsUsers>> => 
    api.get(`/analytics/users?days=${days}&limit=${limit}`, { params: { guildId } }),
  getChannels: (days = 7, guildId?: string): Promise<AxiosResponse<AnalyticsChannels>> => 
    api.get(`/analytics/channels?days=${days}`, { params: { guildId } }),
  getErrors: (days = 7, limit = 50): Promise<AxiosResponse<AnalyticsErrors>> => 
    api.get(`/analytics/errors?days=${days}&limit=${limit}`),
};

// ===========================================================================
// Server Management
// ===========================================================================

/**
 * Server management endpoints
 * Handles server list, config, relationships, and channels
 */
export const serversApi = {
  /**
   * Get all servers the bot is connected to
   */
  getServers: (): Promise<AxiosResponse<Server[]>> => api.get('/servers'),
  /**
   * Remove bot from a server
   * @param serverId - Discord server ID
   */
  leaveServer: (serverId: string): Promise<AxiosResponse<void>> => api.delete(`/servers/${serverId}`),
  /**
   * Get server-specific configuration
   * @param guildId - Discord guild ID
   */
  getServerConfig: (guildId: string): Promise<AxiosResponse<ServerConfig>> => api.get(`/servers/${guildId}/config`),
  /**
   * Update server-specific configuration
   * @param guildId - Discord guild ID
   * @param config - Server configuration object
   */
  updateServerConfig: (guildId: string, config: ServerConfig): Promise<AxiosResponse<ServerConfig>> => api.post(`/servers/${guildId}/config`, config),
  /**
   * Reset server config to global defaults
   * @param guildId - Discord guild ID
   */
  resetServerConfig: (guildId: string): Promise<AxiosResponse<void>> => api.delete(`/servers/${guildId}/config`),
  /**
   * Get all user relationships for a server
   * @param guildId - Discord guild ID
   */
  getRelationships: (guildId: string): Promise<AxiosResponse<Record<string, Relationship>>> => api.get(`/guilds/${guildId}/relationships`),
  /**
   * Update a user's relationship data
   * @param guildId - Discord guild ID
   * @param userId - Discord user ID
   * @param data - Relationship data (attitude, behavior, ignored)
   */
  updateRelationship: (guildId: string, userId: string, data: Relationship): Promise<AxiosResponse<Relationship>> =>
    api.post(`/guilds/${guildId}/relationships/${userId}`, data),
  /**
   * Get all channels in a server
   * @param guildId - Discord guild ID
   */
  getChannels: (guildId: string): Promise<AxiosResponse<Channel[]>> => api.get(`/guilds/${guildId}/channels`),
};

// ===========================================================================
// Global Configuration
// ===========================================================================

/**
 * Global bot configuration endpoints
 * Settings that apply to all servers unless overridden
 */
export const configApi = {
  /**
   * Get global bot configuration
   */
  getConfig: (): Promise<AxiosResponse<BotConfig>> => api.get('/config'),
  /**
   * Update global bot configuration
   * @param config - Complete bot configuration object
   */
  updateConfig: (config: BotConfig): Promise<AxiosResponse<BotConfig>> => api.post('/config', config),
};

// ===========================================================================
// Bot Information
// ===========================================================================

/**
 * Bot information endpoints
 */
export const botInfoApi = {
  /**
   * Get bot info (client ID, invite URL)
   */
  getBotInfo: (): Promise<AxiosResponse<BotInfo>> => api.get('/bot-info'),
};

// ===========================================================================
// Models
// ===========================================================================

/**
 * LLM model endpoints
 */
export const modelsApi = {
  /**
   * Get available models for a provider
   * @param provider - LLM provider ('gemini' or 'ollama')
   */
  getModels: (provider: string): Promise<AxiosResponse<string[]>> => api.get('/models', { params: { provider } }),
};

// ===========================================================================
// Chat / Playground
// ===========================================================================

/**
 * Chat playground endpoints
 * Test bot responses without affecting Discord
 */
export const chatApi = {
  /**
   * Send a test message to the bot
   * @param message - User message content
   * @param username - Simulated username
   * @param guildName - Simulated server name
   */
  sendMessage: (message: string, username: string, guildName: string): Promise<AxiosResponse<ChatResponse>> =>
    api.post('/chat', { message, username, guildName }),
};

// ===========================================================================
// Database Viewer
// ===========================================================================

export interface TableInfo {
  table_name: string;
  description: string | null;
  column_count: number;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  is_primary_key: boolean;
  foreign_key: string | null;
}

export interface TableSchema {
  columns: ColumnInfo[];
  foreignKeys: Record<string, { table: string; column: string }>;
}

export interface TableData {
  data: Record<string, unknown>[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface TableRelationship {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
}

/**
 * Database viewer endpoints
 * View tables, schemas, and data
 */
export const databaseApi = {
  /**
   * Get all tables in the database
   */
  getTables: (): Promise<AxiosResponse<TableInfo[]>> => api.get('/db/tables'),
  /**
   * Get table schema (columns and foreign keys)
   * @param tableName - Name of the table
   */
  getTableSchema: (tableName: string): Promise<AxiosResponse<TableSchema>> => 
    api.get(`/db/tables/${tableName}/schema`),
  /**
   * Get table data with pagination
   * @param tableName - Name of the table
   * @param page - Page number (default 1)
   * @param pageSize - Rows per page (default 20)
   */
  getTableData: (tableName: string, page = 1, pageSize = 20): Promise<AxiosResponse<TableData>> => 
    api.get(`/db/tables/${tableName}/data`, { params: { page, pageSize } }),
  /**
   * Get all foreign key relationships
   */
  getRelationships: (): Promise<AxiosResponse<TableRelationship[]>> => api.get('/db/relationships'),
};

// ===========================================================================
// Hypergraph Memory System
// ===========================================================================

export interface HypergraphNode {
  id: number;
  nodeid: string;
  nodetype: string;
  name: string;
  metadata: Record<string, unknown>;
}

export interface HypergraphEdge {
  id: number;
  guildid: string;
  channelid: string;
  edgetype: string;
  summary: string;
  content?: string;
  urgency: number;
  importance: number;
  accesscount: number;
  createdat: string;
  members?: Array<{
    nodetype: string;
    name: string;
    role: string;
    weight: number;
  }>;
}

export interface HypergraphStats {
  nodesByType: Array<{ nodetype: string; count: string | number }>;
  edgesByType: Array<{ edgetype: string; count: string | number; avgurgency: number }>;
  topEntities: Array<{ nodetype: string; name: string; memorycount: number }>;
  channels: Array<{ channelid: string; count: number }>;
  totalNodes: number;
  totalEdges: number;
}

export interface GraphData {
  nodes: HypergraphNode[];
  edges: HypergraphEdge[];
}

/**
 * Hypergraph memory endpoints
 */
export const memoryApi = {
  /**
   * Get hypergraph statistics for a guild
   */
  getStats: (guildId: string): Promise<AxiosResponse<HypergraphStats>> =>
    api.get(`/hypergraph/${guildId}/stats`),
  /**
   * Get all nodes, optionally filtered by type
   */
  getNodes: (guildId: string, type?: string): Promise<AxiosResponse<HypergraphNode[]>> =>
    api.get(`/hypergraph/${guildId}/nodes`, { params: { type } }),
  /**
   * Get memories for a specific channel or node
   */
  getMemories: (guildId: string, channelId: string, minUrgency = 0, limit = 20): Promise<AxiosResponse<HypergraphEdge[]>> =>
    api.get(`/hypergraph/${guildId}/memories`, { params: { channelId, minUrgency, limit } }),
  /**
   * Get graph visualization data
   */
  getGraph: (guildId: string, channelId?: string, limit = 100): Promise<AxiosResponse<GraphData>> =>
    api.get(`/hypergraph/${guildId}/graph`, { params: { channelId, limit } }),
  /**
   * Create a manual memory
   */
  createMemory: (guildId: string, data: unknown): Promise<AxiosResponse<{ id: number }>> =>
    api.post(`/hypergraph/${guildId}/memories`, data),
  /**
   * Update memory configuration
   */
  updateConfig: (guildId: string, config: Record<string, unknown>): Promise<AxiosResponse<void>> =>
    api.post(`/hypergraph/${guildId}/config`, config),
  /**
   * Run decay process
   */
  runDecay: (guildId: string, decayRate = 0.1, minUrgencyThreshold = 0.1): Promise<AxiosResponse<{ updated: number; pruned: number }>> =>
    api.post(`/hypergraph/${guildId}/decay`, { decayRate, minUrgencyThreshold }),
};

// ==================== Knowledge Management ====================

export interface RssFeed {
  id: number;
  url: string;
  name: string;
  intervalminutes: number;
  enabled: boolean;
  lastfetchedat?: string;
}

export interface IngestedDocument {
  id: number;
  filename: string;
  filetype: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errormessage?: string;
  createdat: string;
  processedat?: string;
}

export const knowledgeApi = {
  getRssFeeds: (guildId: string): Promise<AxiosResponse<RssFeed[]>> =>
    api.get(`/knowledge/${guildId}/rss`),
  createRssFeed: (guildId: string, data: { url: string; name: string; intervalMinutes?: number }): Promise<AxiosResponse<RssFeed>> =>
    api.post(`/knowledge/${guildId}/rss`, data),
  updateRssFeed: (guildId: string, id: number, data: Partial<RssFeed>): Promise<AxiosResponse<RssFeed>> =>
    api.patch(`/knowledge/${guildId}/rss/${id}`, data),
  deleteRssFeed: (guildId: string, id: number): Promise<AxiosResponse<void>> =>
    api.delete(`/knowledge/${guildId}/rss/${id}`),
    getDocuments: (guildId: string): Promise<AxiosResponse<IngestedDocument[]>> => 
      api.get(`/knowledge/${guildId}/documents`),
    deleteDocument: (guildId: string, id: number): Promise<AxiosResponse<void>> =>
      api.delete(`/knowledge/${guildId}/documents/${id}`),
    uploadDocument: (guildId: string, file: File): Promise<AxiosResponse<IngestedDocument>> => {    const formData = new FormData();
    formData.append('document', file);
    return api.post(`/knowledge/${guildId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;
