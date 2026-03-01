/**
 * Memory Decay Manager
 *
 * Background process that:
 * 1. Calculates memory urgency based on age and access patterns
 * 2. Prunes low-urgency memories
 * 3. Boosts frequently accessed memories
 *
 * Uses exponential decay: urgency = importance * exp(-decayRate * daysSinceCreation) + (accessCount * boost)
 *
 * @module bot/src/memory/decay
 */

import { logger } from '@shared/utils/logger.js';
import { Client } from 'discord.js';
import {
    updateMemoryUrgency,
    pruneLowUrgencyMemories,
    getHypergraphConfig
} from '@shared/storage/hypergraphPersistence.js';

interface DecayConfig {
    decayRate: number;
    importanceBoostOnAccess: number;
    minUrgencyThreshold: number;
    pruneOlderThanDays: number;
}

const DEFAULT_CONFIG: DecayConfig = {
    decayRate: 0.1,        // 10% decay per day
    importanceBoostOnAccess: 0.05,
    minUrgencyThreshold: 0.1,
    pruneOlderThanDays: 30,
};

class DecayManager {
    private interval: NodeJS.Timeout | null = null;
    private isRunning = false;
    private client: Client | null = null;

    /**
     * Set the Discord client (needed to access guilds)
     */
    setClient(client: Client) {
        this.client = client;
    }

    /**
     * Start the decay process
     * @param intervalMinutes - How often to run decay (default: hourly)
     */
    start(intervalMinutes = 60) {
        if (this.isRunning) {
            logger.warn('Decay manager already running');
            return;
        }

        this.isRunning = true;
        logger.info(`Starting memory decay manager (interval: ${intervalMinutes} minutes)`);

        // Run immediately on start
        this.runDecay();

        // Schedule recurring runs
        this.interval = setInterval(() => {
            this.runDecay();
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * Stop the decay process
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
        logger.info('Memory decay manager stopped');
    }

    /**
     * Run the decay process for all guilds
     */
    private async runDecay() {
        const startTime = Date.now();
        logger.info('Running memory decay process...');

        if (!this.client) {
            logger.warn('Decay manager: No client set, skipping decay run');
            return;
        }

        try {
            const guilds = this.client.guilds.cache;
            let totalUpdated = 0;
            let totalPruned = 0;

            for (const [guildId, guild] of guilds) {
                try {
                    // Get guild-specific config
                    const config = await this.getGuildConfig(guildId);

                    // Update urgency scores
                    const updated = await updateMemoryUrgency(
                        guildId,
                        config.decayRate,
                        config.importanceBoostOnAccess
                    );
                    totalUpdated += updated.length;

                    // Prune low urgency memories
                    const pruned = await pruneLowUrgencyMemories(
                        guildId,
                        config.minUrgencyThreshold,
                        config.pruneOlderThanDays
                    );
                    totalPruned += pruned || 0;

                    logger.info(`Decay complete for ${guild.name}: ${updated.length} updated, ${pruned} pruned`);
                } catch (error) {
                    logger.error(`Decay failed for guild ${guild.name}`, error);
                }
            }

            const duration = Date.now() - startTime;
            logger.info(`Memory decay complete: ${totalUpdated} updated, ${totalPruned} pruned (${duration}ms)`);
        } catch (error) {
            logger.error('Memory decay process failed', error);
        }
    }

    /**
     * Get decay configuration for a guild
     */
    private async getGuildConfig(guildId: string): Promise<DecayConfig> {
        const config = await getHypergraphConfig(guildId);

        return {
            decayRate: config.decayRate ?? DEFAULT_CONFIG.decayRate,
            importanceBoostOnAccess: config.importanceBoostOnAccess ?? DEFAULT_CONFIG.importanceBoostOnAccess,
            minUrgencyThreshold: config.minUrgencyThreshold ?? DEFAULT_CONFIG.minUrgencyThreshold,
            pruneOlderThanDays: DEFAULT_CONFIG.pruneOlderThanDays,
        };
    }

    /**
     * Manually trigger decay for a specific guild
     */
    async triggerForGuild(guildId: string) {
        logger.info(`Manual decay trigger for guild ${guildId}`);
        const config = await this.getGuildConfig(guildId);
        const updated = await updateMemoryUrgency(guildId, config.decayRate, config.importanceBoostOnAccess);
        const pruned = await pruneLowUrgencyMemories(guildId, config.minUrgencyThreshold, config.pruneOlderThanDays);

        return {
            updated: updated.length,
            pruned: pruned || 0
        };
    }
}

// Singleton instance
export const decayManager = new DecayManager();
