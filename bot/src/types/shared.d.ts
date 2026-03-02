/**
 * Type declarations for shared storage modules
 */

import { EventEmitter } from 'events';

interface HypergraphNode {
  id: number;
  nodeId: string;
  nodeType: string;
  name: string;
  metadata?: Record<string, unknown>;
}

interface HypergraphEdge {
  id: number;
  edgeType: string;
  summary: string;
  content?: string;
  importance?: number;
  urgency?: number;
  createdAt?: string;
  channelId?: string;
  memberships?: Array<{
    entity?: HypergraphNode;
    role?: string;
    weight?: number;
    name?: string;
  }>;
  members?: Array<{
    role?: string;
    name?: string;
  }>;
  metadata?: Record<string, unknown>;
}

interface HypergraphStats {
  nodeCount: number;
  edgeCount: number;
  topEntities?: Array<{ name: string; count: number }>;
}

interface HypergraphConfig {
  decayRate?: number;
  accessBoost?: number;
  [key: string]: unknown;
}

declare module '@shared/storage/hypergraphPersistence.js' {
  export function findOrCreateNode(guildId: string, nodeId: string, nodeType: string, name: string, metadata?: Record<string, unknown>): Promise<number>;
  export function getNodesByType(guildId: string, nodeType: string): Promise<HypergraphNode[]>;
  export function getAllNodes(guildId: string): Promise<HypergraphNode[]>;
  export function findNode(guildId: string, nodeId: string, nodeType: string): Promise<HypergraphNode | null>;
  export function createHyperedge(guildId: string, edgeData: { channelId: string; edgeType: string; summary: string; content?: string; importance?: number; memberships?: Array<{ entity: { id: string; name: string; type: string }; role: string; weight: number }>; metadata?: Record<string, unknown> }): Promise<number>;
  export function queryMemoriesByNode(guildId: string, nodeId: string, minUrgency?: number, limit?: number): Promise<HypergraphEdge[]>;
  export function getContextualMemories(guildId: string, channelId: string, userId: string, limit?: number): Promise<HypergraphEdge[]>;
  export function getUserFacts(guildId: string, userId: string, limit?: number): Promise<HypergraphEdge[]>;
  export function getGlobalKnowledge(guildId: string, limit?: number): Promise<HypergraphEdge[]>;
  export function searchMemories(guildId: string, keywords: string[], limit?: number): Promise<HypergraphEdge[]>;
  export function getGraphData(guildId: string, channelId?: string | null, limit?: number): Promise<{ nodes: HypergraphNode[]; edges: HypergraphEdge[] }>;
  export function updateMemoryUrgency(guildId: string, decayRate?: number, accessBoost?: number): Promise<HypergraphEdge[]>;
  export function pruneLowUrgencyMemories(guildId: string, minUrgency?: number, minAgeDays?: number): Promise<number>;
  export function recordMemoryAccess(hyperedgeId: number): Promise<void>;
  export function getHypergraphStats(guildId: string): Promise<HypergraphStats>;
  export function getAllMemories(guildId: string, minUrgency?: number, limit?: number): Promise<HypergraphEdge[]>;
  export function getChannelMemories(guildId: string, channelId: string, minUrgency?: number, limit?: number): Promise<HypergraphEdge[]>;
  export function getHypergraphConfig(guildId: string): Promise<HypergraphConfig>;
  export function deleteHyperedge(hyperedgeId: number): Promise<void>;
  export function updateHypergraphConfig(guildId: string, config: HypergraphConfig): Promise<void>;
}

interface RssFeed {
  id: number;
  guildId: string;
  url: string;
  name: string;
  intervalMinutes?: number;
  enabled?: boolean;
  lastFetchedAt?: string;
}

interface IngestedDocument {
  id: number;
  guildId: string;
  filename: string;
  fileType: string;
  status: string;
  errorMessage?: string | null;
  processedAt?: boolean | null;
  createdAt?: string;
}

declare module '@shared/storage/knowledgePersistence.js' {
  export function createRssFeed(guildId: string, data: { url: string; name: string; intervalMinutes?: number }): Promise<RssFeed>;
  export function getRssFeeds(guildId: string): Promise<RssFeed[]>;
  export function updateRssFeed(id: number, data: { url?: string; name?: string; intervalMinutes?: number; enabled?: boolean }): Promise<RssFeed>;
  export function deleteRssFeed(id: number): Promise<void>;
  export function updateRssLastFetched(id: number): Promise<void>;
  export function createIngestedDocument(guildId: string, data: { filename: string; fileType: string }): Promise<IngestedDocument>;
  export function updateDocumentStatus(id: number, data: { status: string; errorMessage?: string | null; processedAt?: boolean | null }): Promise<IngestedDocument>;
  export function getIngestedDocuments(guildId: string): Promise<IngestedDocument[]>;
  export function deleteIngestedDocument(id: number): Promise<void>;
}

interface ServerConfig {
  guildId: string;
  [key: string]: unknown;
}

interface GlobalConfig {
  [key: string]: unknown;
}

interface MessageContext {
  id?: number;
  guildId?: string;
  channelId: string;
  authorId: string;
  author: string;
  authorName: string;
  content: string;
  createdAt?: string;
}

interface BotReply {
  id?: number;
  guildId: string;
  channelId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  userMessage: string;
  botReply: string;
  processingTimeMs: number;
  promptTokens: number;
  responseTokens: number;
  createdAt?: string;
}

interface AnalyticsData {
  totalMessages?: number;
  totalReplies?: number;
  activeUsers?: number;
  [key: string]: unknown;
}

interface AnalyticsEvent {
  eventType: string;
  guildId: string;
  channelId: string;
  userId: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

interface DbPool {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
}

declare module '@shared/storage/persistence.js' {
  export function loadRelationships(guildId: string): Promise<Record<string, unknown>>;
  export function saveRelationships(guildId: string, relationships: Record<string, unknown>): Promise<void>;
  export function getServerConfig(guildId: string): Promise<ServerConfig | null>;
  export function saveServerConfig(guildId: string, config: ServerConfig): Promise<void>;
  export function deleteServerConfig(guildId: string): Promise<void>;
  export function getGlobalConfig(): Promise<GlobalConfig | null>;
  export function saveGlobalConfig(config: GlobalConfig): Promise<void>;
  export function deleteGlobalConfig(): Promise<void>;
  export function getAllServerConfigs(): Promise<ServerConfig[]>;
  export function loadContexts(guildId: string, channelId: string, maxMessages: number): Promise<MessageContext[]>;
  export function saveMessage(guildId: string, channelId: string, authorId: string, authorName: string, content: string): Promise<void>;
  export function saveGuild(guildId: string, guildName: string): Promise<void>;
  export function pruneOldMessages(maxAgeDays: number): Promise<void>;
  export function logBotReply(guildId: string, channelId: string, userId: string, username: string, displayName: string, avatarUrl: string, userMessage: string, botReply: string, processingTimeMs: number, promptTokens: number, responseTokens: number): Promise<void>;
  export function getLatestReplies(limit?: number): Promise<BotReply[]>;
  export function getAnalyticsData(): Promise<AnalyticsData>;
  export function logAnalyticsEvent(eventType: string, guildId: string, channelId: string, userId: string, metadata?: Record<string, unknown>): Promise<void>;
  export function getAnalyticsOverview(days?: number): Promise<AnalyticsData>;
  export function getAnalyticsVolume(days?: number): Promise<AnalyticsData>;
  export function getAnalyticsDecisions(days?: number): Promise<AnalyticsData>;
  export function getAnalyticsProviders(days?: number): Promise<AnalyticsData>;
  export function getAnalyticsErrors(days?: number, limit?: number): Promise<AnalyticsEvent[]>;
  export function getDb(): Promise<DbPool>;
  export function getSqlLogEmitter(): SqlLogEmitter;
  export function resetPoolWrapper(): void;
}

declare module '@shared/storage/database.js' {
  export function connect(): Promise<DbPool>;
  export function initializeDatabase(): Promise<void>;
  export function getPool(): Promise<DbPool>;
  export function setupSchema(): Promise<void>;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: unknown;
  formatted?: string;
}

interface SqlLogEmitter extends EventEmitter {
  onLog(callback: (entry: LogEntry) => void): void;
  api(message: string, data?: unknown): void;
  sql(message: string, data?: unknown): void;
  message(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

declare module '@shared/utils/logger.js' {
  export const logger: {
    onLog(callback: (entry: LogEntry) => void): void;
    api(message: string, data?: unknown): void;
    sql(message: string, data?: unknown): void;
    message(message: string, data?: unknown): void;
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, error?: unknown): void;
  };
  export function initializeLogger(maxLines?: number): void;
}

interface BotConfig {
  guildId?: string;
  replyBehavior?: string;
  botPersona?: {
    name?: string;
    username?: string;
    description?: string;
    avatarUrl?: string;
    [key: string]: unknown;
  };
  mentionOnly?: boolean;
  replyProbability?: number;
  logReplyDecisions?: boolean;
  [key: string]: unknown;
}

interface MemoryConfig {
  decayRate?: number;
  accessBoost?: number;
  [key: string]: unknown;
}

interface ApiConfig {
  baseUrl?: string;
  timeout?: number;
  qwenApiKey?: string;
  geminiApiKey?: string;
  ollamaUrl?: string;
  [key: string]: unknown;
}

interface SandboxConfig {
  enabled?: boolean;
  timeout?: number;
  [key: string]: unknown;
}

interface LoggerConfig {
  level?: string;
  format?: string;
  logSql?: boolean;
  maxLogLines?: number;
  username?: string;
  [key: string]: unknown;
}

declare module '@shared/config/configLoader.js' {
  export function loadConfig(): Promise<Record<string, unknown>>;
  export function getServerConfig(guildId: string): Promise<ServerConfig>;
  export function updateServerConfig(guildId: string, newConfig: ServerConfig): Promise<void>;
  export function reloadConfig(): Promise<Record<string, unknown>>;
  export function getBotConfig(guildId: string): Promise<BotConfig>;
  export function getMemoryConfig(): Promise<MemoryConfig>;
  export function getGlobalMemoryConfig(): Promise<MemoryConfig>;
  export function getApiConfig(): Promise<ApiConfig>;
  export function getReplyBehavior(guildId: string): Promise<string>;
  export function getLoggerConfig(): Promise<LoggerConfig>;
  export function getSandboxConfig(): Promise<SandboxConfig>;
  export function setSqlLoggingEnabled(enabled: boolean): void;
  export function isSqlLoggingEnabled(): boolean;
  export function clearServerConfigCache(guildId: string): void;
}

declare module '@shared/config/validation.js' {
  export function validateEnvironment(): void;
}

// External module declarations
declare module 'rss-parser' {
  export class Parser<T = Record<string, unknown>> {
    parseURL(url: string): Promise<T>;
    parseString(content: string): Promise<T>;
  }
  export default Parser;
}

declare module 'pdf-parse' {
  interface PDFInfo {
    PDFFormatVersion: string;
    IsAcroFormPresent: boolean;
    IsXFAPresent: boolean;
    [key: string]: unknown;
  }

  interface PDFMetadata {
    [key: string]: unknown;
  }

  interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: PDFInfo;
    metadata: PDFMetadata;
    text: string;
    version: string;
  }

  interface PDFOptions {
    password?: string;
    max?: number;
    version?: string;
    normalizer?: {
      normalize?: (text: string) => string;
      normalizeLine?: (line: string) => string;
      mergeXTexts?: (items: unknown[]) => unknown[];
      combinePages?: (items: unknown[], separator?: string) => unknown[];
    };
  }

  function pdfParse(data: Buffer, options?: PDFOptions): Promise<PDFParseResult>;
  namespace pdfParse {}
  export default pdfParse;
}

declare module 'multer' {
  import { Request } from 'express';
  import { Response } from 'express';

  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        stream: NodeJS.ReadableStream;
        buffer: Buffer;
      }

      interface FileInfo {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
      }

      interface Options {
        dest?: string;
        storage?: StorageEngine;
        limits?: {
          fieldNameSize?: number;
          fieldSize?: number;
          fields?: number;
          fileSize?: number;
          files?: number;
          parts?: number;
          headerPairs?: number;
        };
        preservePath?: boolean;
        fileFilter?: (req: Request, file: File, cb: (error: Error | null, acceptFile?: boolean) => void) => void;
      }

      interface StorageEngine {
        _handleFile(req: Request, file: File, callback: (error?: Error, info?: Partial<FileInfo>) => void): void;
        _removeFile(req: Request, file: File, callback: (error?: Error) => void): void;
      }

      interface DiskStorageOptions {
        destination?: string | ((req: Request, file: File, cb: (error: Error | null, destination: string) => void) => void);
        filename?: (req: Request, file: File, cb: (error: Error | null, filename: string) => void) => void;
      }

      interface SingleRequestHandler {
        (req: Request, res: Response, next: (err?: Error) => void): void;
      }
    }
  }

  interface Multer {
    single(fieldname: string, maxCount?: number): Express.Multer.SingleRequestHandler;
    array(fieldname: string, maxCount?: number): Express.Multer.SingleRequestHandler;
    fields(fields: { name: string; maxCount?: number }[]): Express.Multer.SingleRequestHandler;
    none(): Express.Multer.SingleRequestHandler;
    any(): Express.Multer.SingleRequestHandler;
  }

  interface MulterInstance {
    (options?: Multer.Options): Multer;
    diskStorage(options: Multer.DiskStorageOptions): Multer.StorageEngine;
    memoryStorage(): Multer.StorageEngine;
  }

  const multer: MulterInstance;
  export default multer;
}

// Extend Express Request type for multer file uploads
declare global {
  namespace Express {
    interface Request {
      file?: Multer.File;
      files?: Multer.File[];
    }
  }
}
