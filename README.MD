# 🍓 Raspberry Pi - Sistema de Monitoramento e Telemetria em Tempo Real

Sistema *full-stack* containerizado para monitoramento de hardware da Raspberry Pi em tempo real via WebSocket, composto por um **Backend Python (Tornado)** e um **Frontend Web estático** servido pelo **Caddy**.

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    Raspberry Pi Host                        │
│                                                             │
│  ┌──────────────────────┐        ┌───────────────────────┐  │
│  │   caddy-frontend     │        │    python-backend     │  │
│  │   (Caddy Server)     │        │   (Tornado Server)    │  │
│  │                      │        │                       │  │
│  │  Servidor Web        │        │  Coleta de Métricas   │  │
│  │  Porta: 8888         │        │  (/hostfs e /sys)     │  │
│  │                      │        │  WebSocket: 8000      │  │
│  └──────────┬───────────┘        └───────────▲───────────┘  │
└─────────────┼────────────────────────────────┼──────────────┘
              │                                │
              ▼                                │
      ┌───────────────┐                        │
      │  Navegador    ├────────────────────────┘
      │  (Dashboard)  │   WebSocket (ws://IP:8000/websocket)
      └───────────────┘
```

- **Backend (`python-backend`)**:
  - Desenvolvido em **Python 3.13** com **Tornado** e gerenciado via **`uv`**.
  - Roda em modo containerizado privileged (`network_mode: host`) com acesso de leitura ao sistema de arquivos do host (`/hostfs` e `/sys`).
  - Coleta métricas de CPU, temperatura, memória, armazenamento, uptime, IP e hostname.
  - Transmite os dados a cada segundo via **WebSocket na porta `8000`** (endpoint `/websocket`).

- **Frontend (`caddy-frontend`)**:
  - Servido via servidor web **Caddy (`caddy:alpine`)** na **porta `8888`**.
  - Interface Single Page Application (SPA) construída com **HTML5 semântico, CSS3 Glassmorphic e Vanilla JavaScript**.
  - Gráficos de histórico em tempo real desenhados em Canvas HTML5.

---

## 🚀 Como Executar

### Pré-requisitos
- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/install/) instalados na Raspberry Pi ou ambiente Linux.

### Subir o Sistema Completo

No diretório raiz do projeto, execute:

```bash
docker compose up -d --build
```

Os serviços serão iniciados em segundo plano:
- **Dashboard (Frontend)**: Acesse no navegador em `http://<IP_DA_RASPBERRY>:8888` ou `http://localhost:8888`.
- **WebSocket (Backend)**: Disponível em `ws://<IP_DA_RASPBERRY>:8000/websocket`.

### Parar os Serviços

```bash
docker compose down
```

---

## 📡 Configuração e Payload WebSocket

- **Endereço Padrão**: `ws://10.1.25.105:8000/websocket`
- **Ajuste Dinâmico**: É possível alterar o IP e a porta de conexão diretamente na interface do Dashboard clicando no ícone de engrenagem ⚙️ e clicando em **Reconectar**. O endereço digitado é salvo no `localStorage` do navegador.

### Exemplo de Payload Transmitido (a cada segundo):
```json
{
  "hostname": "raspberrypi",
  "model": "Raspberry Pi 4 Model B Rev 1.5",
  "serial_number": "10000000621d3237",
  "local_ip": "10.1.25.84",
  "uptime": "1:03:53.293885",
  "cpu_usage_percent": 12.5,
  "cpu_temperature_celsius": 48.2,
  "memory_usage_percent": 14.3,
  "storage_usage_percent": 43.2
}
```

---

## 🛡️ Camadas de Proteção e Resiliência (Watchdog)

O Dashboard possui monitoramento ativo da saúde da conexão e da placa:

1. **Reconexão Automática**:
   - Se a conexão WebSocket cair, o painel exibe um alerta de desconexão e tenta reconectar automaticamente a cada 3 segundos com contagem regressiva visual.
   - Há um botão **"Tentar Reconectar Agora"** para forçar nova tentativa imediata.

2. **Watchdog de Inatividade (Detecção de Travamento)**:
   - Se o socket permanecer aberto mas a Raspberry Pi **não enviar dados por mais de 3,5 segundos**, o indicador avisa que os dados estão desatualizados.
   - Se ultrapassar **6 segundos**, dispara um alerta crítico:
     > *"🚨 Atraso Crítico: A Raspberry Pi não envia dados há mais de 6 segundos. A placa pode ter travado, desligado ou o processo de telemetria caiu."*

3. **Modo de Simulação**:
   - É possível ativar a opção **"Simular Dados"** no canto superior direito para testar o Dashboard com dados simulados sem necessidade da placa física.

---

## 📁 Estrutura de Arquivos do Projeto

```
.
├── Caddyfile              # Configuração do servidor Caddy (porta 8888)
├── docker-compose.yml     # Orquestração dos containers (Backend + Frontend Caddy)
├── index.html             # Estrutura HTML do Dashboard
├── style.css              # Estilos CSS (Glassmorphism, Dark Theme, Animações)
├── app.js                 # Lógica de WebSocket, Gráficos Canvas e Watchdog
└── backend/               # Código-fonte do serviço Backend (Python/Tornado)
    ├── Dockerfile         # Build multi-stage com UV e Python 3.13
    ├── pyproject.toml     # Dependências do projeto Python
    └── src/backend/       # Módulos do servidor Tornado e coletores de hardware
```
