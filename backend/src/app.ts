import express, { Express } from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import employeeRouter from './routes/employees';
import attendanceRouter from './routes/attendance';
import breakRouter from './routes/breaks';
import breakTypesRouter from './routes/break_types';
import departmentsRouter from './routes/departments';
import oauthRouter from './routes/oauth';
import { permissionsRouter } from './routes/permissions';
import { rolesRouter } from './routes/roles';

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
app.use('/api/breaks', breakRouter);
app.use('/api/break-types', breakTypesRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api', permissionsRouter);
app.use('/api', rolesRouter);
app.use('/oauth', oauthRouter);

export default app;
