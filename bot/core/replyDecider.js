import { MentionOnlyStrategy, PassiveStrategy, ActiveStrategy, DisabledStrategy } from '../strategies/replyStrategies.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Decide whether the bot should reply to a message based on config and relationship.
 * Returns an object with the decision and a log of the checks performed.
 */
import { getBotConfig, getReplyBehavior, loadConfig } from '../../shared/config/configLoader.js';

export function shouldReply({ message, isMentioned, replyBehavior = {}, relationship = {}, context = [], botName = '' }) {
    const config = loadConfig();
    const logDecisions = config.logger?.logReplyDecisions ?? false;
    const checks = [];
    const finalDecision = (result, reason) => {
        if (logDecisions) {
            checks.push({ check: 'Final Decision', result, reason });
            const logObject = {
                decision: result,
                reason: reason,
                user: message.author.username,
                channel: message.channel.name,
                factors: checks
            };
            logger.info(`Reply Decision: ${result}`, logObject);
        }
        return { result, reason, checks };
    };

    const mode = replyBehavior.mode ?? 'mention-only';
    checks.push({ check: 'Mode', value: mode });

    const requireMention = replyBehavior.requireMention ?? true;
    checks.push({ check: 'Require Mention', value: requireMention });

    const prob = typeof replyBehavior.replyProbability === 'number' ? replyBehavior.replyProbability : 1.0;
    checks.push({ check: 'Probability', value: prob });

    const ignoreUsers = replyBehavior.ignoreUsers ?? [];
    if (ignoreUsers.length > 0) checks.push({ check: 'Ignore Users List', value: ignoreUsers });

    const ignoreChannels = replyBehavior.ignoreChannels ?? [];
    if (ignoreChannels.length > 0) checks.push({ check: 'Ignore Channels List', value: ignoreChannels });

    const ignoreKeywords = replyBehavior.ignoreKeywords ?? [];
    if (ignoreKeywords.length > 0) checks.push({ check: 'Ignore Keywords List', value: ignoreKeywords });

    // --- Start Decision Logic ---

    if (mode === 'disabled') {
        return finalDecision(false, 'Bot reply mode is disabled globally.');
    }
    checks.push({ check: 'Global Mode', result: true, reason: `Mode is '${mode}', not 'disabled'.` });

    if (ignoreUsers.includes(message.author.id)) {
        return finalDecision(false, `User ${message.author.username} (${message.author.id}) is on the ignore list.`);
    }
    checks.push({ check: 'User Ignored', result: true, reason: 'Author is not on ignore list.' });

    if (ignoreChannels.includes(message.channel.id)) {
        return finalDecision(false, `Channel #${message.channel.name} (${message.channel.id}) is on the ignore list.`);
    }
    checks.push({ check: 'Channel Ignored', result: true, reason: 'Channel is not on ignore list.' });

    const contentLower = (message.content || '').toLowerCase();
    for (const kw of ignoreKeywords) {
        if (!kw) continue;
        if (contentLower.includes(kw.toLowerCase())) {
            return finalDecision(false, `Message contains ignored keyword: "${kw}".`);
        }
    }
    checks.push({ check: 'Keyword Ignored', result: true, reason: 'Message does not contain ignored keywords.' });

    // Strategy selection
    let strategyDecision = false;
    const params = { message, isMentioned, replyBehavior, relationship, context, botName };
    switch (mode) {
        case 'active':
            strategyDecision = ActiveStrategy(params);
            break;
        case 'passive':
            strategyDecision = PassiveStrategy(params);
            break;
        case 'disabled':
            strategyDecision = DisabledStrategy(params); // Should be redundant, but for safety
            break;
        case 'mention-only':
        default:
            strategyDecision = MentionOnlyStrategy(params);
            break;
    }
    checks.push({ check: 'Strategy Result', strategy: mode, result: strategyDecision });

    if (requireMention && !isMentioned && mode !== 'active') {
        return finalDecision(false, `Replies require a mention, and the bot was not mentioned (mode: ${mode}).`);
    }
    checks.push({
        check: 'Mention Requirement',
        result: true,
        reason: `Mention requirement passed (isMentioned: ${isMentioned}, requireMention: ${requireMention}, mode: ${mode})`,
    });

    if (!strategyDecision) {
        return finalDecision(false, `The '${mode}' strategy decided not to reply.`);
    }
    checks.push({ check: 'Strategy Passed', result: true, reason: `The '${mode}' strategy returned true.` });

    // Apply probability roll
    if (prob <= 0) {
        return finalDecision(false, `Reply probability is ${prob}, which is <= 0.`);
    }
    if (prob < 1) {
        const roll = Math.random();
        checks.push({ check: 'Probability Roll', roll, threshold: prob });
        if (roll > prob) {
            return finalDecision(false, `Random roll ${roll.toFixed(2)} exceeded reply probability ${prob}.`);
        }
        checks.push({ check: 'Probability Passed', result: true, reason: `Roll was under threshold.` });
    } else {
        checks.push({ check: 'Probability', result: true, reason: 'Probability is 1.0, no roll needed.' });
    }

    return finalDecision(true, 'All checks passed.');
}
