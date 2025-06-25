import { Router, Request, Response } from 'express';
import path from 'path';
import { readJSON, writeJSON, appendToJSON } from '../utils/jsonHandler';
import { authenticate, authorize } from '../utils/auth';
import fs from 'fs';
import archiver from 'archiver';

const router = Router();

const PENDING_PATH = path.join(__dirname, '../../data/pending-submissions.json');
const REJECTED_PATH = path.join(__dirname, '../../data/rejected-submissions.json');
const LEVELS_DIR = path.join(__dirname, '../../data/');
const LIST_PATH = path.join(__dirname, '../../data/_list.json');

router.get('/moderation-panel', authenticate, authorize('moderator', 'admin', 'owner', 'senior-list-mod', 'trial'), async (_req, res) => {
  const pending = await readJSON(PENDING_PATH);
  res.json(pending); // Now returns JSON for the frontend to render
});

router.post('/submit', async (req: Request, res: Response) => {
  const submission = req.body;
  if (!submission.user || !submission.level || !submission.link || !submission.percent || !submission.refreshRate) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const list = await readJSON(LIST_PATH);
  if (!list.includes(submission.level)) {
    return res.status(400).json({ error: 'Invalid level' });
  }

  await appendToJSON(PENDING_PATH, submission);
  res.status(200).json({ message: 'Submission received' });
});

router.get('/pending', async (_req: Request, res: Response) => {
  const pending = await readJSON(PENDING_PATH);
  res.json(pending);
});

router.post('/moderate', authenticate, authorize('moderator', 'admin', 'owner', 'senior-list-mod'), async (req: Request, res: Response) => {
  const { index, action, reason } = req.body;
  const pending = await readJSON(PENDING_PATH);

  if (index < 0 || index >= pending.length) {
    return res.status(400).json({ error: 'Invalid index' });
  }

  const submission = pending.splice(index, 1)[0];
  await writeJSON(PENDING_PATH, pending);

  if (action === 'accept') {
    const levelPath = path.join(LEVELS_DIR, `${submission.level}.json`);
    const levelData = await readJSON(levelPath);
    levelData.records.push({ user: submission.user, link: submission.link, percent: submission.percent, hz: submission.refreshRate });
    await writeJSON(levelPath, levelData);
  } else {
    if (reason) submission.reason = reason;
    await appendToJSON(REJECTED_PATH, submission);
  }

  res.redirect('/api/moderation-panel');
});

router.post('/moderate-batch', authenticate, authorize('moderator', 'admin', 'owner', 'senior-list-mod'), async (req: Request, res: Response) => {
  const { actions } = req.body;
  let pending = await readJSON(PENDING_PATH);
  let rejected = await readJSON(REJECTED_PATH);

  // To avoid index shifting, process from highest to lowest index
  actions.sort((a: any, b: any) => b.index - a.index);

  for (const { index, action, reason } of actions) {
    if (index < 0 || index >= pending.length) continue;
    const submission = pending.splice(index, 1)[0];

    if (action === 'accept') {
      const levelPath = path.join(LEVELS_DIR, `${submission.level}.json`);
      const levelData = await readJSON(levelPath);
      levelData.records.push({ user: submission.user, link: submission.link, percent: submission.percent, hz: submission.refreshRate });
      await writeJSON(levelPath, levelData);
    } else if (action === 'reject') {
      if (reason) submission.reason = reason;
      rejected.push(submission);
    }
  }

  await writeJSON(PENDING_PATH, pending);
  await writeJSON(REJECTED_PATH, rejected);

  res.json({ success: true });
});

//GET route to view rejected submissions
router.get('/rejected', async (_req: Request, res: Response) => {
  const rejected = await readJSON(REJECTED_PATH);
  let html = '<h1>Rejected Submissions</h1>';
  html += '<ul>';
  rejected.forEach((s: any) => {
    html += `<li>
      <strong>${s.user}</strong> on <strong>${s.level}</strong><br>
      <a href="${s.link}" target="_blank">${s.link}</a>
    </li>`;
  });
  html += '</ul>';
  res.send(html);
});
// #TODO Implement a GET route to view all submissions for a specific level

router.get('/download-data', authenticate, authorize('owner'), async (req: Request, res: Response) => {
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    return res.status(404).json({ error: 'Data directory not found' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename=data.zip');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.directory(dataDir, false);
  archive.finalize();

  archive.pipe(res);

  archive.on('error', err => {
    res.status(500).send({ error: err.message });
  });
});

export default router;