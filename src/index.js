import 'dotenv/config'
import { Client, GatewayIntentBits, Partials } from 'discord.js'

import { generateReply } from './llm/gemini.js'
import { getRelationship } from './personality/relationships.js'
import { addMessage, getContext } from './memory/context.js'
import { buildPrompt } from './utils/prompt.js'
import { validateEnvironment } from './config/validation.js'
import { logger } from './utils/logger.js'
import { saveRelationships } from './storage/persistence.js'

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
})

// Startup: Validate environment
try {
    validateEnvironment()
} catch (err) {
    logger.error('Startup failed', err)
    process.exit(1)
}

client.once('clientReady', () => {
    logger.info(`✓ Logged in as ${client.user.tag}`)
})

client.on('messageCreate', async (message) => {
    if (message.author.bot) return
    if (!message.guild) return

    addMessage(
        message.channel.id,
        message.author.username,
        message.content
    )

    if (!message.mentions.has(client.user)) return

    const relationship = getRelationship(
        message.guild.id,
        message.author.id
    )

    // remove the triggering message from context
    const context = getContext(message.channel.id).slice(0, -1)

    const prompt = buildPrompt({
        relationship,
        context,
        userMessage: message.content,
        username: message.author.username
    })

    try {
        // Show typing indicator while generating reply
        await message.channel.sendTyping()

        // Simulate human response time
        await new Promise(r => setTimeout(r, Math.random() * 2000))

        const reply = await generateReply(prompt)
        
        if (reply) {
            // Validate message length (Discord limit: 2000 chars)
            if (reply.length > 2000) {
                const truncated = reply.substring(0, 1997) + '...'
                logger.warn(`Reply truncated from ${reply.length} to 2000 chars`)
                await message.reply(truncated)
            } else {
                await message.reply(reply)
            }
        }
    } catch (err) {
        logger.error('Failed to generate reply', err)
        await message.reply("brain lag, one sec")
    }
})

// Graceful shutdown: Save state before exit
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...')
    try {
        await client.destroy()
        logger.info('✓ Discord client disconnected')
    } catch (err) {
        logger.error('Error during shutdown', err)
    }
    process.exit(0)
})

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...')
    try {
        await client.destroy()
        logger.info('✓ Discord client disconnected')
    } catch (err) {
        logger.error('Error during shutdown', err)
    }
    process.exit(0)
})

client.login(process.env.DISCORD_TOKEN)

