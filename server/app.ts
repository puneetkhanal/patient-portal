import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { createAuthRoutes } from './src/auth/routes.js';
import patientRoutes from './src/routes/patient.routes.js';
import documentRoutes from './src/routes/document.routes.js';
import userRoutes from './src/routes/user.routes.js';
import settingsRoutes from './src/routes/settings.routes.js';
import weeklyRequestRoutes from './src/routes/weeklyRequest.routes.js';
import weeklyPlanRoutes from './src/routes/weeklyPlan.routes.js';
import planItemRoutes from './src/routes/planItem.routes.js';
import reportRoutes from './src/routes/report.routes.js';
import transfusionRecordRoutes from './src/routes/transfusionRecord.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create Express application instance
 * @returns Express app instance
 */
export function createApp() {
  const app = express();

  // Repositories are used within route handlers

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Auth routes (public)
  app.use('/api/auth', createAuthRoutes());

  // API Routes
  app.use('/api/patients', patientRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/weekly-requests', weeklyRequestRoutes);
app.use('/api/weekly-plans', weeklyPlanRoutes);
app.use('/api/plan-items', planItemRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/transfusion-records', transfusionRecordRoutes);
  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      // Check MongoDB connection
      const mongoose = await import('mongoose');
      const isConnected = mongoose.connection.readyState === 1;
      res.json({
        status: 'ok',
        message: 'Server is running!',
        database: isConnected ? 'connected' : 'disconnected'
      });
    } catch {
      res.json({ status: 'ok', message: 'Server is running!', database: 'disconnected' });
    }
  });

  // User management is handled by auth routes


  // Serve static files from React app in production (only if not in test mode)
  if (process.env.NODE_ENV === 'production' && !process.env.VITEST) {
    app.use(express.static(path.join(__dirname, '../client/dist')));
    
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    });
  }

  // Centralized error handler (notably for multer file validation errors)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    }

    if (err instanceof Error) {
      if (err.message.toLowerCase().includes('invalid file type')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }

    return res.status(500).json({ error: 'Unexpected server error' });
  });

  return app;
}
