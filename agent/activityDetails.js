/**
 * ActivityDetails
 * ------------------------------------------------------------
 * Deriva "details" (linha principal) e "state" (linha secundária)
 * a partir do windowTitle REAL retornado pelo windowDetector.
 *
 * IMPORTANTE — limite honesto do que dá pra saber:
 * Não existe integração com a API do Spotify, com o RPC do
 * Discord nem com hooks de jogo. A única fonte de dados é o
 * título da janela em primeiro plano (windowTitle). Por isso:
 *
 *  - Para Spotify, isso só funciona quando o cliente clássico do
 *    Windows expõe o título como "Artista - Faixa" (é o que ele
 *    faz por padrão quando uma música está tocando). Quando o
 *    título não segue esse padrão (ex.: nada tocando), cai no
 *    fallback e mostra o título cru.
 *  - Para VS Code / Visual Studio, o título normalmente é
 *    "arquivo - pasta - Visual Studio Code" (ou similar). Extraímos
 *    o que dá pra extrair; se o título não tiver esse formato,
 *    também cai no fallback.
 *  - Para navegadores, o "details" é a primeira parte do título da
 *    aba (não há "state" separado, porque o SO não expõe URL/domínio
 *    de forma confiável a partir do título da janela).
 *  - Para jogos e demais tipos, não há como extrair nada além do
 *    próprio título — então "details" é o título cru e "state" fica
 *    vazio. Nada aqui é inventado.
 *
 * @param {string} activityType
 * @param {string} windowTitle
 * @returns {{ details: string, state: string }}
 */
export function extractActivityDetails(activityType, windowTitle) {
  const title = (windowTitle || '').trim();

  if (!title) {
    return { details: '', state: '' };
  }

  switch (activityType) {
    case 'music': {
      // Formato típico do Spotify (Windows): "Artista - Faixa"
      const parts = title.split(' - ').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return {
          details: parts.slice(1).join(' - '),
          state: parts[0],
        };
      }
      return { details: title, state: '' };
    }

    case 'coding': {
      // Formato típico: "arquivo - pasta - Visual Studio Code"
      const parts = title
        .split(' - ')
        .map(p => p.trim())
        .filter(p => p && !/visual studio code/i.test(p));

      if (parts.length >= 2) {
        return { details: parts[1], state: parts[0] };
      }
      if (parts.length === 1) {
        return { details: parts[0], state: '' };
      }
      return { details: title, state: '' };
    }

    case 'browser': {
      // Formato típico: "Título da aba - Nome do Navegador"
      const parts = title.split(' - ').map(p => p.trim()).filter(Boolean);
      return { details: parts[0] || title, state: '' };
    }

    default:
      // game, discord e qualquer tipo sem parser específico:
      // não há como extrair mais nada — usa o título cru.
      return { details: title, state: '' };
  }
}
