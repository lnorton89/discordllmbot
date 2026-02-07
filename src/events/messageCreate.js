import { logger } from '../../shared/utils/logger.js'
import { generateReply } from '../llm/gemini.js'
import { getRelationship } from '../personality/relationships.js'
import { addMessage, getContext, loadGuildContexts } from '../memory/context.js';
import { loadContexts } from '../../shared/storage/persistence.js';
import { buildPrompt } from '../core/prompt.js'
import { shouldReply } from '../core/replyDecider.js'
import { calculateDelay } from '../core/responseDelay.js'
import { getBotConfig, getApiConfig, getReplyBehavior, getMemoryConfig } from '../../shared/config/configLoader.js';
import { getAllRelationships } from '../personality/relationships.js'

export async function handleMessageCreate(message, client) {
    if (message.author.bot) return
    if (!message.guild) return

    const cleanMessage = message.content.replace(/<@!?\d+>/g, '').trim()
    const botConfig = getBotConfig()

    // Log that bot was mentioned
    logger.message(`@mention from ${message.author.username} in #${message.channel.name}: "${cleanMessage}"`)

    try {
        // Get the mentioned user's relationship and recent context
        const relationship = getRelationship(
            message.guild.id,
            message.author.id
        )

        // Add this message to context BEFORE building prompt
        addMessage(
            message.guild.id,
            message.channel.id,
            message.author.id,
            message.author.username,
            message.content
        );

        // Build prompt with context
        const { maxMessages } = getMemoryConfig();
        const context = (await loadContexts(message.guild.id, message.channel.id, maxMessages)).slice(0, -1);
        const guildRelationships = getAllRelationships()[message.guild.id] ?? {}

        const prompt = buildPrompt({
            relationship,
            context,
            guildRelationships,
            guildName: message.guild.name,
            userMessage: cleanMessage,
            username: message.author.username
        })

        // Check if we should reply
        const replyBehavior = getReplyBehavior() ?? {}
        const isMentioned = message.mentions.has(client.user)
        const replyDecision = shouldReply({ message, isMentioned, replyBehavior, relationship, context, botName: botConfig.name });

        if (!replyDecision.result) {

            return
        }

        // Show typing indicator while generating reply
        await message.channel.sendTyping()

        // Use configured human-like delay before generating
        const delayMs = calculateDelay(replyBehavior)
        await new Promise(r => setTimeout(r, delayMs))

        const reply = await generateReply(prompt)

        if (reply) {
            // Validate message length (Discord limit: 2000 chars)
            let finalReply = reply
            if (reply.length > 2000) {
                finalReply = reply.substring(0, 1997) + '...'
                logger.warn(`Reply truncated from ${reply.length} to 2000 chars`)
            }

            // Send reply
            await message.reply(finalReply)

            // Add the bot's reply to the context
            addMessage(
                message.guild.id,
                message.channel.id,
                client.user.id,
                botConfig.name,
                finalReply
            );

            // Single combined API-level log: Gemini model -> Discord send
            const { geminiModel } = getApiConfig()
            logger.api(`→ Gemini(${geminiModel}):generateReply() -> Discord API: message.reply()`)

            // Log successful reply with a short preview for readability
            const replyPreview = finalReply.substring(0, 80).replace(/\n/g, ' ')
            logger.message(`✓ Replied to ${message.author.username}: "${replyPreview}"`)
        }
    } catch (err) {
        logger.error(`Error processing mention from ${message.author.username}`, err)
    }
}
