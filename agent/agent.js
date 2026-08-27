import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getActiveWindow } from './detectors/windowDetector.js';
import { toFriendlyName } from './appNames.js';
import { getIconDataUrl } from './iconExtractor.js';
import { getActivityType } from './activityTypes.js';
import { extractActivityDetails } from './activityDetails.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

const SERVER_URL = process.env.PRESENCE_SERVER_URL || config.serverUrl;
const POLL_MS = config.pollIntervalMs || 2000;
const HEARTBEAT_MS = 20000;

let ws = null;
let connected = false;
let reconnectDelay = 1000;

// Último estado detectado localmente (para saber se algo mudou).
let lastProcessName = null;
let lastWindowTitle = null;
let lastIcon = null;
let lastActivityType = 'default';
let lastDetails = '';
let lastState = '';
let startedAt = null;
let paused = false;

// ------------------------------------------------------------
// Conexão WebSocket
// ------------------------------------------------------------
function connect() {
  console.log(`[agent] Conectando em ${SERVER_URL} ...`);
  ws = new WebSocket(SERVER_URL);

  ws.on('open', () => {
    connected = true;
    reconnectDelay = 1000;
    console.log('[agent] Conectado ao servidor.');
    // Ao (re)conectar, reenvia o estado atual que já temos, se houver.
    if (lastProcessName) {
      sendCurrentState();
    }
  });

  ws.on('close', () => {
    connected = false;
    console.log('[agent] Desconectado do servidor. Tentando reconectar...');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.warn('[agent] Erro de conexão:', err.message);
  });
}

function scheduleReconnect() {
  setTimeout(connect, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 1.6, 10000);
}

function send(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sendCurrentState() {
  send({
    status: 'online',
    application: toFriendlyName(lastProcessName),
    process: lastProcessName,
    activityType: lastActivityType,
    details: lastDetails,
    state: lastState,
    windowTitle: config.hideWindowTitle ? '' : lastWindowTitle,
    icon: lastIcon,
    startedAt,
    // Não existe fonte real de progresso (sem API do Spotify, sem RPC
    // de jogo/Discord conectado). Nunca inventamos esse valor — fica
    // null até que um detector real de progresso exista.
    progress: null,
  });
}

// ------------------------------------------------------------
// Loop de detecção — só envia quando algo realmente muda
// ------------------------------------------------------------
async function pollActiveWindow() {
  if (paused) return;

  const detected = await getActiveWindow();
  if (!detected || !detected.processName) {
    return; // nada em primeiro plano detectável agora; mantém o último estado
  }

  const appChanged = detected.processName !== lastProcessName;
  const titleChanged = detected.windowTitle !== lastWindowTitle;

  if (!appChanged && !titleChanged) {
    return; // nada mudou, não envia nada
  }

  if (appChanged) {
    startedAt = Math.floor(Date.now() / 1000);
    console.log(
      `[agent] Atividade mudou: ${lastProcessName || '(nenhuma)'} -> ${detected.processName}`
    );
    // Só busca o ícone quando o app muda de verdade — evita chamar o
    // PowerShell a cada troca de título de janela (ex.: trocar de aba).
    lastIcon = await getIconDataUrl(detected.exePath);
  }

  lastProcessName = detected.processName;
  lastWindowTitle = detected.windowTitle;
  lastActivityType = getActivityType(lastProcessName);
  const parsedDetails = extractActivityDetails(lastActivityType, lastWindowTitle);
  lastDetails = parsedDetails.details;
  lastState = parsedDetails.state;

  sendCurrentState();
}

// Heartbeat leve, só para manter a conexão viva sem reenviar o estado inteiro.
setInterval(() => {
  send({ type: 'heartbeat' });
}, HEARTBEAT_MS);

setInterval(pollActiveWindow, POLL_MS);

process.on('SIGINT', () => {
  console.log('\n[agent] Encerrando...');
  if (ws) ws.close();
  process.exit(0);
});

console.log('[agent] Real-Time Presence Agent iniciado.');
console.log(`[agent] Verificando a janela ativa a cada ${POLL_MS}ms.`);
connect();
pollActiveWindow();
