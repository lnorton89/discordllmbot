/**
 * Reply strategy implementations for Phase B
 * Each strategy exposes a `shouldReply` function that returns boolean
 */

export function MentionOnlyStrategy({ message, isMentioned, replyBehavior }) {
    // Strict mention-only behavior
    return isMentioned
}

export function PassiveStrategy({ message, isMentioned, replyBehavior }) {
    // Passive: only reply when mentioned, but may apply stricter probability elsewhere
    return isMentioned
}

export function DisabledStrategy() {
    return false
}

export function ActiveStrategy({ message, isMentioned, replyBehavior, context = [], botName = '' }) {
    // Active: reply when mentioned OR when recent context references the bot
    if (isMentioned) return true

    // Check recent context (last 3 messages) for mention tags or bot name
    const recent = context.slice(-3)
    const lowerBot = (botName || '').toLowerCase()
    for (const m of recent) {
        if (!m || !m.content) continue
        const content = m.content.toLowerCase()
        if (/<@!?(\d+)>/.test(m.content)) return true
        if (lowerBot && content.includes(lowerBot)) return true
    }

    // As a last resort, if the incoming message looks like a direct question, allow a reply
    const text = (message.content || '').trim()
    if (text.endsWith('?')) return true

    // Proactive reply chance for 'active' mode
    const proactiveChance = replyBehavior.proactiveReplyChance ?? 0
    if (proactiveChance > 0 && Math.random() < proactiveChance) return true

    return false
}
