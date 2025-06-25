import { Router, Request, Response } from 'express';
import path from 'path';
import { readJSON } from '../utils/jsonHandler';
import { authenticate } from '../utils/auth';
import fs from 'fs';

// Define the authenticated request type
interface AuthenticatedRequest extends Request {
    user?: {
        username: string;
        role: string;
    };
}

const router = Router();
const PENDING_PATH = path.join(__dirname, '../../data/pending-submissions.json');
const REJECTED_PATH = path.join(__dirname, '../../data/rejected-submissions.json');
const LEVELS_DIR = path.join(__dirname, '../../data/');
const LIST_METADATA_PATH = path.join(LEVELS_DIR, '_list.json');

// Numbers of decimal digits to round to
const scale = 3;

/**
 * Calculate the score awarded when having a certain percentage on a list level
 * @param {Number} rank Position on the list
 * @param {Number} percent Percentage of completion
 * @param {Number} minPercent Minimum percentage required
 * @returns {Number}
 */
function score(rank: number, percent: number, minPercent: number): number {
    if (rank > 150) {
        return 0;
    }
    if (rank > 75 && percent < 100) {
        return 0;
    }

    // New formula
    let score = (-24.9975*Math.pow(rank-1, 0.4) + 200) *
        ((percent - (minPercent - 1)) / (100 - (minPercent - 1)));

    score = Math.max(0, score);

    if (percent != 100) {
        return round(score - score / 3);
    }

    return Math.max(round(score), 0);
}

function round(num: number): number {
    if (!('' + num).includes('e')) {
        return +(Math.round(Number(num + 'e+' + scale)) + 'e-' + scale);
    } else {
        var arr: string[] = ('' + num).split('e');
        var sig: string = '';
        if (+arr[1] + scale > 0) {
            sig = '+';
        }
        return +(
            Math.round(Number(+arr[0] + 'e' + sig + (+arr[1] + scale))) +
            'e-' +
            scale
        );
    }
}

router.get('/user/stats', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    const username = req.user?.username;
    const role = req.user?.role;
    if (!username) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        // Get pending submissions
        const pending = await readJSON(PENDING_PATH);
        // For each of the user's pending submissions, include its position in the global queue
        const pendingSubmissions = pending
            .map((s: any, idx: number) => ({ ...s, queuePosition: idx + 1 }))
            .filter((s: any) => s.user === username);
        const pendingCount = pendingSubmissions.length;

        // Get rejected submissions
        const rejected = await readJSON(REJECTED_PATH);
        const rejectedSubmissions = rejected.filter((s: any) => s.user === username);
        const rejectedCount = rejectedSubmissions.length;

        // Get list metadata to get official list of levels
        const list = await readJSON(LIST_METADATA_PATH);
        if (!Array.isArray(list)) {
            throw new Error('List metadata is not in the expected format');
        }

        // Track user's completed levels and points
        const userLevels: { name: string; points: number; type: 'completed' | 'verified' }[] = [];
        let acceptedCount = 0;

        // Track all users and their points for ranking (using same approach as leaderboard)
        const scoreMap: { [key: string]: { 
            verified: { rank: number; level: string; score: number; path: string }[],
            completed: { rank: number; level: string; score: number; path: string }[]
        }} = {};

        // Track creator points
        const creatorMap: { [key: string]: {
            levels: { rank: number; level: string; path: string; creatorpoints: number }[],
            total: number
        }} = {};

        // Process each level file from the official list
        for (let i = 0; i < list.length; i++) {
            const levelPath = list[i];
            try {
                const levelData = await readJSON(path.join(LEVELS_DIR, `${levelPath}.json`));
                const levelName = levelPath;
                const rank = i + 1; // Rank is position in the list (1-based)
                const minPercent = levelData.percentToQualify || 100; // Default to 100 if not specified
                
                // Handle verifier points (same as leaderboard)
                if (levelData.verifier) {
                    const verifier = Object.keys(scoreMap).find(
                        (u) => u.toLowerCase() === levelData.verifier.toLowerCase()
                    ) || levelData.verifier;
                    
                    scoreMap[verifier] ??= {
                        verified: [],
                        completed: []
                    };
                    
                    // Verifier gets full points for 100% completion
                    const verifierPoints = score(rank, 100, minPercent);
                    
                    scoreMap[verifier].verified.push({
                        rank: 0, // We don't need rank for this
                        level: levelName,
                        score: verifierPoints,
                        path: levelName
                    });

                    // Add verified levels to user's completed levels if they are the verifier
                    if (verifier.toLowerCase() === username.toLowerCase()) {
                        acceptedCount++;
                        userLevels.push({ name: levelName, points: verifierPoints, type: 'verified' });
                    }
                }

                // Handle creator points
                let currentLevelCreators: string[] = [];
                if (levelData.creators && levelData.creators.length > 0) {
                    currentLevelCreators = levelData.creators;
                } else if (levelData.author) {
                    currentLevelCreators = [levelData.author];
                }

                if (currentLevelCreators.length > 0) {
                    let leveltype: number;
                    const numCreators = currentLevelCreators.length;
                    if (numCreators === 1) {
                        leveltype = 1; // solo
                    } else if (numCreators > 1 && numCreators <= 4) {
                        leveltype = 2; // collab
                    } else {
                        leveltype = 4; // megacollab
                    }

                    // Since rating field doesn't exist in new structure, use a default value
                    const pointsForThisLevel = 10; // Default creator points

                    for (const rawCreatorName of currentLevelCreators) {
                        const creatorName = Object.keys(creatorMap).find(
                            cn => cn.toLowerCase() === rawCreatorName.toLowerCase()
                        ) || rawCreatorName;

                        creatorMap[creatorName] ??= {
                            levels: [],
                            total: 0
                        };

                        creatorMap[creatorName].levels.push({
                            rank: 0, // We don't need rank for this
                            level: levelName,
                            path: levelName,
                            creatorpoints: round(pointsForThisLevel)
                        });
                        creatorMap[creatorName].total += pointsForThisLevel;
                    }
                }

                // Handle completed levels
                if (levelData.records) {
                    levelData.records.forEach((record: any) => {
                        if (record.user) {
                            const user = Object.keys(scoreMap).find(
                                (u) => u.toLowerCase() === record.user.toLowerCase()
                            ) || record.user;
                            
                            scoreMap[user] ??= {
                                verified: [],
                                completed: []
                            };
                            
                            // Calculate points based on actual completion percentage
                            const percent = record.percent || 100;
                            const userPoints = score(rank, percent, minPercent);
                            
                            // Only add if this level isn't already in completed
                            if (!scoreMap[user].completed.some(c => c.path === levelName)) {
                                scoreMap[user].completed.push({
                                    rank: 0, // We don't need rank for this
                                    level: levelName,
                                    score: userPoints,
                                    path: levelName
                                });
                            }

                            // Track user's own completed levels
                            if (user.toLowerCase() === username.toLowerCase()) {
                                // Only add if not already added as verified
                                if (!userLevels.some(l => l.name === levelName)) {
                                    acceptedCount++;
                                    userLevels.push({ name: levelName, points: userPoints, type: 'completed' });
                                }
                            }
                        }
                    });
                }
            } catch (err) {
                console.error(`Error processing level file ${levelPath}:`, err);
                continue;
            }
        }

        // Calculate total points and rank for all users (same as leaderboard)
        const userTotals = Object.entries(scoreMap).map(([user, scores]) => ({
            user,
            total: [...scores.verified, ...scores.completed]
                .reduce((sum, level) => sum + level.score, 0)
        }));

        // Sort by total points
        userTotals.sort((a, b) => b.total - a.total);

        // Find user's rank and total points
        const userEntry = userTotals.find(entry => entry.user.toLowerCase() === username.toLowerCase());
        const rank = userEntry ? userTotals.indexOf(userEntry) + 1 : 0;
        const totalPoints = userEntry?.total || 0;

        // Calculate creator points and rank
        const creatorTotals = Object.entries(creatorMap).map(([user, data]) => ({
            user,
            total: round(data.total),
            levels: data.levels
        }));

        // Sort by total creator points
        creatorTotals.sort((a, b) => b.total - a.total);

        // Find user's creator rank and points
        const creatorEntry = creatorTotals.find(entry => entry.user.toLowerCase() === username.toLowerCase());
        const creatorRank = creatorEntry ? creatorTotals.indexOf(creatorEntry) + 1 : 0;
        const creatorPoints = creatorEntry?.total || 0;
        const createdLevels = creatorEntry?.levels || [];

        res.json({
            username,
            role,
            stats: {
                accepted: acceptedCount,
                pending: pendingCount,
                rejected: rejectedCount,
                totalPoints,
                rank,
                totalUsers: userTotals.length,
                completedLevels: userLevels.sort((a, b) => b.points - a.points),
                acceptedSubmissions: userLevels.map(l => ({ name: l.name, type: l.type })),
                pendingSubmissions: pendingSubmissions.map((s: any) => ({ level: s.level, link: s.link, queuePosition: s.queuePosition })),
                rejectedSubmissions: rejectedSubmissions.map((s: any) => ({ level: s.level, link: s.link, reason: s.reason })),
                creatorPoints,
                creatorRank,
                totalCreators: creatorTotals.length,
                createdLevels: createdLevels.sort((a, b) => b.creatorpoints - a.creatorpoints)
            }
        });
    } catch (error: any) {
        console.error('Error getting user stats:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

export default router; 