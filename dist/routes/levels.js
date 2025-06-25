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
const jsonHandler_1 = require("../utils/jsonHandler");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const router = (0, express_1.Router)();
const LIST_PATH = path_1.default.join(__dirname, '../../data/_list.json');
const LEVELS_DIR = path_1.default.join(__dirname, '../../data');
const EDITORS_PATH = path_1.default.join(__dirname, '../../data/_editors.json');
router.get('/ordered-levels', (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const list = yield (0, jsonHandler_1.readJSON)(LIST_PATH);
        const orderedLevels = [];
        for (const entry of list) {
            const filename = entry + '.json';
            const levelPath = path_1.default.join(LEVELS_DIR, filename);
            try {
                const fileContent = yield promises_1.default.readFile(levelPath, 'utf-8');
                const parsedContent = JSON.parse(fileContent);
                orderedLevels.push({ filename, content: parsedContent });
            }
            catch (err) {
                orderedLevels.push({ filename, error: 'File not found or invalid JSON' });
            }
        }
        res.json(orderedLevels);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to load ordered levels' });
    }
}));
// Updated endpoint for just _list.json (removed packlist reference)
router.get('/list-metadata', (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const list = yield promises_1.default.readFile(LIST_PATH, 'utf-8');
        res.json({
            list: JSON.parse(list)
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to load list' });
    }
}));
router.get('/level/:entry', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const entry = req.params.entry;
    const filename = entry + '.json';
    const levelPath = path_1.default.join(LEVELS_DIR, filename);
    try {
        const fileContent = yield promises_1.default.readFile(levelPath, 'utf-8');
        const parsedContent = JSON.parse(fileContent);
        res.json(parsedContent);
    }
    catch (err) {
        res.status(404).json({ error: 'Level not found or invalid JSON' });
    }
}));
router.get('/editors', (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const editors = yield promises_1.default.readFile(EDITORS_PATH, 'utf-8');
        res.json(JSON.parse(editors));
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to load editors' });
    }
}));
// Endpoint to return only the numeric IDs from the ordered level files
router.get('/ordered-ids', (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const list = yield (0, jsonHandler_1.readJSON)(LIST_PATH);
        const ids = [];
        for (const entry of list) {
            const filename = entry + '.json';
            const levelPath = path_1.default.join(LEVELS_DIR, filename);
            try {
                const fileContent = yield promises_1.default.readFile(levelPath, 'utf-8');
                const parsedContent = JSON.parse(fileContent);
                // The numeric ID is stored as 'id' in each level file
                if (typeof parsedContent.id === 'number') {
                    ids.push(parsedContent.id);
                }
            }
            catch (_a) {
                // Skip files that can't be read or parsed
            }
        }
        res.json(ids);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to load ordered level IDs' });
    }
}));
exports.default = router;
