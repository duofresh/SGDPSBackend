import express from 'express';
import dotenv from 'dotenv';
import submissionsRouter from './routes/submissions';
import fs from 'fs';
import path from 'path';
import authRouter from './routes/auth';
import levelsRouter from './routes/levels';
import userRouter from './routes/user';
import cors from 'cors';


dotenv.config();

const app = express();

app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/api', authRouter);
app.use('/api', submissionsRouter);
app.use('/api', levelsRouter);
app.use('/api', userRouter);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});