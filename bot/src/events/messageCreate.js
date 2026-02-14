import { logger } from '../../../shared/utils/logger.js';
import { generateReply } from '../llm/index.js';
import { getRelationship } from '../personality/relationships.js';
import { addMessage } from '../memory/context.js';
import { loadContexts, logBotReply } from '../../../shared/storage/persistence.js';
import { buildPrompt } from '../core/prompt.js';
import { shouldReply } from '../core/replyDecider.js';
import { getBotConfig, getApiConfig, getReplyBehavior, getMemoryConfig } from '../../../shared/config/configLoader.js';
import { getAllRelationships } from '../personality/relationships.js';

export async function handleMessageCreate(message, client) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const cleanMessage = message.content.replace(/<@!?\d+>/g, '').trim();

    // Get server-specific configs
    const botConfig = await getBotConfig(guildId);
    const memoryConfig = await getMemoryConfig(guildId);
    const replyBehavior = await getReplyBehavior(guildId);

    // Log that bot was mentioned
    logger.message(`@mention from ${message.author.username} in #${message.channel.name}: "${cleanMessage}"`);

    try {
        // Get the mentioned user's relationship and recent context
        const relationship = getRelationship(
            guildId,
            message.author.id
        );

        // Add this message to context BEFORE building prompt
        await addMessage(
            guildId,
            message.channel.id,
            message.author.id,
            message.author.username,
            message.content
        );

        // Build prompt with context
        const { maxMessages } = memoryConfig;
        const context = (await loadContexts(guildId, message.channel.id, maxMessages)).slice(0, -1);
        const guildRelationships = getAllRelationships()[guildId] ?? {};

        const prompt = await buildPrompt({
            relationship,
            context,
            guildRelationships,
            guildName: message.guild.name,
            userMessage: cleanMessage,
            username: message.author.username,
            botConfig, // Pass server-specific bot config to prompt builder
            guildId
        });

        // Check if we should reply
        const isMentioned = message.mentions.has(client.user);
        const replyDecision = await shouldReply({ message, isMentioned, replyBehavior, relationship, context, botName: botConfig.name });

        if (!replyDecision.result) {

            return;
        }


        const startTime = Date.now();
        const { text: reply, usageMetadata } = await generateReply(prompt);
        const processingTimeMs = Date.now() - startTime;

        if (reply) {
            // Validate message length (Discord limit: 2000 chars)
            let finalReply = reply;
            if (reply.length > 2000) {
                finalReply = reply.substring(0, 1997) + '...';
                logger.warn(`Reply truncated from ${reply.length} to 2000 chars`);
            }

            // Show typing indicator while generating reply
            await message.channel.sendTyping();

            // Send reply
            await message.reply(finalReply);

            // Log bot reply to database
            await logBotReply(
                message.guild.id,
                message.channel.id,
                message.author.id,
                message.author.username,
                message.member?.displayName ?? message.author.username,
                message.author.displayAvatarURL({ extension: 'png', size: 64 }),
                cleanMessage,
                finalReply,
                processingTimeMs,
                usageMetadata?.promptTokenCount,
                usageMetadata?.candidatesTokenCount
            );

            // Add the bot's reply to the context
            await addMessage(
                guildId,
                message.channel.id,
                client.user.id,
                botConfig.name,
                finalReply
            );

            // Single combined API-level log: Gemini model -> Discord send
            const apiConfig = await getApiConfig();
            const { geminiModel } = apiConfig;
            logger.api(`→ Gemini(${geminiModel}):generateReply() -> Discord API: message.reply()`);

            // Log successful reply with a short preview for readability
            const replyPreview = finalReply.substring(0, 80).replace(/\n/g, ' ');
            logger.message(`✓ Replied to ${message.author.username}: "${replyPreview}"`);
        }
    } catch (err) {
        logger.error('Error handling messageCreate event', err);
    }
}
