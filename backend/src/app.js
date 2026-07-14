const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
app.set('trust proxy', 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    let host = '';
    try { host = new URL(origin).hostname; } catch { host = ''; }
    if (
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin.startsWith('http://192.168.') ||
      origin.startsWith('http://10.') ||
      host.endsWith('.vercel.app') ||
      host.endsWith('.onrender.com') ||
      origin === env.frontendUrl
    ) return callback(null, true);
    return callback(new Error(`Origin no permitido por CORS: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, message: 'Demasiados intentos de inicio de sesión. Intente en 15 minutos.' }, standardHeaders: true, legacyHeaders: false });
app.use('/api', globalLimiter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Cafam monitoring API online', data: { now: new Date() } });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/sensors', require('./routes/sensorRoutes'));
app.use('/api/readings', require('./routes/readingRoutes'));
app.use('/api/alarms', require('./routes/alarmRoutes'));
app.use('/api/corrective-actions', require('./routes/correctiveActionRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/audit-logs', require('./routes/auditRoutes'));
app.use('/api/monitoring', require('./routes/monitoringRoutes'));
app.use('/api/push', require('./routes/pushRoutes'));
app.use('/api/whatsapp', require('./routes/whatsappRoutes'));

app.use(errorHandler);

module.exports = app;
