# 🍓 Raspberry Pi - Dashboard de Telemetria WebSocket

Frontend moderno, responsivo e em tempo real para monitoramento de hardware da Raspberry Pi via WebSocket.

---

## 🚀 Como Executar

### Opção 1: Abrir diretamente no navegador (Mais simples)
Basta dar **duplo clique** no arquivo [`index.html`](file:///c:/Users/felip/Desktop/TRABALO%20POSSER%20FRONT/index.html) no Windows Explorer ou arrastá-lo para qualquer navegador (Chrome, Edge, Firefox).

### Opção 2: Servidor Local (Recomendado)
Se preferir rodar através de um servidor HTTP local:
```bash
# Com Python:
python -m http.server 3000

# Ou com Node.js:
npx serve .
```
E acesse no navegador: `http://localhost:3000`

---

## 📡 Configuração do WebSocket

- **Endereço Padrão**: `ws://10.1.25.105:8000/websocket`
- **Alteração Dinâmica**: Você pode alterar o IP e a porta diretamente na interface clicando no ícone de engrenagem ⚙️ no cabeçalho e clicando em **Reconectar**. O novo endereço é salvo no `localStorage` do seu navegador.

### Formato do Payload Esperado (a cada segundo):
```json
{
  "hostname": "raspberrypi",
  "model": "Raspberry Pi 4 Model B Rev 1.5",
  "serial_number": "10000000621d3237",
  "local_ip": "10.1.25.84",
  "uptime": "1:03:53.293885",
  "cpu_usage_percent": 0.0,
  "cpu_temperature_celsius": 48.199,
  "memory_usage_percent": 14.3,
  "storage_usage_percent": 43.2
}
```

---

## 🛡️ Tratamento de Quedas e "Raspberry Travada"

O sistema possui duas camadas de proteção e alerta:

1. **Reconexão Automática & Queda de Rede**:
   - Caso o WebSocket seja fechado ou ocorra erro de conexão, a interface entra no estado **Desconectado**, exibe uma faixa de alerta em vermelho e tenta reconectar automaticamente a cada 3 segundos com contagem regressiva em tempo real.
   - Há também um botão **"Tentar Reconectar Agora"** para forçar nova tentativa imediata.

2. **Watchdog de Inatividade (Detecção de Travamento / Placa "der pau")**:
   - Se o socket permanecer aberto mas a Raspberry Pi **parar de enviar dados por mais de 3,5 segundos**, o indicador muda para aviso de atraso.
   - Se passar de **6 segundos** sem novas mensagens, um alerta de travamento crítico é acionado:
     > *"🚨 Atraso Crítico: A Raspberry Pi não envia dados há mais de 6 segundos. A placa pode ter travado, desligado ou o processo de telemetria caiu."*

3. **Data e Hora da Última Atualização**:
   - Informa a data e hora exata da última mensagem (`DD/MM/AAAA às HH:mm:ss`).
   - Tag de tempo relativo contínuo (`Agora mesmo`, `Há 1s`, `Há 2s`...) com destaque visual caso fique desatualizado.

---

## 🧪 Modo de Simulação (Para Testes sem a Raspberry)

No canto superior direito, clique no botão **"Simular Dados"**. A interface gerará pacotes de telemetria a cada segundo simulando as métricas e gráficos em tempo real, permitindo testar o dashboard mesmo quando a placa física não estiver acessível.

---

## 📁 Estrutura de Arquivos

- [`index.html`](file:///c:/Users/felip/Desktop/TRABALO%20POSSER%20FRONT/index.html): Estrutura semântica HTML5 com cards de telemetria, medidores circulares e painel do sistema.
- [`style.css`](file:///c:/Users/felip/Desktop/TRABALO%20POSSER%20FRONT/style.css): Estilização moderna com design glassmorphism, modo escuro, efeitos de neon e responsividade.
- [`app.js`](file:///c:/Users/felip/Desktop/TRABALO%20POSSER%20FRONT/app.js): Lógica de conexão WebSocket, reconexão automática, watchdog, gráficos em Canvas e modo simulação.
