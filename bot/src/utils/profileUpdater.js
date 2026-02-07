import { logger } from '../../shared/utils/logger.js'

/**
 * Update Discord bot profile (username and avatar)
 * @param {Client} client - Discord.js client
 * @param {Object} botConfig - Bot configuration from config.json
 */
export async function updateDiscordProfile(client, botConfig) {
    const updates = []

    // Update Discord username if different
    if (botConfig.username && botConfig.username !== client.user.username) {
        try {
            await client.user.setUsername(botConfig.username)
            logger.api(`→ Discord API: user.setUsername()`)
            logger.api(`  New username: ${botConfig.username}`)
            updates.push('username')
        } catch (err) {
            if (err.message?.includes('rate limited') || err.code === 429) {
                logger.warn(
                    `Cannot update username: Discord rate limit (must wait before changing again). Current: "${client.user.username}"`
                )
            } else if (err.message?.includes('changed too many times')) {
                logger.warn(
                    `Cannot update username: Changed too recently. Wait before trying again.`
                )
            } else {
                logger.error('Failed to update Discord username', err)
            }
        }
    }

    // Update avatar if provided and different
    if (botConfig.avatarUrl) {
        try {
            // Check if avatar URL is valid
            if (!isValidImageUrl(botConfig.avatarUrl)) {
                logger.warn(`Invalid avatar URL in config: ${botConfig.avatarUrl}`)
            } else {
                // Get current avatar URL (strip query params for comparison)
                const currentAvatarUrl = client.user.avatarURL()
                const currentAvatarBase = currentAvatarUrl ? currentAvatarUrl.split('?')[0] : null
                const configAvatarBase = botConfig.avatarUrl.split('?')[0]
                
                if (configAvatarBase !== currentAvatarBase) {
                    await client.user.setAvatar(botConfig.avatarUrl)
                    logger.api(`→ Discord API: user.setAvatar()`)
                    logger.api(`  New avatar URL: ${botConfig.avatarUrl.substring(0, 100)}...`)
                    updates.push('avatar')
                }
            }
        } catch (err) {
            if (err.message?.includes('rate limited') || err.code === 429) {
                logger.warn(`Cannot update avatar: Discord rate limit. Try again later.`)
            } else {
                logger.error('Failed to update Discord avatar', err)
            }
        }
    }

    if (updates.length === 0) {
        logger.info('Discord profile already matches config')
    }
}

/**
 * Validate that URL is a valid image URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL looks like a valid image URL
 */
function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false
    try {
        new URL(url)
        return /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || url.includes('data:image')
    } catch {
        return false
    }
}
