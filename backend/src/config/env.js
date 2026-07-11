const dotenv = require('dotenv');

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
const dbHost = isRailway ? (process.env.MYSQLHOST || process.env.DB_HOST) : (process.env.DB_HOST || process.env.MYSQLHOST);
const dbPort = isRailway ? (process.env.MYSQLPORT || process.env.DB_PORT) : (process.env.DB_PORT || process.env.MYSQLPORT);
const dbUser = isRailway ? (process.env.MYSQLUSER || process.env.DB_USER) : (process.env.DB_USER || process.env.MYSQLUSER);
const dbPassword = isRailway ? (process.env.MYSQLPASSWORD || process.env.DB_PASSWORD) : (process.env.DB_PASSWORD || process.env.MYSQLPASSWORD);
const dbName = isRailway ? (process.env.MYSQLDATABASE || process.env.DB_NAME) : (process.env.DB_NAME || process.env.MYSQLDATABASE);

module.exports = {
  port: process.env.PORT || 4000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'change_this_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  db: {
    host: dbHost || 'localhost',
    port: Number(dbPort || 3306),
    user: dbUser || 'root',
    password: dbPassword || '',
    database: dbName || 'cafam_monitoring'
  },
  mqtt: {
    url: process.env.MQTT_URL ?? (isProduction ? '' : 'mqtt://localhost:1883'),
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || ''
  }
};
