import { logger } from '../../shared/utils/logger.js'
import { setRelationship } from '../personality/relationships.js'
import { getBotConfig } from '../../shared/config/configLoader.js'

export async function handleGuildMemberAdd(member) {
    if (member.user.bot) return
    const guildId = member.guild.id
    const guildName = member.guild.name
    const userId = member.id

    try {
        const displayName = member.displayName ?? member.user.username ?? userId
        const username = member.user.username ?? userId
        const defaultRel = getBotConfig().defaultRelationship ?? { attitude: 'neutral', behavior: [], boundaries: [] }

        setRelationship(guildId, guildName, userId, {
            username,
            displayName,
            attitude: defaultRel.attitude,
            behavior: Array.isArray(defaultRel.behavior) ? [...defaultRel.behavior] : [],
            boundaries: Array.isArray(defaultRel.boundaries) ? [...defaultRel.boundaries] : []
        })

        logger.info(`Relationship entry created for new member ${username} in server "${guildName}"`)
    } catch (e) {
        logger.warn(`Failed to add relationship for new member ${member.id} in server "${member.guild.name}"`, e)
    }
}
