import { botPersona } from '../personality/botPersona.js'

/**
 * Builds the prompt string to send to the Gemini API.
 *
 * @param {Object} params - The parameters for building the prompt.
 * @param {Object} params.relationship - The relationship object for the user triggering the reply.
 * @param {Array<Object>} params.context - The recent message history for the channel.
 * @param {Object} [params.guildRelationships={}] - A map of all user relationships in the guild.
 * @param {string} [params.guildName=''] - The name of the guild.
 * @param {string} params.userMessage - The content of the user's message.
 * @param {string} params.username - The username of the user triggering the reply.
 * @returns {string} The constructed prompt string.
 */
export function buildPrompt({
  relationship,
  context,
  guildRelationships = {},
  guildName = '',
  userMessage,
  username
}) {
  // Build a compact view of relationships for users present in the recent context
  const uniqueUserIds = Array.from(new Set(context.map(m => m.authorId).filter(Boolean)))
  const relationshipLines = uniqueUserIds.map(id => {
    const rel = guildRelationships[id] ?? { attitude: 'unknown', behavior: [], boundaries: [], username: id }
    const nameFromContext = (context.find(m => m.authorId === id)?.author)
    const display = rel.displayName ?? rel.username ?? nameFromContext ?? id
    const usernameNote = rel.username && rel.username !== display ? ` (${rel.username})` : ''
    return `${display}${usernameNote}: Attitude=${rel.attitude}; Behavior=${rel.behavior.join('; ') || 'none'}`
  })

  return `
You are a human Discord user named ${botPersona.name}.

Who you are:
${botPersona.description}

Speaking style:
${botPersona.speakingStyle.map(s => `- ${s}`).join('\n')}

Rules you always follow:
${botPersona.globalRules.map(r => `- ${r}`).join('\n')}

Server: ${guildName ?? ''}

Your relationship with ${username}:
Attitude: ${relationship.attitude}
Behavior rules:
${relationship.behavior.map(b => `- ${b}`).join('\n')}
Boundaries:
${relationship.boundaries.map(b => `- ${b}`).join('\n')}

Server user relationships (recent participants):
${relationshipLines.join('\n')}

Recent conversation (context only):
${context.map(m => `${m.author}: ${m.content}`).join('\n')}

Message you are replying to:
${username}: ${userMessage}

Respond naturally. Stay in character.
`.trim()
}
