import { Router } from 'express';
import { readJSON } from '../utils/jsonHandler';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

const LIST_PATH = path.join(__dirname, '../../data/_list.json');
const LEVELS_DIR = path.join(__dirname, '../../data');
const EDITORS_PATH = path.join(__dirname, '../../data/_editors.json');

router.get('/ordered-levels', async (_req, res) => {
  try {
    const list = await readJSON(LIST_PATH);
    const orderedLevels = [];
    for (const entry of list) {
      const filename = entry + '.json';
      const levelPath = path.join(LEVELS_DIR, filename);
      try {
        const fileContent = await fs.readFile(levelPath, 'utf-8');
        const parsedContent = JSON.parse(fileContent);
        orderedLevels.push({ filename, content: parsedContent });
      } catch (err) {
        orderedLevels.push({ filename, error: 'File not found or invalid JSON' });
      }
    }
    res.json(orderedLevels);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load ordered levels' });
  }
});

// Updated endpoint for just _list.json (removed packlist reference)
router.get('/list-metadata', async (_req, res) => {
  try {
    const list = await fs.readFile(LIST_PATH, 'utf-8');
    res.json({
      list: JSON.parse(list)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load list' });
  }
});

router.get('/level/:entry', async (req, res) => {
  const entry = req.params.entry;
  const filename = entry + '.json';
  const levelPath = path.join(LEVELS_DIR, filename);
  try {
    const fileContent = await fs.readFile(levelPath, 'utf-8');
    const parsedContent = JSON.parse(fileContent);
    res.json(parsedContent);
  } catch (err) {
    res.status(404).json({ error: 'Level not found or invalid JSON' });
  }
});

router.get('/editors', async (_req, res) => {
  try {
    const editors = await fs.readFile(EDITORS_PATH, 'utf-8');
    res.json(JSON.parse(editors));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load editors' });
  }
});

// Endpoint to return only the numeric IDs from the ordered level files
router.get('/ordered-ids', async (_req, res) => {
  try {
    const list = await readJSON(LIST_PATH);
    const ids: number[] = [];
    for (const entry of list) {
      const filename = entry + '.json';
      const levelPath = path.join(LEVELS_DIR, filename);
      try {
        const fileContent = await fs.readFile(levelPath, 'utf-8');
        const parsedContent = JSON.parse(fileContent);
        // The numeric ID is stored as 'id' in each level file
        if (typeof parsedContent.id === 'number') {
          ids.push(parsedContent.id);
        }
      } catch {
        // Skip files that can't be read or parsed
      }
    }
    res.json(ids);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load ordered level IDs' });
  }
});

export default router;