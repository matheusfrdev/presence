"use strict";

/* =========================================================
   CONFIG
========================================================= */

const WS_URL = "ws://localhost:8080/view";

const STATUS_LABELS = {
  online: "ONLINE",
  away: "AUSENTE",
  offline: "OFFLINE",
};

/*
 Central de apresentação por activityType.
 Nenhum "if" espalhado pelo resto do arquivo: qualquer app novo
 só precisa de uma entrada aqui (label + cor de glow opcional).
 Tipos sem entrada (ou activityType ausente) caem em "default".
*/
const ACTIVITY_TYPES = {
  music: { label: "OUVINDO AGORA", glow: "52, 211, 199" },
  coding: { label: "CODANDO", glow: "96, 165, 250" },
  game: { label: "JOGANDO", glow: "248, 113, 113" },
  browser: { label: "NAVEGANDO", glow: "161, 161, 170" },
  discord: { label: "NO DISCORD", glow: "129, 140, 248" },
  default: { label: "ATIVO", glow: null },
};

function getActivityConfig(activityType) {
  return ACTIVITY_TYPES[activityType] || ACTIVITY_TYPES.default;
}


/* =========================================================
   DOM
========================================================= */

const elements = {
  card: document.getElementById("card"),

  statusLabel: document.getElementById("status-label"),

  avatarImg: document.getElementById("avatar-img"),
  avatarFallback: document.getElementById("avatar-fallback"),

  iconWrapper: document.getElementById("avatar-ring"),

  activityContent: document.querySelector(".activity-content"),
  activityLabel: document.getElementById("activity-label"),
  activityName: document.getElementById("activity-name"),
  activityDetails: document.getElementById("activity-details"),

  progressSection: document.getElementById("progress-section"),
  progressFill: document.getElementById("progress-fill"),
  progressCurrent: document.getElementById("progress-current"),
  progressTotal: document.getElementById("progress-total"),

  timerSection: document.getElementById("timer-section"),
  timer: document.getElementById("timer"),

  connectionDot: document.getElementById("conn-dot"),
  connectionText: document.getElementById("connection-text"),

  lastUpdate: document.getElementById("last-update"),
};


/* =========================================================
   STATE
========================================================= */

let state = {
  status: "offline",
  application: "",
  process: "",
  activityType: "default",
  details: "",
  state: "",
  windowTitle: "",
  icon: null,
  startedAt: null,
  progress: null,
};

let socket = null;

let reconnectTimer = null;
let reconnectDelay = 1000;

let lastMessageReceivedAt = null;

let isConnecting = false;


/* =========================================================
   HELPERS
========================================================= */

function normalizeTimestamp(value) {
  if (!value) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  /*
   Aceita:
   segundos: 1724000000
   milissegundos: 1724000000000
  */

  return number > 10000000000
    ? Math.floor(number / 1000)
    : Math.floor(number);
}


function activityKey(data) {
  return [
    data?.status || "offline",
    data?.application || "",
    data?.activityType || "default",
    data?.details || "",
    data?.state || "",
    data?.windowTitle || "",
    data?.icon || "",
  ].join("|");
}


function formatMMSS(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));

  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;

  const pad = value => String(value).padStart(2, "0");

  return `${pad(minutes)}:${pad(secs)}`;
}


function formatElapsed(seconds) {
  seconds = Math.max(0, Math.floor(seconds));

  const hours = Math.floor(seconds / 3600);

  const minutes = Math.floor(
    (seconds % 3600) / 60
  );

  const secs = seconds % 60;

  const pad = value =>
    String(value).padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}


function formatRelative(timestamp) {
  if (!timestamp) {
    return "aguardando conexão…";
  }

  const diff = Math.max(
    0,
    Date.now() - timestamp
  );

  const seconds = Math.floor(diff / 1000);

  if (seconds < 5) {
    return "atualizado agora";
  }

  if (seconds < 60) {
    return `atualizado há ${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `atualizado há ${minutes}min`;
  }

  const hours = Math.floor(minutes / 60);

  return `atualizado há ${hours}h`;
}


/* =========================================================
   CONNECTION UI
========================================================= */

function setConnection(status) {
  const dot = elements.connectionDot;
  const text = elements.connectionText;

  dot.classList.remove(
    "connected",
    "disconnected"
  );

  if (status === "connected") {
    dot.classList.add("connected");
    text.textContent = "Conectado";
    return;
  }

  if (status === "disconnected") {
    dot.classList.add("disconnected");
    text.textContent = "Desconectado";
    return;
  }

  text.textContent = "Conectando";
}


/* =========================================================
   WEBSOCKET
========================================================= */

function connect() {
  if (
    isConnecting ||
    socket?.readyState === WebSocket.OPEN ||
    socket?.readyState === WebSocket.CONNECTING
  ) {
    return;
  }

  isConnecting = true;

  setConnection("connecting");

  try {
    socket = new WebSocket(WS_URL);
  } catch {
    isConnecting = false;
    setConnection("disconnected");
    scheduleReconnect();
    return;
  }


  socket.addEventListener("open", () => {
    isConnecting = false;

    reconnectDelay = 1000;

    setConnection("connected");
  });


  socket.addEventListener("message", event => {
    handleMessage(event.data);
  });


  socket.addEventListener("close", () => {
    isConnecting = false;

    setConnection("disconnected");

    scheduleReconnect();
  });


  socket.addEventListener("error", () => {
    setConnection("disconnected");

    if (socket?.readyState === WebSocket.OPEN) {
      socket.close();
    }
  });
}


function scheduleReconnect() {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    connect();
  }, reconnectDelay);

  reconnectDelay = Math.min(
    Math.round(reconnectDelay * 1.6),
    10000
  );
}


/* =========================================================
   MESSAGE
========================================================= */

function handleMessage(rawData) {
  let payload;

  try {
    payload = JSON.parse(rawData);
  } catch {
    return;
  }

  if (!payload || payload.type !== "state") {
    return;
  }

  if (!payload.state) {
    return;
  }

  const previousKey = activityKey(state);

  state = {
    ...state,
    ...payload.state,

    status:
      payload.state.status || "offline",

    startedAt:
      normalizeTimestamp(
        payload.state.startedAt
      ),
  };

  lastMessageReceivedAt = Date.now();

  const changed =
    previousKey !== activityKey(state);

  render(changed);
}


/* =========================================================
   RENDER
========================================================= */

function render(activityChanged = false) {
  const status =
    state.status in STATUS_LABELS
      ? state.status
      : "offline";

  const hasActivity =
    status !== "offline" &&
    Boolean(state.application);


  /*
   Status
  */

  elements.card.dataset.status = status;

  elements.statusLabel.textContent =
    STATUS_LABELS[status];


  /*
   Avatar
  */

  if (
    hasActivity &&
    state.icon
  ) {
    elements.avatarImg.src = state.icon;

    elements.avatarImg.hidden = false;

    elements.avatarFallback.hidden = true;
  } else {
    elements.avatarImg.hidden = true;

    elements.avatarFallback.hidden = false;

    elements.avatarFallback.textContent =
      hasActivity
        ? state.application
            .trim()
            .charAt(0)
            .toUpperCase()
        : "—";
  }


  /*
   Text — label + linhas primária/secundária, centralizadas
   por activityType (ver ACTIVITY_TYPES no topo do arquivo).
   Se activityType não vier do backend (formato antigo), cai
   automaticamente no fallback "default" + windowTitle puro.
  */

  const activityConfig = getActivityConfig(
    hasActivity ? state.activityType : null
  );

  const label = hasActivity
    ? activityConfig.label
    : "SEM ATIVIDADE";

  const primary =
    hasActivity
      ? (state.details || state.application)
      : "Nada por aqui";

  const secondary =
    hasActivity
      ? (state.state || state.windowTitle || "")
      : "";


  /*
   Glow dinâmico por activityType (sutil — só muda a tonalidade
   do glow existente; se não for possível determinar uma cor,
   usa o accent atual do status).
  */

  if (hasActivity && activityConfig.glow) {
    elements.card.style.setProperty(
      "--activity-accent",
      `rgb(${activityConfig.glow})`
    );
    elements.card.dataset.activity = state.activityType;
  } else {
    elements.card.style.removeProperty("--activity-accent");
    delete elements.card.dataset.activity;
  }


  if (activityChanged) {
    animateActivityChange(() => {
      updateActivityText(label, primary, secondary);
    });
  } else {
    updateActivityText(label, primary, secondary);
  }


  /*
   Progress bar
  */

  renderProgress();


  /*
   Timer
  */

  const showTimer =
    status !== "offline" &&
    Boolean(state.startedAt);

  elements.timerSection.hidden =
    !showTimer;
}


function updateActivityText(
  label,
  primary,
  secondary
) {
  elements.activityLabel.textContent = label;

  elements.activityName.textContent =
    primary;

  elements.activityDetails.textContent =
    secondary || "—";

  elements.activityDetails.title =
    secondary || "";
}


/* =========================================================
   PROGRESS BAR
========================================================= */

function renderProgress() {
  const progress = state.progress;

  const hasProgress =
    progress &&
    Number.isFinite(progress.total) &&
    progress.total > 0 &&
    Number.isFinite(progress.current);

  elements.progressSection.hidden = !hasProgress;

  if (!hasProgress) {
    return;
  }

  const clampedCurrent = Math.min(
    Math.max(0, progress.current),
    progress.total
  );

  const percent = (clampedCurrent / progress.total) * 100;

  elements.progressFill.style.width = `${percent}%`;

  elements.progressCurrent.textContent = formatMMSS(clampedCurrent);
  elements.progressTotal.textContent = formatMMSS(progress.total);
}


/* =========================================================
   ACTIVITY ANIMATION
========================================================= */

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

// Timings pedidos: 150ms saída, 120ms troca, 200ms entrada.
const LEAVE_MS = 150;
const SWAP_MS = 120;

function animateActivityChange(callback) {
  if (prefersReducedMotion) {
    callback();
    return;
  }

  const content = elements.activityContent;
  const icon = elements.iconWrapper;

  content.classList.add("is-changing");
  icon.classList.add("is-changing");

  setTimeout(() => {
    callback();

    setTimeout(() => {
      requestAnimationFrame(() => {
        content.classList.remove("is-changing");
        icon.classList.remove("is-changing");
      });
    }, SWAP_MS);
  }, LEAVE_MS);
}


/* =========================================================
   TIMER
========================================================= */

function updateTimer() {
  if (
    state.status === "offline" ||
    !state.startedAt
  ) {
    elements.timer.textContent =
      "00:00:00";

    return;
  }

  const now =
    Math.floor(Date.now() / 1000);

  const elapsed =
    now - state.startedAt;

  elements.timer.textContent =
    formatElapsed(elapsed);
}


/* =========================================================
   LAST UPDATE
========================================================= */

function updateLastMessage() {
  elements.lastUpdate.textContent =
    formatRelative(
      lastMessageReceivedAt
    );
}


/* =========================================================
   IMAGE FALLBACK
========================================================= */

elements.avatarImg.addEventListener(
  "error",
  () => {
    elements.avatarImg.hidden = true;

    elements.avatarFallback.hidden = false;

    elements.avatarFallback.textContent =
      state.application
        ? state.application
            .charAt(0)
            .toUpperCase()
        : "—";
  }
);


/* =========================================================
   LOOP
========================================================= */

function tickProgress() {
  if (
    state.status === "offline" ||
    !state.progress ||
    !Number.isFinite(state.progress.total)
  ) {
    return;
  }

  if (state.progress.current >= state.progress.total) {
    return;
  }

  state.progress = {
    ...state.progress,
    current: state.progress.current + 1,
  };

  renderProgress();
}


setInterval(() => {
  updateTimer();
  updateLastMessage();
  tickProgress();
}, 1000);


/* =========================================================
   INIT
========================================================= */

render(false);
updateTimer();
updateLastMessage();

connect();