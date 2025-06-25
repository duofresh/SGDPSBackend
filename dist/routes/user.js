"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const jsonHandler_1 = require("../utils/jsonHandler");
const auth_1 = require("../utils/auth");
const router = (0, express_1.Router)();
const PENDING_PATH = path_1.default.join(__dirname, '../../data/pending-submissions.json');
const REJECTED_PATH = path_1.default.join(__dirname, '../../data/rejected-submissions.json');
const LEVELS_DIR = path_1.default.join(__dirname, '../../data/');
const LIST_METADATA_PATH = path_1.default.join(LEVELS_DIR, '_list.json');
// Score function from score.js
function score(difficulty) {
    return [10, 20, 40, 70, 120][difficulty] || 0;
}
// Round function from score.js
function round(num) {
    return Math.round(num * 1000) / 1000;
}
router.get('/user/stats', auth_1.authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const username = (_a = req.user) === null || _a === void 0 ? void 0 : _a.username;
    const role = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
    if (!username) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        // Get pending submissions
        const pending = yield (0, jsonHandler_1.readJSON)(PENDING_PATH);
        // For each of the user's pending submissions, include its position in the global queue
        const pendingSubmissions = pending
            .map((s, idx) => (Object.assign(Object.assign({}, s), { queuePosition: idx + 1 })))
            .filter((s) => s.user === username);
        const pendingCount = pendingSubmissions.length;
        // Get rejected submissions
        const rejected = yield (0, jsonHandler_1.readJSON)(REJECTED_PATH);
        const rejectedSubmissions = rejected.filter((s) => s.user === username);
        const rejectedCount = rejectedSubmissions.length;
        // Get list metadata to get official list of levels
        const list = yield (0, jsonHandler_1.readJSON)(LIST_METADATA_PATH);
        if (!Array.isArray(list)) {
            throw new Error('List metadata is not in the expected format');
        }
        // Track user's completed levels and points
        const userLevels = [];
        let acceptedCount = 0;
        // Track all users and their points for ranking (using same approach as leaderboard)
        const scoreMap = {};
        // Track creator points
        const creatorMap = {};
        // Process each level file from the official list
        for (const levelPath of list) {
            try {
                const levelData = yield (0, jsonHandler_1.readJSON)(path_1.default.join(LEVELS_DIR, `${levelPath}.json`));
                const levelName = levelPath;
                const difficulty = levelData.difficulty || 0;
                const points = score(difficulty);
                // Handle verifier points (same as leaderboard)
                if (levelData.verifier) {
                    const verifier = Object.keys(scoreMap).find((u) => u.toLowerCase() === levelData.verifier.toLowerCase()) || levelData.verifier;
                    (_c = scoreMap[verifier]) !== null && _c !== void 0 ? _c : (scoreMap[verifier] = {
                        verified: [],
                        completed: []
                    });
                    scoreMap[verifier].verified.push({
                        rank: 0, // We don't need rank for this
                        level: levelName,
                        score: points,
                        path: levelName
                    });
                }
                // Handle creator points
                let currentLevelCreators = [];
                if (levelData.creators && levelData.creators.length > 0) {
                    currentLevelCreators = levelData.creators;
                }
                else if (levelData.author) {
                    currentLevelCreators = [levelData.author];
                }
                if (currentLevelCreators.length > 0) {
                    let leveltype;
                    const numCreators = currentLevelCreators.length;
                    if (numCreators === 1) {
                        leveltype = 1; // solo
                    }
                    else if (numCreators > 1 && numCreators <= 4) {
                        leveltype = 2; // collab
                    }
                    else {
                        leveltype = 4; // megacollab
                    }
                    const pointsForThisLevel = levelData.rating ? (levelData.rating * 4 / leveltype) : 0;
                    for (const rawCreatorName of currentLevelCreators) {
                        const creatorName = Object.keys(creatorMap).find(cn => cn.toLowerCase() === rawCreatorName.toLowerCase()) || rawCreatorName;
                        (_d = creatorMap[creatorName]) !== null && _d !== void 0 ? _d : (creatorMap[creatorName] = {
                            levels: [],
                            total: 0
                        });
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
                    levelData.records.forEach((record) => {
                        var _a;
                        if (record.user) {
                            const user = Object.keys(scoreMap).find((u) => u.toLowerCase() === record.user.toLowerCase()) || record.user;
                            (_a = scoreMap[user]) !== null && _a !== void 0 ? _a : (scoreMap[user] = {
                                verified: [],
                                completed: []
                            });
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
            }
            catch (err) {
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
        const totalPoints = (userEntry === null || userEntry === void 0 ? void 0 : userEntry.total) || 0;
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
        const creatorPoints = (creatorEntry === null || creatorEntry === void 0 ? void 0 : creatorEntry.total) || 0;
        const createdLevels = (creatorEntry === null || creatorEntry === void 0 ? void 0 : creatorEntry.levels) || [];
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
                pendingSubmissions: pendingSubmissions.map((s) => ({ level: s.level, link: s.link, queuePosition: s.queuePosition })),
                rejectedSubmissions: rejectedSubmissions.map((s) => ({ level: s.level, link: s.link, reason: s.reason })),
                creatorPoints,
                creatorRank,
                totalCreators: creatorTotals.length,
                createdLevels: createdLevels.sort((a, b) => b.creatorpoints - a.creatorpoints)
            }
        });
    }
    catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}));
exports.default = router;
