export interface RssFeed {
    id: number;
    guildId: string;
    url: string;
    name: string;
    intervalMinutes: number;
    enabled: boolean;
    lastFetchedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IngestedDocument {
    id: number;
    guildId: string;
    filename: string;
    fileType: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    errorMessage?: string;
    createdAt: Date;
    processedAt?: Date;
}

export interface CreateRssFeedData {
    url: string;
    name: string;
    intervalMinutes?: number;
}

export interface UpdateRssFeedData {
    url?: string;
    name?: string;
    intervalMinutes?: number;
    enabled?: boolean;
}

export interface CreateIngestedDocumentData {
    filename: string;
    fileType: string;
}

export interface UpdateDocumentStatusData {
    status: 'pending' | 'processing' | 'completed' | 'error';
    errorMessage?: string | null;
    processedAt?: boolean | null;
}

export function createRssFeed(guildId: string, data: CreateRssFeedData): Promise<RssFeed>;
export function getRssFeeds(guildId: string): Promise<RssFeed[]>;
export function updateRssFeed(id: number, data: UpdateRssFeedData): Promise<RssFeed>;
export function deleteRssFeed(id: number): Promise<void>;
export function updateRssLastFetched(id: number): Promise<void>;
export function createIngestedDocument(guildId: string, data: CreateIngestedDocumentData): Promise<IngestedDocument>;
export function updateDocumentStatus(id: number, data: UpdateDocumentStatusData): Promise<IngestedDocument>;
export function getIngestedDocuments(guildId: string): Promise<IngestedDocument[]>;
export function deleteIngestedDocument(id: number): Promise<void>;
