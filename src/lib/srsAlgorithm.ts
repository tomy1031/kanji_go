import { type UserState } from '../types';

// SuperMemo-2 Algorithm (Simplified)
// Returns { interval: number, nextReview: number }
export const calculateNextReview = (
    quality: number, // 0-5
    previousInterval: number,
    previousStreak: number
): { interval: number; nextReview: number; streak: number } => {
    let interval: number;
    let streak: number;

    if (quality < 3) {
        // If incorrect, reset streak and interval
        interval = 1;
        streak = 0;
    } else {
        // If correct
        if (previousStreak === 0) {
            interval = 1;
        } else if (previousStreak === 1) {
            interval = 3;
        } else {
            // EF (Easiness Factor) is simplified to 2.5 here for MVP
            interval = Math.ceil(previousInterval * 2.5);
        }
        streak = previousStreak + 1;
    }

    // Calculate next review timestamp (Date.now() + interval * days)
    const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

    return { interval, nextReview, streak };
};

// Helper to get due items
export const getDueItems = (progress: UserState['progress']) => {
    const now = Date.now();
    return Object.entries(progress).filter(([, data]) => {
        return data.status === 'learning' && data.nextReview <= now;
    }).map(([id]) => id);
};
