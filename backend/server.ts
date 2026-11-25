import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/auth';
import supplierRoutes from './routes/supplier';
import adminRoutes from './routes/admin';

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is missing.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Routes
app.use('/auth', authRoutes);
app.use('/supplier', supplierRoutes);
app.use('/admin', adminRoutes);

// Root health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', service: 'Supplier Work Order Portal Backend' });
});

// Serve frontend static build
const frontendDist = path.resolve(__dirname, '../../../frontend/dist');
app.use(express.static(frontendDist));

// SPA wildcard fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Supplier Work Order Portal backend is running on http://localhost:${PORT}`);
});

export default app;
