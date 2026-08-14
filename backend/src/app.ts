import express, { Express } from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import employeeRouter from './routes/employees';
import attendanceRouter from './routes/attendance';

const app: Express = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.status(200).json({ name: 'JD Connect Backend API', status: 'ok' });
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/employees', employeeRouter);
app.use('/api/attendance', attendanceRouter);

export default app;
