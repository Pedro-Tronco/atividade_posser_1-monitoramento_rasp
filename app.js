/**
 * Raspberry Pi Telemetry - WebSocket Dashboard
 * Monitoramento em Tempo Real com Detecção de Falhas e Watchdog
 */

// ==========================================
// Configurações & Estado Global
// ==========================================
const CONFIG = {
  DEFAULT_WS_URL: 'ws://10.1.25.105:8000/websocket',
  STORAGE_KEY: 'rpi_telemetry_ws_url',
  RECONNECT_INTERVAL_MS: 3000,
  WATCHDOG_CHECK_INTERVAL_MS: 500,
  STALE_WARNING_THRESHOLD_MS: 3500, // Alerta se demorar mais de 3.5s sem mensagem (já que envia a cada 1s)
  STALE_CRITICAL_THRESHOLD_MS: 6000, // Travamento provável após 6s sem mensagem
  RING_CIRCUMFERENCE: 251.327, // 2 * PI * 40
  MAX_HISTORY_POINTS: 30
};

// Se houver valor antigo salvo com 8888, migra para a porta nova 8000
function getInitialWsUrl() {
  const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
  if (!saved || saved.includes(':8888/')) {
    localStorage.setItem(CONFIG.STORAGE_KEY, CONFIG.DEFAULT_WS_URL);
    return CONFIG.DEFAULT_WS_URL;
  }
  return saved;
}

const state = {
  ws: null,
  wsUrl: getInitialWsUrl(),
  isConnected: false,
  isSimulation: false,
  simulationTimer: null,
  reconnectTimer: null,
  lastMessageTimestamp: null,
  packetCount: 0,
  cpuHistory: [],
  tempHistory: []
};

// ==========================================
// Funções Utilitárias Seguras para o DOM
// ==========================================
function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = typeof id === 'string' ? $(id) : id;
  if (el) el.textContent = text;
}

function setWidth(id, width) {
  const el = typeof id === 'string' ? $(id) : id;
  if (el) el.style.width = width;
}

function setClass(id, className) {
  const el = typeof id === 'string' ? $(id) : id;
  if (el) el.className = className;
}

// ==========================================
// Gerenciamento de Notificação / Toast
// ==========================================
let toastTimeout;
function showToast(message) {
  clearTimeout(toastTimeout);
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

// ==========================================
// Manipulação de Alerta de Conexão
// ==========================================
function showAlert(title, message, isDanger = true) {
  setText('alert-title', title);
  setText('alert-message', message);
  const banner = $('alert-banner');
  if (banner) {
    banner.classList.remove('hidden');
    banner.style.borderColor = isDanger ? 'rgba(239, 68, 68, 0.7)' : 'rgba(245, 158, 11, 0.7)';
  }
}

function hideAlert() {
  const banner = $('alert-banner');
  if (banner) banner.classList.add('hidden');
}

// ==========================================
// Atualização de Status da Conexão
// ==========================================
function setConnectionStatus(type, text) {
  const badge = $('connection-status-badge');
  if (badge) badge.className = `status-badge ${type}`;
  setText('connection-status-text', text);
}

// ==========================================
// WebSocket: Conexão e Ciclo de Vida
// ==========================================
function initWebSocket() {
  if (state.isSimulation) return;

  // Fecha conexão anterior se houver
  if (state.ws) {
    try {
      state.ws.onclose = null;
      state.ws.onerror = null;
      state.ws.close();
    } catch (e) {
      console.warn('Erro ao fechar websocket anterior:', e);
    }
    state.ws = null;
  }

  setConnectionStatus('connecting', 'Conectando à Raspberry...');
  setText('active-ws-url', state.wsUrl);
  setText('reconnect-counter-text', 'Tentando conectar...');

  try {
    state.ws = new WebSocket(state.wsUrl);

    state.ws.onopen = () => {
      state.isConnected = true;
      setConnectionStatus('online', 'Online (Conectado)');
      hideAlert();
      setText('reconnect-counter-text', 'Conectado e recebendo dados');
      showToast('Conectado ao WebSocket da Raspberry Pi!');
      clearTimeout(state.reconnectTimer);
    };

    state.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleTelemetryMessage(data);
      } catch (err) {
        console.error('Erro ao decodificar JSON recebido:', err, event.data);
      }
    };

    state.ws.onclose = (event) => {
      handleDisconnect('A conexão WebSocket foi encerrada.', event.wasClean);
    };

    state.ws.onerror = (err) => {
      console.error('Erro no WebSocket:', err);
      handleDisconnect('Falha de conexão com a Raspberry Pi (Host inacessível ou porta fechada).');
    };

  } catch (err) {
    console.error('Exceção ao criar WebSocket:', err);
    handleDisconnect('Erro ao inicializar conexão: ' + err.message);
  }
}

function handleDisconnect(reason) {
  state.isConnected = false;
  setConnectionStatus('offline', 'Desconectado');
  showAlert(
    'Raspberry Pi Desconectada!',
    `${reason} Tentando reconectar automaticamente...`
  );
  scheduleReconnect();
}

function scheduleReconnect() {
  if (state.isSimulation) return;
  clearTimeout(state.reconnectTimer);
  
  let countdown = Math.round(CONFIG.RECONNECT_INTERVAL_MS / 1000);
  setText('reconnect-counter-text', `Reconectando em ${countdown}s...`);

  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      setText('reconnect-counter-text', `Reconectando em ${countdown}s...`);
    } else {
      clearInterval(countdownInterval);
    }
  }, 1000);

  state.reconnectTimer = setTimeout(() => {
    clearInterval(countdownInterval);
    console.log('Tentando reconectar com WebSocket...');
    initWebSocket();
  }, CONFIG.RECONNECT_INTERVAL_MS);
}

// ==========================================
// Processamento de Telemetria
// ==========================================
function handleTelemetryMessage(data) {
  state.lastMessageTimestamp = Date.now();
  state.packetCount++;

  // Esconder alerta se estiver visível
  hideAlert();
  if (state.isConnected || state.isSimulation) {
    setConnectionStatus('online', state.isSimulation ? 'Modo Simulação Ativo' : 'Online (Recebendo)');
  }

  // 1. Metadados e Cabeçalho
  setText('packets-counter', `${state.packetCount.toLocaleString('pt-BR')} pacotes`);
  setText('device-model-label', data.model || 'Raspberry Pi');
  setText('device-model-full', data.model || '--');
  setText('device-hostname', data.hostname || '--');
  setText('device-serial', data.serial_number || '--');
  setText('device-ip', data.local_ip || '--');

  // Formatar Uptime
  setText('device-uptime', formatUptime(data.uptime));

  // 2. Data / Hora da Última Atualização
  updateTimestampUI();

  // 3. Métricas
  const cpuVal = Number(data.cpu_usage_percent || 0);
  const tempVal = Number(data.cpu_temperature_celsius || 0);
  const memVal = Number(data.memory_usage_percent || 0);
  const storageVal = Number(data.storage_usage_percent || 0);

  // Atualizar CPU
  updateCpuUI(cpuVal);

  // Atualizar Temperatura
  updateTempUI(tempVal);

  // Atualizar Memória
  updateMemoryUI(memVal);

  // Atualizar Armazenamento
  updateStorageUI(storageVal);

  // Atualizar Históricos e Gráficos
  state.cpuHistory.push(cpuVal);
  if (state.cpuHistory.length > CONFIG.MAX_HISTORY_POINTS) state.cpuHistory.shift();
  drawSparkline($('cpu-chart'), state.cpuHistory, '#00d2ff', 'rgba(0, 210, 255, 0.2)');

  state.tempHistory.push(tempVal);
  if (state.tempHistory.length > CONFIG.MAX_HISTORY_POINTS) state.tempHistory.shift();
  drawSparkline($('temp-chart'), state.tempHistory, '#ff7849', 'rgba(255, 120, 73, 0.2)', 30, 85);
}

// ==========================================
// Formatadores de UI
// ==========================================
function formatUptime(rawUptime) {
  if (!rawUptime) return '--:--:--';
  const parts = String(rawUptime).split('.');
  return parts[0] || rawUptime;
}

function updateTimestampUI() {
  if (!state.lastMessageTimestamp) return;

  const now = new Date(state.lastMessageTimestamp);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();

  setText('last-update-time', `${day}/${month}/${year} às ${hours}:${minutes}:${seconds}`);
  
  const relTag = $('last-update-relative');
  if (relTag) {
    relTag.textContent = 'Agora';
    relTag.classList.remove('stale-warning');
  }
}

function setRingProgress(ringId, percent) {
  const el = typeof ringId === 'string' ? $(ringId) : ringId;
  if (!el) return;
  const clamped = Math.min(Math.max(percent, 0), 100);
  const offset = CONFIG.RING_CIRCUMFERENCE - (clamped / 100) * CONFIG.RING_CIRCUMFERENCE;
  el.style.strokeDashoffset = offset;
}

// ------------------------------------------
// CPU UI
// ------------------------------------------
function updateCpuUI(cpuVal) {
  setText('cpu-usage-val', cpuVal.toFixed(1));
  setWidth('cpu-bar-fill', `${Math.min(cpuVal, 100)}%`);
  setRingProgress('cpu-ring-fill', cpuVal);

  if (cpuVal > 85) {
    setClass('cpu-load-badge', 'pill-chip chip-danger');
    setText('cpu-load-badge', 'Crítico');
  } else if (cpuVal > 60) {
    setClass('cpu-load-badge', 'pill-chip chip-warning');
    setText('cpu-load-badge', 'Moderado');
  } else {
    setClass('cpu-load-badge', 'pill-chip chip-normal');
    setText('cpu-load-badge', 'Normal');
  }
}

// ------------------------------------------
// Temperatura UI
// ------------------------------------------
function updateTempUI(tempVal) {
  setText('cpu-temp-val', tempVal.toFixed(1));

  // Escala normalizada de temperatura para o ring (0°C a 85°C)
  const tempPercent = (tempVal / 85) * 100;
  setWidth('temp-bar-fill', `${Math.min(tempPercent, 100)}%`);
  setRingProgress('temp-ring-fill', tempPercent);

  if (tempVal >= 75) {
    setClass('cpu-temp-badge', 'pill-chip chip-danger');
    setText('cpu-temp-badge', 'Muito Quente 🔥');
  } else if (tempVal >= 60) {
    setClass('cpu-temp-badge', 'pill-chip chip-warning');
    setText('cpu-temp-badge', 'Elevada');
  } else {
    setClass('cpu-temp-badge', 'pill-chip chip-normal');
    setText('cpu-temp-badge', 'Adequada');
  }
}

// ------------------------------------------
// Memória RAM UI
// ------------------------------------------
function updateMemoryUI(memVal) {
  setText('memory-usage-val', memVal.toFixed(1));
  setWidth('mem-bar-fill', `${Math.min(memVal, 100)}%`);
  setRingProgress('mem-ring-fill', memVal);

  if (memVal > 85) {
    setClass('memory-load-badge', 'pill-chip chip-danger');
    setText('memory-load-badge', 'Sobrecarga');
    setText('mem-status-caption', 'Quase Esgotada');
    setText('mem-pressure-caption', 'Alta');
  } else if (memVal > 70) {
    setClass('memory-load-badge', 'pill-chip chip-warning');
    setText('memory-load-badge', 'Alerta');
    setText('mem-status-caption', 'Uso Alto');
    setText('mem-pressure-caption', 'Média');
  } else {
    setClass('memory-load-badge', 'pill-chip chip-normal');
    setText('memory-load-badge', 'Livre');
    setText('mem-status-caption', 'Otimizado');
    setText('mem-pressure-caption', 'Baixa');
  }
}

// ------------------------------------------
// Armazenamento UI
// ------------------------------------------
function updateStorageUI(storageVal) {
  setText('storage-usage-val', storageVal.toFixed(1));
  setWidth('storage-bar-fill', `${Math.min(storageVal, 100)}%`);
  setRingProgress('storage-ring-fill', storageVal);

  const freeVal = Math.max(0, 100 - storageVal).toFixed(1);
  setText('storage-free-val', `${freeVal}%`);

  if (storageVal > 90) {
    setClass('storage-load-badge', 'pill-chip chip-danger');
    setText('storage-load-badge', 'Quase Cheio');
  } else if (storageVal > 75) {
    setClass('storage-load-badge', 'pill-chip chip-warning');
    setText('storage-load-badge', 'Atenção');
  } else {
    setClass('storage-load-badge', 'pill-chip chip-normal');
    setText('storage-load-badge', 'Saudável');
  }
}

// ==========================================
// Sparkline Chart no Canvas
// ==========================================
function drawSparkline(canvas, data, strokeColor, fillColor, customMin = 0, customMax = 100) {
  if (!canvas || !data || data.length === 0) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.parentElement ? canvas.parentElement.clientWidth : 300;
  const height = canvas.height || 55;

  if (canvas.width !== width * dpr) {
    canvas.width = width * dpr;
    canvas.style.width = width + 'px';
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const min = customMin !== undefined ? customMin : Math.min(...data);
  const max = customMax !== undefined ? customMax : Math.max(...data);
  const range = max - min || 1;

  const stepX = width / (CONFIG.MAX_HISTORY_POINTS - 1);
  const startOffset = width - ((data.length - 1) * stepX);

  ctx.beginPath();
  data.forEach((val, i) => {
    const x = startOffset + (i * stepX);
    const normalizedY = (val - min) / range;
    const y = height - (normalizedY * (height - 10)) - 5;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  // Linha de contorno
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Área preenchida com degradê
  ctx.lineTo(startOffset + (data.length - 1) * stepX, height);
  ctx.lineTo(startOffset, height);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  ctx.restore();
}

// ==========================================
// WATCHDOG (Cão de Guarda): Detecção de Travamento da Raspberry
// ==========================================
setInterval(() => {
  if (!state.lastMessageTimestamp) return;

  const elapsedMs = Date.now() - state.lastMessageTimestamp;
  const elapsedSec = Math.floor(elapsedMs / 1000);

  const relTag = $('last-update-relative');
  if (relTag) {
    if (elapsedSec < 1) {
      relTag.textContent = 'Agora';
      relTag.classList.remove('stale-warning');
    } else if (elapsedSec < 60) {
      relTag.textContent = `Há ${elapsedSec}s`;
      if (elapsedSec >= 3) {
        relTag.classList.add('stale-warning');
      }
    } else {
      const minutes = Math.floor(elapsedSec / 60);
      relTag.textContent = `Há ${minutes}min`;
      relTag.classList.add('stale-warning');
    }
  }

  // Se estiver em modo simulação, o watchdog não precisa disparar alerta de erro
  if (state.isSimulation) return;

  const watchdog = $('watchdog-indicator');

  // Verificação de Atraso Crítico / Travamento da Raspberry
  if (elapsedMs > CONFIG.STALE_CRITICAL_THRESHOLD_MS) {
    // Passou de 6 segundos sem nenhuma mensagem
    setConnectionStatus('stale', 'Sem Resposta (Raspberry Travou?)');
    if (watchdog) {
      watchdog.className = 'watchdog-alert';
      watchdog.textContent = `🚨 Atraso Crítico (${elapsedSec}s sem dados)`;
    }

    showAlert(
      'Raspberry Pi sem resposta!',
      `Nenhuma mensagem recebida há ${elapsedSec} segundos. A placa pode ter travado, desligado ou o serviço de telemetria parou.`
    );
  } else if (elapsedMs > CONFIG.STALE_WARNING_THRESHOLD_MS) {
    // Atraso leve (mais de 3.5s)
    setConnectionStatus('connecting', `Atraso (${elapsedSec}s)`);
    if (watchdog) {
      watchdog.className = 'watchdog-warn';
      watchdog.textContent = `⚠️ Atraso nos dados (${elapsedSec}s)`;
    }
  } else {
    // Normal (dentro dos 3.5s)
    if (watchdog) {
      watchdog.className = 'watchdog-ok';
      watchdog.textContent = 'Watchdog Ativo (1 msg/s)';
    }
  }
}, CONFIG.WATCHDOG_CHECK_INTERVAL_MS);

// ==========================================
// Modo Simulação (Para Testes sem Raspberry Ligada)
// ==========================================
function toggleSimulation() {
  state.isSimulation = !state.isSimulation;

  const simBtn = $('toggle-sim-btn');
  const simText = $('sim-btn-text');

  if (state.isSimulation) {
    if (state.ws) {
      state.ws.close();
      state.ws = null;
    }
    clearTimeout(state.reconnectTimer);
    if (simBtn) simBtn.classList.add('active');
    if (simText) simText.textContent = 'Parar Simulação';
    setConnectionStatus('online', 'Modo Simulação Ativo');
    showToast('Modo de Simulação iniciado com dados de teste');
    hideAlert();

    let simSeconds = 3833; // 1:03:53 inicial
    state.simulationTimer = setInterval(() => {
      simSeconds++;
      const hours = Math.floor(simSeconds / 3600);
      const mins = Math.floor((simSeconds % 3600) / 60);
      const secs = simSeconds % 60;
      const uptimeStr = `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.123456`;

      // Flutuações realistas baseadas no payload fornecido
      const fakeCpu = Math.max(0.5, Math.min(95, (Math.random() * 22 + (Math.random() > 0.85 ? 45 : 0))));
      const fakeTemp = 48.0 + (Math.random() * 4 - 2);
      const fakeMem = 14.3 + (Math.random() * 1.5 - 0.7);

      const fakeData = {
        hostname: "raspberrypi",
        model: "Raspberry Pi 4 Model B Rev 1.5",
        serial_number: "10000000621d3237",
        local_ip: "10.1.25.84",
        uptime: uptimeStr,
        cpu_usage_percent: parseFloat(fakeCpu.toFixed(1)),
        cpu_temperature_celsius: parseFloat(fakeTemp.toFixed(3)),
        memory_usage_percent: parseFloat(fakeMem.toFixed(1)),
        storage_usage_percent: 43.2
      };

      handleTelemetryMessage(fakeData);
    }, 1000);
  } else {
    clearInterval(state.simulationTimer);
    if (simBtn) simBtn.classList.remove('active');
    if (simText) simText.textContent = 'Simular Dados';
    showToast('Simulação encerrada. Reconectando ao WebSocket real...');
    initWebSocket();
  }
}

// ==========================================
// Configuração de Eventos
// ==========================================
function setupEventListeners() {
  const toggleConfigBtn = $('toggle-config-btn');
  if (toggleConfigBtn) {
    toggleConfigBtn.addEventListener('click', () => {
      const drawer = $('config-drawer');
      if (drawer) drawer.classList.toggle('hidden');
    });
  }

  const saveConnectBtn = $('save-connect-btn');
  if (saveConnectBtn) {
    saveConnectBtn.addEventListener('click', () => {
      const input = $('ws-url-input');
      const newUrl = input ? input.value.trim() : '';
      if (newUrl) {
        state.wsUrl = newUrl;
        localStorage.setItem(CONFIG.STORAGE_KEY, newUrl);
        const drawer = $('config-drawer');
        if (drawer) drawer.classList.add('hidden');
        showToast('Endereço salvo. Reconectando...');
        if (state.isSimulation) toggleSimulation();
        initWebSocket();
      }
    });
  }

  const alertReconnectBtn = $('alert-reconnect-btn');
  if (alertReconnectBtn) {
    alertReconnectBtn.addEventListener('click', () => {
      showToast('Forçando nova tentativa de conexão...');
      initWebSocket();
    });
  }

  const toggleSimBtn = $('toggle-sim-btn');
  if (toggleSimBtn) {
    toggleSimBtn.addEventListener('click', toggleSimulation);
  }

  // Copiar IP
  const copyIpBtn = $('copy-ip-btn');
  if (copyIpBtn) {
    copyIpBtn.addEventListener('click', () => {
      const ip = $('device-ip') ? $('device-ip').textContent : '';
      if (ip && ip !== '--.---.--.--') {
        navigator.clipboard.writeText(ip).then(() => {
          showToast(`IP ${ip} copiado!`);
        });
      }
    });
  }

  // Copiar Serial
  const copySerialBtn = $('copy-serial-btn');
  if (copySerialBtn) {
    copySerialBtn.addEventListener('click', () => {
      const serial = $('device-serial') ? $('device-serial').textContent : '';
      if (serial && serial !== '--') {
        navigator.clipboard.writeText(serial).then(() => {
          showToast(`Serial copiado: ${serial}`);
        });
      }
    });
  }

  // Redimensionamento de janela para charts
  window.addEventListener('resize', () => {
    drawSparkline($('cpu-chart'), state.cpuHistory, '#00d2ff', 'rgba(0, 210, 255, 0.2)');
    drawSparkline($('temp-chart'), state.tempHistory, '#ff7849', 'rgba(255, 120, 73, 0.2)', 30, 85);
  });
}

// ==========================================
// Inicialização
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  const wsInput = $('ws-url-input');
  if (wsInput) wsInput.value = state.wsUrl;
  setText('active-ws-url', state.wsUrl);
  initWebSocket();
});
