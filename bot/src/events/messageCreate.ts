/**
 * Message Create Event Handler
 *
 * Handles incoming Discord messages and decides whether to reply.
 * Uses hypergraph memory system for long-term context and recent messages for continuity.
 *
 * @module bot/src/events/messageCreate
 */

import { Client, Message } from 'discord.js';

import { getApiConfig, getBotConfig, getMemoryConfig, getReplyBehavior } from '@shared/config/configLoader.js';
import { loadContexts, logAnalyticsEvent, logBotReply } from '@shared/storage/persistence.js';
import { logger } from '@shared/utils/logger.js';

import { buildPrompt } from '@core/prompt.js';
import { ReplyBehaviorConfig, Relationship as ReplyDeciderRelationship, shouldReply } from '@core/replyDecider.js';
import { addMessage } from '@memory/context.js';
import { generateReply } from '@llm/index.js';
import { getAllRelationships, getRelationship, GuildRelationships, Relationship } from '@personality/relationships.js';
import { executeInSandbox, extractDockerCommand, isSandboxEnabled } from '@sandbox/index.js';
import { createMemoryData } from '@memory/structuralExtractor.js';
import { createHyperedge, getHypergraphConfig } from '@shared/storage/hypergraphPersistence.js';

const SANDBOX_KEYWORDS = ['docker', 'sandbox', 'container', 'docker command'];

/**
 * Handles the messageCreate Discord event.
 * Processes messages and generates replies when appropriate.
 *
 * @param message - The Discord message object
 * @param client - The Discord client instance
 */
export async function handleMessageCreate(message: Message, client: Client): Promise<void> {
    if (message.author.bot) return;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const cleanMessage = message.content.replace(/<@!?\d+>/g, '').trim();
    const channelName = (message.channel as { name?: string }).name ?? 'unknown';

    logger.message(`Received message from ${message.author.username} in ${message.guild.name}/#${channelName}`, {
        guildId,
        channelId: message.channel.id,
        userId: message.author.id,
    });

    const botConfig = await getBotConfig(guildId);
    const memoryConfig = await getMemoryConfig();
    const replyBehavior = await getReplyBehavior(guildId);

    const guildSpecificChannels = (replyBehavior.guildSpecificChannels as Record<string, { ignored?: string[] }>) ?? {};
    const guildIgnoredChannels = guildSpecificChannels[guildId]?.ignored ?? [];
    const isChannelIgnored = guildIgnoredChannels.includes(message.channel.id);

    if (isChannelIgnored) {
        logger.info(`Skipping message storage for ignored channel #${channelName}`, {
            guildId,
            channelId: message.channel.id,
        });
        return;
    }

    logger.info('Loaded message handling config', {
        guildId,
        botName: botConfig.name,
        mentionOnly: replyBehavior.mentionOnly,
        replyProbability: replyBehavior.replyProbability,
    });

    logger.message(`@mention from ${message.author.username} in #${channelName}: "${cleanMessage}"`);

    const botUserId = client.user?.id;
    const isMentioned = botUserId ? message.mentions.has(botUserId) : false;

    logger.info(`Logging analytics event: message_received, isMentioned=${isMentioned}`);
    await logAnalyticsEvent(
        'message_received',
        guildId,
        message.channel.id,
        message.author.id,
        {
            messageLength: message.content.length,
            isMentioned: isMentioned,
            channelName: channelName,
            username: message.author.username
        }
    );

    if (isMentioned) {
        await logAnalyticsEvent(
            'user_mentioned',
            guildId,
            message.channel.id,
            message.author.id,
            { channelName: channelName, username: message.author.username }
        );
    }

    try {
        const relationship = getRelationship(
            guildId,
            message.author.id
        );

        logger.info('Loaded user relationship for message handling', {
            guildId,
            userId: message.author.id,
            relationship,
        });

        await addMessage(
            guildId,
            message.channel.id,
            message.author.id,
            message.author.username,
            message.content
        );

        // Create hypergraph memory from message structure (no LLM call)
        try {
            const config = await getHypergraphConfig(guildId);
            if (config.extractionEnabled) {
                const memoryData = createMemoryData(message);
                if (memoryData) {
                    await createHyperedge(guildId, memoryData);
                }
            }
        } catch (err) {
            // Don't let hypergraph errors break message handling
            logger.warn('Failed to create hypergraph memory (non-critical)', err);
        }

        const { maxMessages } = memoryConfig;
        const context = (await loadContexts(guildId, message.channel.id, maxMessages)).slice(0, -1);
        const guildRelationships = getAllRelationships()[guildId] ?? ({} as GuildRelationships);

        logger.info('Loaded context for reply generation', {
            guildId,
            contextMessages: context.length,
            relationshipCount: Object.keys(guildRelationships).length,
        });

        const prompt = await buildPrompt({
            relationship: relationship as unknown as Relationship,
            context,
            guildRelationships,
            guildName: message.guild.name,
            userMessage: cleanMessage,
            username: message.author.username,
            botConfig,
            guildId,
            channelId: message.channel.id,
            userId: message.author.id
        });

        const hasSandboxKeyword = SANDBOX_KEYWORDS.some(keyword => 
            cleanMessage.toLowerCase().includes(keyword)
        );
        
        const hasDockerCommandIntent = cleanMessage.toLowerCase().includes('docker command');
        const requiresMention = replyBehavior.mentionOnly;
        
        const isSandboxRequest = !requiresMention 
            ? (hasSandboxKeyword || hasDockerCommandIntent)
            : (isMentioned && (hasSandboxKeyword || hasDockerCommandIntent));

        logger.info('Mention and sandbox detection', { isMentioned, hasSandboxKeyword, isSandboxRequest, requiresMention, cleanMessage: cleanMessage.substring(0, 50) });

        if (isSandboxRequest) {
            logger.info('Detected sandbox request', { guildId, cleanMessage });
            
            const sandboxEnabled = await isSandboxEnabled();
            
            if (!sandboxEnabled) {
                await message.reply('Sandbox is currently disabled. Enable it in the bot settings.');
                return;
            }

            try {
                const dockerCommand = await extractDockerCommand(cleanMessage);
                
                if (!dockerCommand) {
                    await message.reply('I couldn\'t understand that as a Docker command. Try something like "docker ps" or "check container stats".');
                    return;
                }

                logger.info('Executing docker command in sandbox', { command: dockerCommand });
                const result = await executeInSandbox(dockerCommand);
                
                let response: string;
                if (result.success) {
                    response = `\`$ ${dockerCommand}\`\n\n${result.stdout || result.stderr || '(no output)'}`;
                } else {
                    response = `Command failed: ${result.error || `Exit code: ${result.exitCode}`}`;
                }

                if (response.length > 1900) {
                    response = response.substring(0, 1897) + '...';
                }

                await message.reply(response);
                return;
            } catch (sandboxErr) {
                logger.error('Sandbox execution failed', sandboxErr);
                await message.reply(`Sandbox error: ${sandboxErr instanceof Error ? sandboxErr.message : String(sandboxErr)}`);
                return;
            }
        }

        logger.info('Evaluating reply decision', {
            guildId,
            isMentioned,
            replyBehavior,
        });
        
        const replyDecision = await shouldReply({ message, isMentioned, replyBehavior: replyBehavior as unknown as ReplyBehaviorConfig, relationship: relationship as unknown as ReplyDeciderRelationship, context, botName: botConfig.name });
        logger.info('Reply decision evaluated', {
            guildId,
            shouldReply: replyDecision.result,
            reason: replyDecision.reason,
        });

        await logAnalyticsEvent(
            'reply_attempt',
            guildId,
            message.channel.id,
            message.author.id,
            {
                reason: replyDecision.reason,
                probability: replyBehavior.replyProbability,
                contextLength: context.length,
                username: message.author.username,
                channelName: channelName
            }
        );

        if (!replyDecision.result) {
            logger.info(`Bot decided not to reply in guild ${message.guild.name}`, {
                guildId,
                reason: replyDecision.reason,
            });

            let declineReason = 'unknown';
            const reasonLower = replyDecision.reason.toLowerCase();
            if (reasonLower.includes('ignore list')) declineReason = 'user_ignored';
            else if (reasonLower.includes('channel')) declineReason = 'channel_ignored';
            else if (reasonLower.includes('keyword')) declineReason = 'keyword';
            else if (reasonLower.includes('relationship')) declineReason = 'relationship_ignored';
            else if (reasonLower.includes('mention')) declineReason = 'mention_required';
            else if (reasonLower.includes('probability')) declineReason = 'probability_fail';
            else if (reasonLower.includes('roll')) declineReason = 'probability_fail';

            logger.info(`Logging analytics event: reply_declined, reason=${declineReason}`);
            await logAnalyticsEvent(
                'reply_declined',
                guildId,
                message.channel.id,
                message.author.id,
                {
                    reason: declineReason,
                    fullReason: replyDecision.reason,
                    username: message.author.username,
                    channelName: channelName
                }
            );
            return;
        }

        logger.info(`Bot decided to reply in guild ${message.guild.name}`, { guildId });

        const startTime = Date.now();
        const { text: reply, usageMetadata } = await generateReply(prompt);
        const processingTimeMs = Date.now() - startTime;

        logger.info('Generated LLM reply payload', {
            guildId,
            replyLength: reply?.length ?? 0,
            processingTimeMs,
        });

        if (reply) {
            let finalReply = reply;
            if (reply.length > 2000) {
                finalReply = reply.substring(0, 1997) + '...';
                logger.warn(`Reply truncated from ${reply.length} to 2000 chars`);
            }

            logger.info('Sending Discord reply', {
                guildId,
                channelId: message.channel.id,
                finalReplyLength: finalReply.length,
            });

            const textChannel = message.channel as { sendTyping: () => Promise<void> };
            await textChannel.sendTyping();

            await message.reply(finalReply);

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
                usageMetadata?.promptTokenCount ?? 0,
                usageMetadata?.candidatesTokenCount ?? 0
            );

            await addMessage(
                guildId,
                message.channel.id,
                client.user?.id ?? 'bot',
                botConfig.name,
                finalReply
            );

            const apiConfig = await getApiConfig();
            const provider = apiConfig.provider ?? 'gemini';
            const providerModel = provider === 'ollama'
                ? (apiConfig.ollamaModel ?? 'llama3.2')
                : provider === 'qwen'
                    ? (apiConfig.qwenModel ?? 'qwen-plus')
                    : (apiConfig.geminiModel ?? 'gemini-2.0-flash');

            await logAnalyticsEvent(
                'reply_sent',
                message.guild.id,
                message.channel.id,
                message.author.id,
                {
                    processingTimeMs: processingTimeMs,
                    promptTokens: usageMetadata?.promptTokenCount ?? 0,
                    responseTokens: usageMetadata?.candidatesTokenCount ?? 0,
                    replyLength: finalReply.length,
                    contextLength: context.length,
                    provider: provider,
                    model: providerModel,
                    username: message.author.username,
                    channelName: channelName
                }
            );

            await logAnalyticsEvent(
                'llm_call',
                message.guild.id,
                message.channel.id,
                message.author.id,
                {
                    provider: provider,
                    model: providerModel,
                    latencyMs: processingTimeMs,
                    promptTokens: usageMetadata?.promptTokenCount ?? 0,
                    responseTokens: usageMetadata?.candidatesTokenCount ?? 0
                }
            );

            logger.api(`→ ${provider}(${providerModel}):generateReply() -> Discord API: message.reply()`);

            const replyPreview = finalReply.substring(0, 80).replace(/\n/g, ' ');
            logger.message(`✓ Replied to ${message.author.username}: "${replyPreview}"`);
        } else {
            logger.warn('No reply text generated by LLM', { guildId });
        }
    } catch (err) {
        const error = err as Error;
        let errorType = 'unknown';
        let statusCode: number | undefined;

        if (error.message.includes('429') || error.message.includes('rate limit')) {
            errorType = 'rate_limit';
        } else if (error.message.includes('timeout')) {
            errorType = 'timeout';
        } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
            errorType = 'server_error';
        } else if (error.message.includes('400') || error.message.includes('invalid')) {
            errorType = 'invalid_request';
        }

        const errorStatusMatch = error.message.match(/status[:\s]+(\d+)/i);
        if (errorStatusMatch) {
            statusCode = parseInt(errorStatusMatch[1], 10);
        }

        const errorApiConfig = await getApiConfig();
        const errorProvider = errorApiConfig.provider ?? 'gemini';
        const errorProviderModel = errorProvider === 'ollama'
            ? (errorApiConfig.ollamaModel ?? 'llama3.2')
            : errorProvider === 'qwen'
                ? (errorApiConfig.qwenModel ?? 'qwen-plus')
                : (errorApiConfig.geminiModel ?? 'gemini-2.0-flash');

        await logAnalyticsEvent(
            'llm_error',
            guildId,
            message.channel.id,
            message.author.id,
            {
                provider: errorProvider,
                model: errorProviderModel,
                errorType: errorType,
                statusCode: statusCode,
                message: error.message.substring(0, 500)
            }
        ).catch(() => {});

        logger.error(`Error handling messageCreate event in guild ${message.guild.name} (${guildId})`, err);
    }
}