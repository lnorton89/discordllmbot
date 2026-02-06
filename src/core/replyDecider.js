import { MentionOnlyStrategy, PassiveStrategy, ActiveStrategy, DisabledStrategy } from '../strategies/replyStrategies.js'

/**
 * Decide whether the bot should reply to a message based on config and relationship
 * Strategy pattern: choose behavior by `replyBehavior.mode`
 */
export function shouldReply({ message, isMentioned, replyBehavior = {}, relationship = {}, context = [], botName = '' }) {
    const mode = replyBehavior.mode ?? 'mention-only'
    const requireMention = replyBehavior.requireMention ?? true
    const prob = typeof replyBehavior.replyProbability === 'number' ? replyBehavior.replyProbability : 1.0
    const ignoreUsers = replyBehavior.ignoreUsers ?? []
    const ignoreChannels = replyBehavior.ignoreChannels ?? []
    const ignoreKeywords = replyBehavior.ignoreKeywords ?? []

    // Basic ignores and preconditions
    if (mode === 'disabled') return false
    if (requireMention && !isMentioned) return false
    if (ignoreUsers.includes(message.author.id)) return false
    if (ignoreChannels.includes(message.channel.id)) return false

    const contentLower = (message.content || '').toLowerCase()
    for (const kw of ignoreKeywords) {
        if (!kw) continue
        if (contentLower.includes(kw.toLowerCase())) return false
    }

    // Strategy selection
    let decision = false
    const params = { message, isMentioned, replyBehavior, relationship, context, botName }
    switch (mode) {
        case 'active':
            decision = ActiveStrategy(params)
            break
        case 'passive':
            decision = PassiveStrategy(params)
            break
        case 'disabled':
            decision = DisabledStrategy(params)
            break
        case 'mention-only':
        default:
            decision = MentionOnlyStrategy(params)
            break
    }

    if (!decision) return false

    // Apply probability roll
    if (prob <= 0) return false
    if (prob < 1) {
        if (Math.random() > prob) return false
    }

    return true
}
