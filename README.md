# Real-Time Presence

Rich Presence pessoal: um **Agent** roda no seu Windows e detecta de verdade
qual janela está em primeiro plano (processo + título), envia isso para um
**servidor** Node.js via WebSocket, que retransmite em tempo real para um
**site** público — sem você digitar nada manualmente.

```
Agent (detecta o Windows)  --WebSocket-->  Server  --WebSocket-->  Site (browser)
```

Sem banco de dados. Sem login. Sem conta. Estado só em memória.

> Este projeto é independente — não tem relação com Trezzer, Discord Rich
> Presence ou qualquer outro dos seus outros projetos.

## Estrutura

```
real-time-presence/
├── server/
│   ├── server.js         # servidor WebSocket (relay)
│   └── package.json
├── agent/
│   ├── agent.js           # processo principal do Agent
│   ├── appNames.js        # exe -> nome amigável
│   ├── iconExtractor.js   # extrai o ícone real do .exe (com cache)
│   ├── config.json        # servidor, intervalo, privacidade
│   ├── scripts/
│   │   └── extract-icon.ps1    # script PowerShell usado pelo iconExtractor
│   ├── detectors/
│   │   └── windowDetector.js   # único detector implementado agora
│   ├── .cache/
│   │   └── icons.json     # cache de ícones já extraídos (gerado em runtime)
│   └── package.json
└── web/
    ├── index.html
    ├── style.css
    └── script.js
```

## Como a detecção real funciona

O Agent usa a biblioteca [`active-win`](https://www.npmjs.com/package/active-win),
que chama APIs nativas do Windows para descobrir a janela em primeiro plano
(processo, título). A cada `pollIntervalMs` (padrão: 2000ms) ele pergunta ao
Windows qual é a janela ativa:

- Se o **processo mudou** (ex.: VS Code → Chrome), reinicia o cronômetro e
  envia o novo estado imediatamente.
- Se só o **título da janela mudou** (ex.: trocou de aba no Chrome), envia a
  atualização mas mantém o cronômetro contando desde que abriu o app.
- Se **nada mudou**, não envia nada — evita spamear o servidor a cada
  segundo.

O mapeamento `Code.exe → Visual Studio Code`, `chrome.exe → Google Chrome`
etc. fica em `agent/appNames.js`. Processos fora da lista aparecem com o
próprio nome do executável (nunca somem da tela).

### Ícone real do aplicativo

Quando o app em primeiro plano muda, o Agent chama
`agent/scripts/extract-icon.ps1` (PowerShell + `System.Drawing`, já vem com
o Windows — nada pra instalar) para extrair o ícone real do `.exe` e envia
como PNG em base64 dentro do estado. O site mostra esse ícone com um anel
colorido conforme o status; se a extração falhar por algum motivo, cai de
volta pra um avatar com a inicial do nome do app.

A extração é cacheada (memória + `agent/.cache/icons.json`), então o mesmo
aplicativo não tem o ícone extraído de novo toda vez que ele reaparece —
só na primeira vez que o Agent o vê.

## 1. Instalar dependências

Requer Node.js 18+ no Windows. Abra dois terminais (PowerShell ou CMD).

**Terminal A — servidor:**
```powershell
cd server
npm install
```

**Terminal B — agent:**
```powershell
cd agent
npm install
```

> `active-win` no Windows não precisa de compilação (usa binário nativo já
> empacotado). Se o `npm install` reclamar de algo relacionado a build
> tools, atualize o Node.js para uma versão LTS recente e tente de novo.

## 2. Iniciar o servidor

No Terminal A:
```powershell
npm start
```
Saída esperada:
```
Real-Time Presence server rodando em http://localhost:8080
  Agent conecta em: ws://localhost:8080/agent
  Site conecta em:  ws://localhost:8080/view
```
Deixe esse terminal aberto.

## 3. Iniciar o Agent

No Terminal B:
```powershell
npm start
```
Saída esperada (o texto muda conforme o que você tiver aberto):
```
[agent] Real-Time Presence Agent iniciado.
[agent] Verificando a janela ativa a cada 2000ms.
[agent] Conectando em ws://localhost:8080/agent ...
[agent] Conectado ao servidor.
[agent] Atividade mudou: (nenhuma) -> Code.exe
```

## 4. Abrir o site

Abra `web/index.html` diretamente no navegador, ou sirva a pasta:
```powershell
cd web
npx serve .
```
O card deve mostrar **ONLINE** e o aplicativo que está em primeiro plano
agora, junto do título da janela e o cronômetro rodando.

> O endereço do servidor está fixo em `WS_URL`, no topo de `web/script.js`
> (`ws://localhost:8080/view`). Ajuste se o servidor rodar em outra
> máquina/porta.

## 5. Privacidade

Por padrão o Agent envia o título da janela ativa (ex.: nome do documento,
aba do navegador). Se quiser mostrar só o nome do aplicativo, sem título,
edite `agent/config.json`:
```json
{
  "hideWindowTitle": true
}
```
Nada além de processo/título/tempo/status é capturado — sem teclas, sem
conteúdo de mensagens, sem arquivos.

## Roteiro de teste (detecção real)

1. Suba o servidor e o Agent.
2. Abra o **VS Code** e deixe-o em primeiro plano — o site deve mostrar
   **ONLINE**, "Visual Studio Code" com o título real da janela, e o ícone
   real do VS Code dentro do anel colorido (pode levar um instante na
   primeira vez, enquanto o PowerShell extrai o ícone).
3. Mude para o **Google Chrome** — o site deve atualizar sozinho, sem F5,
   e o cronômetro deve reiniciar (é uma atividade diferente).
4. Troque de aba dentro do Chrome — o site deve atualizar o título da
   janela, mas o cronômetro **não** deve reiniciar (mesmo aplicativo).
5. Abra o **Discord** — o site deve mostrar "Discord".
6. Feche o Agent (`Ctrl+C` no Terminal B) — o site deve mudar para
   **OFFLINE** sozinho (o servidor detecta a queda da conexão).
7. Rode `npm start` de novo no Agent — o site volta a **ONLINE**
   automaticamente assim que a conexão é restabelecida, mostrando o que
   estiver ativo naquele momento.
8. Para testar a reconexão do lado do site: derrube o servidor com o site
   aberto — o ponto de conexão no rodapé fica vermelho. Suba o servidor de
   novo — o site reconecta sozinho.

## Fora do escopo deste MVP (próxima evolução)

`agent/detectors/` foi deixado pronto para crescer — hoje só existe
`windowDetector.js`. Detectores futuros seguiriam o mesmo contrato de
retorno (`{ processName, windowTitle }` ou equivalente):

```
Detector
├── WindowDetector      ✅ implementado
├── ProcessDetector
├── SpotifyDetector
├── GameDetector
└── CustomDetector
```

Também ficam para depois: Spotify, jogos, Steam Rich Presence, Discord
Rich Presence, login, banco de dados, múltiplos usuários, histórico,
contas, sistema de amigos, API pública, SDK, painel administrativo, e um
ícone de bandeja de verdade no lugar do console do Agent.
