/**
 * AI Writing Partner - Tool: Detect Writing State
 * 
 * Hybrid tool that uses rules + optional LLM to determine writing state
 */

import type { WritingState, WritingStateResult, AgentSuggestedAction } from '../types';

interface DetectWritingStateInput {
    pauseDuration: number;      // milliseconds
    recentEditPattern: 'adding_new' | 'deleting' | 'revising' | 'idle';
    recentTypingSpeed?: number; // chars/minute
    averageSpeed?: number;      // session average for comparison
    cursorMovement?: 'forward' | 'backward' | 'jumping' | 'stable';
}

/**
 * Detect writing state based on behavioral signals
 * This is a rule-based implementation that doesn't require LLM
 */
export function detectWritingState(input: DetectWritingStateInput): WritingStateResult {
    const {
        pauseDuration,
        recentEditPattern,
        recentTypingSpeed = 0,
        averageSpeed = 30,
        cursorMovement = 'stable',
    } = input;

    // Thresholds
    const THINKING_PAUSE_MS = 3000;   // 3 seconds
    const STUCK_PAUSE_MS = 10000;     // 10 seconds
    const VERY_STUCK_PAUSE_MS = 30000; // 30 seconds
    const SLOW_SPEED_RATIO = 0.3;     // 30% of average

    let state: WritingState;
    let confidence: number;
    let suggestedAction: AgentSuggestedAction;

    // Determine state based on pause duration and edit pattern
    if (recentEditPattern === 'idle') {
        if (pauseDuration >= VERY_STUCK_PAUSE_MS) {
            state = 'stuck';
            confidence = 0.9;
            suggestedAction = 'offer_help';
        } else if (pauseDuration >= STUCK_PAUSE_MS) {
            state = 'stuck';
            confidence = 0.7;
            suggestedAction = 'offer_help';
        } else if (pauseDuration >= THINKING_PAUSE_MS) {
            state = 'thinking';
            confidence = 0.8;
            suggestedAction = 'wait';
        } else {
            state = 'thinking';
            confidence = 0.5;
            suggestedAction = 'wait';
        }
    } else if (recentEditPattern === 'adding_new') {
        // User is actively writing
        if (recentTypingSpeed > averageSpeed * 0.8) {
            state = 'flowing';
            confidence = 0.9;
            suggestedAction = 'wait';
        } else if (recentTypingSpeed < averageSpeed * SLOW_SPEED_RATIO && pauseDuration > THINKING_PAUSE_MS) {
            state = 'thinking';
            confidence = 0.6;
            suggestedAction = 'wait';
        } else {
            state = 'flowing';
            confidence = 0.7;
            suggestedAction = 'wait';
        }
    } else if (recentEditPattern === 'revising') {
        // User is editing existing content
        state = 'editing';
        confidence = 0.8;
        suggestedAction = 'wait';
    } else if (recentEditPattern === 'deleting') {
        // User is removing content - might be frustrated or restructuring
        if (cursorMovement === 'jumping') {
            state = 'reviewing';
            confidence = 0.7;
            suggestedAction = 'wait';
        } else {
            state = 'editing';
            confidence = 0.6;
            suggestedAction = 'wait';
        }
    } else {
        state = 'flowing';
        confidence = 0.5;
        suggestedAction = 'wait';
    }

    // Adjust suggested action for milestones (would be called separately)
    // This is just the state detection part

    return {
        state,
        confidence,
        suggestedAction,
    };
}

/**
 * Check if user might need encouragement based on state history
 */
export function shouldEncourage(
    stateHistory: WritingState[],
    wordsWrittenThisSession: number
): boolean {
    // Encourage at word milestones
    const milestones = [100, 500, 1000, 2000, 3000, 5000];

    for (const milestone of milestones) {
        // Check if we just crossed this milestone
        if (wordsWrittenThisSession >= milestone &&
            wordsWrittenThisSession < milestone + 50) {
            return true;
        }
    }

    return false;
}

/**
 * Generate appropriate encouragement message
 */
export function generateEncouragement(
    wordsWrittenThisSession: number,
    writingState: WritingState
): string {
    const messages = {
        100: ['开了个好头！继续加油！ ✨', '你已经开始了，这是最难的一步！'],
        500: ['500 字了！保持这个节奏！ 🎯', '太棒了，已经 500 字了！'],
        1000: ['1000 字！你的创作正在成形！ 🌟', '厉害！一千字的里程碑！'],
        2000: ['2000 字了！这已经是一篇完整的文章了！ 🏆', '两千字！你的故事越来越丰富了！'],
        3000: ['3000 字！你今天真的很高产！ 💪', '三千字的突破！继续保持！'],
        5000: ['5000 字！这是一个重要的里程碑！ 🎉', '五千字！这真的很了不起！'],
    };

    // Find the milestone we just crossed
    const milestones = [100, 500, 1000, 2000, 3000, 5000];
    for (const milestone of milestones.reverse()) {
        if (wordsWrittenThisSession >= milestone &&
            wordsWrittenThisSession < milestone + 50) {
            const options = messages[milestone as keyof typeof messages];
            return options[Math.floor(Math.random() * options.length)]!;
        }
    }

    return '继续写吧，你做得很好！';
}
