/**
 * Real-Time Presence — Servidor
 * ------------------------------------------------------------
 * Recebe a presença detectada de verdade pelo Agent (conectado em
 * /agent) e retransmite em tempo real para o site (conectado em /view).
 *
 * Sem banco de dados. Sem autenticação. Sem API REST.
 * Estado só em memória.
 */

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

// Estado atual, guardado apenas em memória.
let currentState = {
  status: 'offline',
  application: '',
  process: '',
  activityType: 'default',
  details: '',
  state: '',
  windowTitle: '',
  icon: null,
  startedAt: null,
  progress: null,
};

let lastUpdatedAt = Date.now();

const viewers = new Set();
let agentSocket = null;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Real-Time Presence server está no ar.\n');
});

const agentWSS = new WebSocketServer({ noServer: true });
const viewWSS = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (pathname === '/agent') {
    agentWSS.handleUpgrade(req, socket, head, (ws) => {
      agentWSS.emit('connection', ws, req);
    });
  } else if (pathname === '/view') {
    viewWSS.handleUpgrade(req, socket, head, (ws) => {
      viewWSS.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

// ------------------------------------------------------------
// Agent -> Servidor
// ------------------------------------------------------------
agentWSS.on('connection', (ws) => {
  console.log('[agent] Presence Agent conectado.');

  // Apenas uma fonte de presença por vez neste MVP.
  if (agentSocket && agentSocket.readyState === agentSocket.OPEN) {
    agentSocket.close();
  }
  agentSocket = ws;

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch (err) {
      console.warn('[agent] Mensagem inválida (não é JSON), ignorada.');
      return;
    }

    // Heartbeat "silencioso": o agent pode mandar {type: "heartbeat"}
    // sem mudar o estado, só para manter a conexão viva.
    if (data.type === 'heartbeat') {
      return;
    }

    currentState = {
      status: data.status ?? 'online',
      application: data.application ?? '',
      process: data.process ?? '',
      // Campos novos — se o agent ainda mandar o formato antigo (sem
      // activityType/details/state/progress), cai nos defaults abaixo
      // e o frontend continua funcionando normalmente.
      activityType: data.activityType ?? 'default',
      details: data.details ?? '',
      state: data.state ?? '',
      windowTitle: data.windowTitle ?? '',
      icon: data.icon ?? null,
      startedAt: data.startedAt ?? Math.floor(Date.now() / 1000),
      progress:
        data.progress && typeof data.progress.total === 'number'
          ? { current: data.progress.current ?? 0, total: data.progress.total }
          : null,
    };
    lastUpdatedAt = Date.now();

    console.log('[agent] Novo estado:', currentState);
    broadcastState();
  });

  ws.on('close', () => {
    console.log('[agent] Agent desconectado. Marcando como offline.');
    if (agentSocket === ws) {
      agentSocket = null;
    }
    currentState = {
      status: 'offline',
      application: '',
      process: '',
      activityType: 'default',
      details: '',
      state: '',
      windowTitle: '',
      icon: null,
      startedAt: null,
      progress: null,
    };
    lastUpdatedAt = Date.now();
    broadcastState();
  });

  ws.on('error', (err) => {
    console.warn('[agent] Erro na conexão:', err.message);
  });
});

// ------------------------------------------------------------
// Servidor -> Site (viewers)
// ------------------------------------------------------------
viewWSS.on('connection', (ws) => {
  viewers.add(ws);
  console.log(`[view] Novo cliente conectado. Total: ${viewers.size}`);

  sendState(ws);

  ws.on('close', () => {
    viewers.delete(ws);
    console.log(`[view] Cliente desconectado. Total: ${viewers.size}`);
  });

  ws.on('error', () => {
    viewers.delete(ws);
  });
});

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function sendState(ws) {
  const payload = JSON.stringify({ type: 'state', state: currentState, lastUpdatedAt });
  if (ws.readyState === ws.OPEN) {
    ws.send(payload);
  }
}

function broadcastState() {
  for (const viewer of viewers) {
    sendState(viewer);
  }
}

// Heartbeat: detecta conexões mortas dos viewers.
const HEARTBEAT_MS = 30000;
setInterval(() => {
  for (const viewer of viewers) {
    try {
      viewer.ping();
    } catch (err) {
      viewers.delete(viewer);
    }
  }
  if (agentSocket) {
    if (agentSocket.isAlive === false) {
      console.log('[agent] Sem resposta ao ping, encerrando conexão.');
      agentSocket.terminate();
    } else {
      agentSocket.isAlive = false;
      try {
        agentSocket.ping();
      } catch (err) {
        /* noop */
      }
    }
  }
}, HEARTBEAT_MS);

server.listen(PORT, () => {
  console.log(`Real-Time Presence server rodando em http://localhost:${PORT}`);
  console.log(`  Agent conecta em: ws://localhost:${PORT}/agent`);
  console.log(`  Site conecta em:  ws://localhost:${PORT}/view`);
});
