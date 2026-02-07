import { logger } from '../../shared/utils/logger.js'
import { updateDiscordProfile } from '../utils/profileUpdater.js'
import { loadGuildRelationships, initializeGuildRelationships } from '../personality/relationships.js'
import { loadGuildContexts } from '../memory/context.js'

export async function handleClientReady(client, botConfig) {
    logger.info(`✓ Logged in as ${client.user.tag}`)
    
    // Update Discord profile if config differs from current state
    await updateDiscordProfile(client, botConfig)

    // Log server count
    const guildCount = client.guilds.cache.size
    if (guildCount === 0) {
        logger.info('Not connected to any servers')
    } else {
        logger.info(`✓ Connected to ${guildCount} server${guildCount > 1 ? 's' : ''}`)
    }

    // Initialize relationships and contexts for existing guilds
    try {
        for (const [, guild] of client.guilds.cache) {
            try {
                loadGuildRelationships(guild.id, guild.name)
                loadGuildContexts(guild.id, guild.name)
                await initializeGuildRelationships(guild)
                logger.info(`Initialized relationships and contexts for server "${guild.name}"`)
            } catch (e) {
                logger.warn(`Failed to initialize guild data for server "${guild.name}"`, e)
            }
        }
    } catch (e) {
        logger.warn('Error during guild initialization', e)
    }
}
