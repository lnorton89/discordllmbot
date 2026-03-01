/**
 * Prompt Builder Module
 * 
 * Constructs prompt strings for LLM generation based on bot persona,
 * user relationships, and conversation context.
 * 
 * @module bot/src/core/prompt
 */

import { getBotPersona } from '@personality/botPersona.js';
import { 
    getContextualMemories, 
    getUserFacts, 
    recordMemoryAccess, 
    getGlobalKnowledge,
    getHypergraphStats,
    searchMemories
} from '@shared/storage/hypergraphPersistence.js';
import { logger } from '@shared/utils/logger.js';
import { extractKeywords } from '@memory/structuralExtractor.js';

/**
 * Represents the relationship data for a user.
 */
interface Relationship {
    attitude: string;
    behavior: string[];
    boundaries: string[];
    username?: string;
    displayName?: string;
}

/**
 * Represents a message in the conversation context.
 */
interface MessageContext {
    authorId: string;
    author: string;
    content: string;
}

/**
 * Bot persona configuration.
 */
interface BotPersonaConfig {
    name: string;
    description: string;
    speakingStyle: string[];
    globalRules: string[];
}

/**
 * Parameters for building a prompt.
 */
interface BuildPromptParams {
    relationship: Relationship;
    context: MessageContext[];
    guildRelationships?: Record<string, Relationship>;
    guildName?: string;
    userMessage: string;
    username: string;
    botConfig?: BotPersonaConfig;
    guildId: string;
    channelId: string;
    userId: string;
}

/**
 * Builds the prompt string to send to the LLM.
 * 
 * @param params - The parameters for building the prompt
 * @returns Promise resolving to the constructed prompt string
 */
export async function buildPrompt({
    relationship,
    context,
    guildRelationships = {},
    guildName = '',
    userMessage,
    username,
    botConfig,
    guildId,
    channelId,
    userId
}: BuildPromptParams): Promise<string> {
    const botPersona = botConfig || await getBotPersona(guildId);

    const uniqueUserIds = Array.from(new Set(context.map(m => m.authorId).filter(Boolean)));
    const relationshipLines = uniqueUserIds.map(id => {
        const rel = guildRelationships[id] ?? { attitude: 'unknown', behavior: [] as string[], boundaries: [], username: id };
        const nameFromContext = (context.find(m => m.authorId === id)?.author);
        const display = rel.displayName ?? rel.username ?? nameFromContext ?? id;
        const usernameNote = rel.username && rel.username !== display ? ` (${rel.username})` : '';
        const behaviorNote = rel.behavior && rel.behavior.length > 0 ? `, ${rel.behavior.join(', ')}` : '';
        return `${display}${usernameNote}: ${rel.attitude} attitude${behaviorNote}`;
    });

    // Fetch hypergraph memories (primary memory system)
    let hypergraphMemoriesSection = '';
    try {
        // Get contextual memories from current channel (prioritizing current user)
        const channelMemories = await getContextualMemories(guildId, channelId, userId, 10);
        // Get user facts that can be shared across channels
        const userFacts = await getUserFacts(guildId, userId, 5);
        // Get global knowledge facts from ingested documents/RSS - Increase limit to 10
        const globalKnowledge = await getGlobalKnowledge(guildId, 10);
        
        // Extract keywords from current message for targeted search
        const userKeywords = extractKeywords(userMessage);
        const searchResults = await searchMemories(guildId, userKeywords, 5);
        
        // Combine and deduplicate memories by ID
        const allMemoriesRaw = [...searchResults, ...channelMemories, ...userFacts, ...globalKnowledge];
        const seenIds = new Set();
        const allMemories = allMemoriesRaw.filter(m => {
            if (!m || seenIds.has(m.id)) return false;
            seenIds.add(m.id);
            return true;
        });
        
        logger.info(`Fetched memories for prompt: ${channelMemories.length} channel, ${userFacts.length} user facts, ${globalKnowledge.length} global knowledge, ${searchResults.length} search results. (Total unique: ${allMemories.length})`);
        
        // Debug: Log summaries of fetched memories
        if (allMemories.length > 0) {
            logger.info('Memory summaries being added to prompt:', allMemories.map(m => `[${m.edgeType || 'fact'}] ${m.summary?.substring(0, 50)}...`));
        }

        // Also fetch general stats/top entities for broader context
        const stats = await getHypergraphStats(guildId);
        const topEntities = stats.topEntities?.slice(0, 5).map((e: any) => e.name).join(', ') || '';

        // Record access for retrieved memories (boosts importance)
        for (const memory of allMemories) {
            if (memory && memory.id) {
                await recordMemoryAccess(memory.id).catch((e: Error) => logger.warn(`Failed to record access for memory ${memory.id}`, e));
            }
        }

        if (allMemories.length > 0 || topEntities) {
            const memoryLines = allMemories.map(m => {
                if (!m) return null;
                const members = m.members || [];
                const memberInfo = members
                    .filter((mem: any) => mem && (mem.role === 'participant' || mem.role === 'subject' || mem.role === 'topic'))
                    .map((mem: any) => mem.name)
                    .join(', ');
                
                // Use camelCase keys mapped by persistence layer
                const dateStr = m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '';
                let line = `- [${dateStr}] ${m.summary}`;
                if (memberInfo) line += ` (Keywords: ${memberInfo})`;
                
                const content = m.content ? String(m.content) : '';
                if (content.length > 10 && content !== m.summary) {
                    // Include first 400 chars of content if it's different from summary
                    const cleanContent = content.substring(0, 400).replace(/\n+/g, ' ').trim();
                    line += `\n  Details: ${cleanContent}...`;
                }
                return line;
            }).filter(Boolean);
            
            if (memoryLines.length > 0 || topEntities) {
                hypergraphMemoriesSection = '\n--- INTERNAL KNOWLEDGE & RECENT EVENTS ---';
                hypergraphMemoriesSection += '\nThe following information is from your internal memory banks and covers recent news, documents, and past interactions. Use this as your primary source of truth for current events:';
                if (topEntities) {
                    hypergraphMemoriesSection += `\nTop entities in this server: ${topEntities}`;
                }
                if (memoryLines.length > 0) {
                    hypergraphMemoriesSection += `\n\n${memoryLines.join('\n')}`;
                }
                hypergraphMemoriesSection += '\n--- END OF KNOWLEDGE ---\n';
                logger.info('Generated Hypergraph Memories Section:', { length: hypergraphMemoriesSection.length });
            }
        }
    } catch (err) {
        logger.warn('Failed to fetch hypergraph memories (continuing without)', { 
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined 
        });
    }

    const finalPrompt = `
You are a human Discord user named ${botPersona.name}.

Who you are:
${botPersona.description}

Speaking style:
${botPersona.speakingStyle.map(s => `- ${s}`).join('\n')}

Rules you always follow:
${botPersona.globalRules.map(r => `- ${r}`).join('\n')}

Server: ${guildName ?? ''}

Your relationship with ${username}:
${relationship.attitude} attitude, ${relationship.behavior && relationship.behavior.length > 0 ? relationship.behavior.join(', ') : 'treat them normally'}
Boundaries:
${relationship.boundaries.map(b => `- ${b}`).join('\n')}

Server user relationships (recent participants):
${relationshipLines.join('\n')}
${hypergraphMemoriesSection}

Recent conversation (for continuity):
${context.map(m => `${m.author}: ${m.content}`).join('\n')}

Message you are replying to:
${username}: ${userMessage}

Respond naturally. Stay in character. Use your knowledge section above to maintain coherence and awareness of current events.
`.trim();

    logger.info('Final Prompt constructed (partial):', { prompt: finalPrompt.substring(0, 3000) });
    return finalPrompt;
}