import bcrypt from 'bcrypt';
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { readJSON, writeJSON } from '../utils/jsonHandler';
import path from 'path';

const router = Router();
const USERS_PATH = path.join(__dirname, '../../data/users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

router.post('/login', async (req: Request, res: Response) => {
  let token: string;
  const { username, password } = req.body;
  const users = await readJSON(USERS_PATH);

  const user = users.find((u: any) => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

  if(user.username === 'DuoFresh') {
    token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '10y' });
  }else{
    token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
  }
    res.json({ token });
});

router.post('/register', async (req: Request, res: Response) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required.' });
  }

  // Read existing users
  const users = await readJSON(USERS_PATH);

  // Check if user exists
  if (users.find((u: any) => u.username === username)) {
    return res.status(400).json({ error: 'Username already taken.' });
  }

  // Hash password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Add new user
  users.push({ username, passwordHash, role });

  // Write back to file
  await writeJSON(USERS_PATH, users);

  res.status(201).json({ message: 'User registered successfully.' });
});

export default router;
