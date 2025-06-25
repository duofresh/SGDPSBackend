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

// Score function from score.js
function score(difficulty: number): number {
    return [10, 20, 40, 70, 120][difficulty] || 0;
}

// Round function from score.js
function round(num: number): number {
    return Math.round(num * 1000) / 1000;
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
        const userLevels: { name: string; points: number }[] = [];
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
        for (const levelPath of list) {
            try {
                const levelData = await readJSON(path.join(LEVELS_DIR, `${levelPath}.json`));
                const levelName = levelPath;
                const difficulty = levelData.difficulty || 0;
                const points = score(difficulty);
                
                // Handle verifier points (same as leaderboard)
                if (levelData.verifier) {
                    const verifier = Object.keys(scoreMap).find(
                        (u) => u.toLowerCase() === levelData.verifier.toLowerCase()
                    ) || levelData.verifier;
                    
                    scoreMap[verifier] ??= {
                        verified: [],
                        completed: []
                    };
                    
                    scoreMap[verifier].verified.push({
                        rank: 0, // We don't need rank for this
                        level: levelName,
                        score: points,
                        path: levelName
                    });
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

                    const pointsForThisLevel = levelData.rating ? (levelData.rating * 4 / leveltype) : 0;

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
                            
                            // Only add if this level isn't already in completed
                            if (!scoreMap[user].completed.some(c => c.path === levelName)) {
                                scoreMap[user].completed.push({
                                    rank: 0, // We don't need rank for this
                                    level: levelName,
                                    score: points,
                                    path: levelName
                                });
                            }

                            // Track user's own completed levels
                            if (user.toLowerCase() === username.toLowerCase()) {
                                acceptedCount++;
                                userLevels.push({ name: levelName, points });
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
                acceptedSubmissions: userLevels.map(l => ({ name: l.name })),
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