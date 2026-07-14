const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const { startMqtt } = require('./mqtt/mqttClient');
const { checkDisconnectedSensors } = require('./services/alarmService');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', credentials: false }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[socket] cliente conectado: ${socket.id}`);
  socket.on('disconnect', () => console.log(`[socket] cliente desconectado: ${socket.id}`));
});

server.listen(env.port, '0.0.0.0', () => {
  console.log(`API de monitoreo Cafam disponible en el puerto ${env.port}`);
  startMqtt();

  // Bot de WhatsApp (Baileys): se reconecta solo si hay sesión guardada en MySQL.
  if (process.env.WA_BOT !== 'off') {
    const { startBot } = require('./services/whatsappBot');
    startBot().catch((err) => console.error('[wa-bot] no se pudo iniciar:', err.message));
  }

  let checkingDisconnected = false;
  const runDisconnectedCheck = async () => {
    if (checkingDisconnected) return;
    checkingDisconnected = true;
    try {
      await checkDisconnectedSensors();
    } catch (error) {
      console.error('Error al verificar sensores desconectados:', error.message);
    } finally {
      checkingDisconnected = false;
    }
  };

  runDisconnectedCheck();
  const disconnectedTimer = setInterval(runDisconnectedCheck, 60 * 1000);
  disconnectedTimer.unref();
});
