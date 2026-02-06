import { saveContext, loadContexts } from '../storage/persistence.js'
import { getMemoryConfig } from '../config/configLoader.js'

const memory = loadContexts()
const { maxMessages } = getMemoryConfig()

export function addMessage(channelId, author, content) {
    memory[channelId] ??= []

    memory[channelId].push({
        author,
        content
    })

    if (memory[channelId].length > maxMessages) {
        memory[channelId].shift()
    }

    // Persist this channel's context
    saveContext(channelId, memory[channelId])
}

export function getContext(channelId) {
    return memory[channelId] ?? []
}
