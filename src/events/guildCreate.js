import { logger } from '../../shared/utils/logger.js'
import { loadGuildRelationships, initializeGuildRelationships } from '../personality/relationships.js'
import { loadGuildContexts } from '../memory/context.js'

export async function handleGuildCreate(guild) {
    try {
        loadGuildRelationships(guild.id);
        loadGuildContexts(guild.id);
        await initializeGuildRelationships(guild)
        logger.info(`Guild joined: initialized guild data for server "${guild.name}"`)
    } catch (e) {
        logger.warn(`Failed to initialize guild data for server "${guild.name}"`, e)
    }
}
