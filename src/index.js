import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './config/db.js';

import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import profilesRoutes from './routes/profiles.routes.js';
import resumesRoutes from './routes/resumes.routes.js';
import applicationsRoutes from './routes/applications.routes.js';
import interviewsRoutes from './routes/interviews.routes.js';
import meetingsRoutes from './routes/meetings.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import { ensureDefaultAdmin } from './setup/ensureDefaultAdmin.js';

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/resumes', resumesRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/interviews', interviewsRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/dashboard', dashboardRoutes);

const port = process.env.PORT || 4000;

const start = async () => {
  try {
    await connectDB();
    if (process.env.NODE_ENV !== 'production') {
      await ensureDefaultAdmin();
    }
    app.listen(port, () => console.log(`API listening on :${port}`));
  } catch (err) {
    console.error('Failed to start API', err);
    process.exit(1);
  }
};

start();
