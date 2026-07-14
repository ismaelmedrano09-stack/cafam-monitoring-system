// Bot de WhatsApp propio (Baileys). Usa un número dedicado como emisor:
// se vincula una vez escaneando un QR y puede enviar alertas a cualquier número
// sin que el destinatario haga activaciones. La sesión se guarda en MySQL para
// sobrevivir reinicios/deploys (el disco de Render es efímero).
const qrcode = require('qrcode');
const pool = require('../config/db');

let sock = null;
let lastQr = null;         // último QR pendiente de escanear (string)
let connected = false;
let meJid = null;
let starting = false;
let baileys = null;

async function ensureAuthTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wa_auth (
      name VARCHAR(120) PRIMARY KEY,
      data LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

// Estado de autenticación de Baileys persistido en MySQL.
async function useMySQLAuthState() {
  const { initAuthCreds, BufferJSON, proto } = baileys;

  const readData = async (name) => {
    const [rows] = await pool.query('SELECT data FROM wa_auth WHERE name = ?', [name]);
    if (!rows.length) return null;
    try { return JSON.parse(rows[0].data, BufferJSON.reviver); } catch { return null; }
  };
  const writeData = async (name, data) => {
    const json = JSON.stringify(data, BufferJSON.replacer);
    await pool.query('INSERT INTO wa_auth (name, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)', [name, json]);
  };
  const removeData = async (name) => {
    await pool.query('DELETE FROM wa_auth WHERE name = ?', [name]);
  };

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            let value = await readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            if (value) data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              const name = `${category}-${id}`;
              if (value) await writeData(name, value); else await removeData(name);
            }
          }
        }
      }
    },
    saveCreds: () => writeData('creds', creds)
  };
}

async function startBot() {
  if (starting || connected) return;
  starting = true;
  try {
    baileys = baileys || await import('@whiskeysockets/baileys');
    await ensureAuthTable();
    const { state, saveCreds } = await useMySQLAuthState();
    const makeWASocket = baileys.makeWASocket || baileys.default?.makeWASocket || baileys.default;

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      browser: ['Cafam Monitoring', 'Chrome', '1.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        lastQr = qr;
        console.log('[wa-bot] QR nuevo generado — escanéalo desde la app para vincular');
      }
      if (connection === 'open') {
        connected = true;
        lastQr = null;
        meJid = sock.user?.id || null;
        console.log(`[wa-bot] Conectado como ${meJid}`);
      }
      if (connection === 'close') {
        connected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === (baileys.DisconnectReason?.loggedOut ?? 401);
        console.log(`[wa-bot] Desconectado (code ${statusCode}). ${loggedOut ? 'Sesión cerrada: se requiere re-vincular.' : 'Reintentando...'}`);
        starting = false;
        if (loggedOut) {
          // sesión inválida: limpiar para permitir nueva vinculación
          pool.query('DELETE FROM wa_auth').catch(() => {});
          sock = null;
        } else {
          setTimeout(() => startBot().catch((e) => console.error('[wa-bot] reintento falló:', e.message)), 5000);
        }
      }
    });
  } catch (err) {
    starting = false;
    console.error('[wa-bot] Error al iniciar:', err.message);
    throw err;
  }
  starting = false;
}

function isConnected() {
  return connected && !!sock;
}

async function getStatus() {
  let qrDataUrl = null;
  if (lastQr) {
    try { qrDataUrl = await qrcode.toDataURL(lastQr, { margin: 1, width: 280 }); } catch {}
  }
  return {
    connected,
    me: meJid,
    qr: qrDataUrl,
    pending_link: !connected && !!lastQr
  };
}

// Envía un mensaje de texto a un número internacional (+5215512345678 / 573001234567).
async function sendBotMessage(phone, text) {
  if (!isConnected()) throw new Error('El bot de WhatsApp no está vinculado');
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) throw new Error('Número de teléfono inválido');
  const jid = `${digits}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
  return { sent: true, provider: 'bot' };
}

// Cierra sesión y borra credenciales (para vincular otro número).
async function resetSession() {
  try { if (sock) await sock.logout(); } catch {}
  sock = null;
  connected = false;
  lastQr = null;
  meJid = null;
  await pool.query('DELETE FROM wa_auth');
}

module.exports = { startBot, isConnected, getStatus, sendBotMessage, resetSession };
