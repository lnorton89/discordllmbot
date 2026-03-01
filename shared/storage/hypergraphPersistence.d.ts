export interface HypergraphNode {
    id: number;
    guildId: string;
    nodeId: string;
    nodeType: string;
    name: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    memoryCount?: number;
}

export interface MemoryMember {
    nodeId: string;
    nodeType: string;
    name: string;
    role: string;
    weight: number;
}

export interface HypergraphEdge {
    id: number;
    guildId: string;
    channelId: string;
    edgeType: string;
    summary: string;
    content?: string;
    importance: number;
    urgency: number;
    accessCount: number;
    lastAccessedAt: Date;
    sourceMessageId?: string;
    extractedAt: Date;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    members?: MemoryMember[];
}

export interface CreateHyperedgeData {
    channelId: string;
    edgeType: string;
    summary: string;
    content?: string;
    importance?: number;
    sourceMessageId?: string;
    metadata?: Record<string, unknown>;
    memberships?: Array<{
        entity: {
            id: string;
            type: string;
            name: string;
            metadata?: Record<string, unknown>;
        };
        role: string;
        weight?: number;
        metadata?: Record<string, unknown>;
    }>;
}

export interface HypergraphStats {
    nodesByType: Array<{ nodeType: string; count: string | number }>;
    edgesByType: Array<{ edgeType: string; count: string | number; avgUrgency: number }>;
    topEntities: Array<{ nodeType: string; name: string; memoryCount: number }>;
    channels: Array<{ channelId: string; count: number }>;
    totalNodes: number;
    totalEdges: number;
}

export interface HypergraphConfig {
    guildId: string;
    extractionEnabled: boolean;
    decayRate: number;
    importanceBoostOnAccess: number;
    minUrgencyThreshold: number;
    maxMemoriesPerNode: number;
}

export interface GraphEdge {
    id: number;
    edgeType: string;
    summary: string;
    urgency: number;
    channelId: string;
    connections: Array<MemoryMember & { nodeid: number }>;
}

export interface MemoryUrgencyResult {
    id: number;
    urgency: number;
    importance: number;
}

export function findOrCreateNode(guildId: string, nodeId: string, nodeType: string, name: string, metadata?: Record<string, unknown>): Promise<number>;
export function getNodesByType(guildId: string, nodeType: string): Promise<HypergraphNode[]>;
export function getAllNodes(guildId: string): Promise<HypergraphNode[]>;
export function findNode(guildId: string, nodeId: string, nodeType: string): Promise<HypergraphNode | null>;
export function createHyperedge(guildId: string, edgeData: CreateHyperedgeData): Promise<number>;
export function queryMemoriesByNode(guildId: string, nodeId: string, minUrgency?: number, limit?: number): Promise<HypergraphEdge[]>;
export function getContextualMemories(guildId: string, channelId: string, userId?: string, limit?: number): Promise<HypergraphEdge[]>;
export function getUserFacts(guildId: string, userId: string, limit?: number): Promise<HypergraphEdge[]>;
export function getGlobalKnowledge(guildId: string, limit?: number): Promise<HypergraphEdge[]>;
export function searchMemories(guildId: string, keywords: string[], limit?: number): Promise<HypergraphEdge[]>;
export function getGraphData(guildId: string, channelId?: string | null, limit?: number): Promise<{ nodes: HypergraphNode[], edges: GraphEdge[] }>;
export function updateMemoryUrgency(guildId: string, decayRate?: number, accessBoost?: number): Promise<MemoryUrgencyResult[]>;
export function pruneLowUrgencyMemories(guildId: string, minUrgency?: number, minAgeDays?: number): Promise<number>;
export function recordMemoryAccess(hyperedgeId: number): Promise<void>;
export function getHypergraphStats(guildId: string): Promise<HypergraphStats>;
export function getChannelMemories(guildId: string, channelId: string, minUrgency?: number, limit?: number): Promise<HypergraphEdge[]>;
export function getHypergraphConfig(guildId: string): Promise<HypergraphConfig>;
export function updateHypergraphConfig(guildId: string, config: Partial<HypergraphConfig>): Promise<void>;
