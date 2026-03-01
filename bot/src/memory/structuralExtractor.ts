/**
 * Structural Memory Extractor
 *
 * Extracts entities and creates memories from Discord messages
 * using structural parsing - NO LLM calls required.
 *
 * Parses:
 * - Discord mentions (@user)
 * - Channel mentions (#channel)
 * - Emojis (:emoji:)
 * - Keywords (significant words)
 * - Patterns ("I like X", "X is Y")
 *
 * @module bot/src/memory/structuralExtractor
 */

import { Message, ChannelType } from 'discord.js';

// Stopwords to filter out from keyword extraction
const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'as', 'what', 'which',
    'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours',
    'theirs', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up',
    'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
    'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'now', 'can', 'will', 'dont', 'should', 'im', 'youre', 'hes', 'shes',
    'its', 'were', 'theyre', 'ive', 'youve', 'weve', 'theyve', 'id', 'youd', 'hed',
    'shed', 'wed', 'theyd', 'ill', 'youll', 'hell', 'shell', 'well', 'theyll',
    'isnt', 'arent', 'wasnt', 'werent', 'wasnt', 'hasnt', 'havent', 'hadnt',
    'doesnt', 'dont', 'didnt', 'wont', 'wouldnt', 'shant', 'shouldnt', 'cant',
    'cannot', 'couldnt', 'mustnt', 'lets', 'thats', 'whos', 'whats', 'heres',
    'theres', 'whens', 'wheres', 'whys', 'hows', 'whats'
]);

// Patterns for fact extraction
const FACT_PATTERNS = [
    // "I like/love/enjoy X"
    {
        pattern: /\b(?:i|im|i am)\s+(?:really\s+)?(?:like|love|enjoy|enjoying|prefer)\s+(.+)/i,
        extract: (match: RegExpMatchArray) => ({
            summary: `User likes ${match[1].trim()}`,
            edgeType: 'fact',
            importance: 0.7
        })
    },
    // "I hate X"
    {
        pattern: /\b(?:i|im|i am)\s+(?:really\s+)?(?:hate|dislike|cant stand)\s+(.+)/i,
        extract: (match: RegExpMatchArray) => ({
            summary: `User dislikes ${match[1].trim()}`,
            edgeType: 'fact',
            importance: 0.7
        })
    },
    // "I am X"
    {
        pattern: /\b(?:i|im|i am)\s+(?:a\s+)?(.{3,40})\b/i,
        extract: (match: RegExpMatchArray) => {
            const value = match[1].trim();
            // Filter out generic statements
            if (value.length < 3 || /\b(?:going|doing|feeling|thinking|sure|ok|okay|here|back|ready)\b/i.test(value)) {
                return null;
            }
            return {
                summary: `User is ${value}`,
                edgeType: 'fact',
                importance: 0.5
            };
        }
    },
    // "My favorite X is Y"
    {
        pattern: /\bmy\s+favorite\s+(\w+)\s+(?:is|:\s+)(.+)/i,
        extract: (match: RegExpMatchArray) => ({
            summary: `User's favorite ${match[1]} is ${match[2].trim()}`,
            edgeType: 'fact',
            importance: 0.8
        })
    },
    // "Remember that X"
    {
        pattern: /\b(?:remember|dont forget|note)\s+(?:that\s+)?(.+)/i,
        extract: (match: RegExpMatchArray) => ({
            summary: `User noted: ${match[1].trim()}`,
            edgeType: 'fact',
            importance: 0.9
        })
    }
];

/**
 * Extracted memory interface
 */
export interface ExtractedMemory {
    summary: string;
    content?: string;
    edgeType: 'conversation' | 'fact' | 'observation';
    importance: number;
    entities: Array<{
        type: 'user' | 'channel' | 'topic' | 'emotion';
        id: string;
        name: string;
        role: 'participant' | 'subject' | 'location' | 'topic';
        weight: number;
        metadata?: Record<string, unknown>;
    }>;
}

/**
 * Extract entities from a Discord message
 * @param {Message} message - Discord message
 * @returns {ExtractedMemory|null} Extracted memory or null
 */
export function extractStructuralMemory(message: Message): ExtractedMemory | null {
    if (!message.guild || !message.content) return null;

    const content = message.content.trim();
    if (content.length < 3) return null; // Skip very short messages

    const authorId = message.author.id;
    const authorName = message.author.username;

    // Extract entities from the message
    const entities: ExtractedMemory['entities'] = [];

    // Always include the author
    entities.push({
        type: 'user',
        id: authorId,
        name: authorName,
        role: 'participant',
        weight: 1.0
    });

    // Extract user mentions
    message.mentions.users.forEach((user, userId) => {
        if (userId !== authorId) { // Skip duplicate author
            entities.push({
                type: 'user',
                id: userId,
                name: user.username,
                role: 'participant',
                weight: 0.9
            });
        }
    });

    // Extract channel mentions
    message.mentions.channels.forEach((channel, channelId) => {
        if (channel.type !== ChannelType.DM && channel.type !== ChannelType.GroupDM && 'name' in channel) {
            entities.push({
                type: 'channel',
                id: channelId,
                name: channel.name as string,
                role: 'location',
                weight: 0.5
            });
        }
    });

    // Extract role mentions (as topics)
    message.mentions.roles.forEach((role, roleId) => {
        entities.push({
            type: 'topic',
            id: roleId,
            name: role.name,
            role: 'topic',
            weight: 0.6
        });
    });

    // Extract keywords as topics
    const keywords = extractKeywords(content);
    keywords.forEach(keyword => {
        entities.push({
            type: 'topic',
            id: keyword.toLowerCase(),
            name: keyword,
            role: 'topic',
            weight: 0.3
        });
    });

    // Check for fact patterns first
    for (const { pattern, extract } of FACT_PATTERNS) {
        const match = content.match(pattern);
        if (match) {
            const factData = extract(match);
            if (factData) {
                return {
                    summary: factData.summary,
                    content: content,
                    edgeType: factData.edgeType as ExtractedMemory['edgeType'],
                    importance: factData.importance,
                    entities
                };
            }
        }
    }

    // If no fact pattern matched, create a conversation memory
    // But only if there are meaningful entities
    const hasOtherParticipants = entities.some(e => e.type === 'user' && e.id !== authorId);
    const hasTopics = entities.filter(e => e.type === 'topic').length > 0;

    // Create observation memory for messages with meaningful content
    if (hasOtherParticipants || hasTopics || content.length > 20) {
        return {
            summary: generateSummary(content, authorName, entities),
            content: content,
            edgeType: 'observation',
            importance: calculateImportance(content, entities),
            entities
        };
    }

    return null; // Skip simple messages like "hi", "ok", etc.
}

/**
 * Extract significant keywords from text
 * @param {string} text - Text to extract from
 * @returns {string[]} Keywords
 */
export function extractKeywords(text: string): string[] {
    // Remove Discord mentions and links
    const cleanText = text
        .replace(/<@[!&]?\d+>/g, '') // Mentions
        .replace(/<#\d+>/g, '') // Channel mentions
        .replace(/https?:\/\/\S+/g, '') // URLs
        .replace(/[^\w\s]/g, ' ') // Remove punctuation
        .toLowerCase();

    const words = cleanText.split(/\s+/).filter(w =>
        w.length >= 3 && !STOPWORDS.has(w)
    );

    // Return unique words, limited to top 5
    return Array.from(new Set(words)).slice(0, 5);
}

/**
 * Generate a summary for a conversation memory
 * @param {string} content - Message content
 * @param {string} authorName - Author's name
 * @param {Array} entities - Extracted entities
 * @returns {string} Summary
 */
function generateSummary(content: string, authorName: string, entities: ExtractedMemory['entities']): string {
    const topics = entities.filter(e => e.type === 'topic').slice(0, 3).map(e => e.name);
    const users = entities.filter(e => e.type === 'user' && e.name !== authorName).slice(0, 2).map(e => e.name);

    let summary = '';

    if (users.length > 0) {
        summary += `${authorName} with ${users.join(' and ')}`;
    } else {
        summary += authorName;
    }

    if (topics.length > 0) {
        summary += ` about ${topics.join(', ')}`;
    }

    // Truncate and add ellipsis if needed
    const maxLength = 80;
    if (summary.length > maxLength) {
        summary = summary.substring(0, maxLength - 3) + '...';
    }

    return summary;
}

/**
 * Calculate importance score for a memory
 * @param {string} content - Message content
 * @param {Array} entities - Extracted entities
 * @returns {number} Importance score (0-1)
 */
function calculateImportance(content: string, entities: ExtractedMemory['entities']): number {
    let score = 0.3; // Base importance

    // Longer messages are more important
    if (content.length > 50) score += 0.1;
    if (content.length > 100) score += 0.1;

    // More entities = more important
    const userCount = entities.filter(e => e.type === 'user').length;
    const topicCount = entities.filter(e => e.type === 'topic').length;

    score += Math.min(userCount * 0.15, 0.3);
    score += Math.min(topicCount * 0.05, 0.2);

    // Question marks indicate questions (slightly more important)
    if (content.includes('?')) score += 0.1;

    // Exclamation marks indicate emphasis
    if (content.includes('!')) score += 0.05;

    return Math.min(score, 1.0);
}

/**
 * Create a memory object suitable for storage
 * @param {Message} message - Discord message
 * @returns {object|null} Memory data or null
 */
export function createMemoryData(message: Message) {
    const extracted = extractStructuralMemory(message);
    if (!extracted) return null;

    return {
        channelId: message.channelId,
        edgeType: extracted.edgeType,
        summary: extracted.summary,
        content: extracted.content,
        importance: extracted.importance,
        sourceMessageId: message.id,
        memberships: extracted.entities.map(entity => ({
            entity: {
                id: entity.id,
                type: entity.type,
                name: entity.name,
                metadata: entity.metadata || {}
            },
            role: entity.role,
            weight: entity.weight
        }))
    };
}
