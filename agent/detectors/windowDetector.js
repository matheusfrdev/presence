import activeWin from 'active-win';

function normalizeProcessName(rawName) {
  if (!rawName) return '';
  // No Windows o active-win costuma retornar o nome do executável
  // (ex.: "Code.exe"). Se vier sem extensão, adicionamos ".exe"
  // para manter a busca no dicionário de nomes amigáveis consistente.
  return /\.[a-z0-9]+$/i.test(rawName) ? rawName : `${rawName}.exe`;
}

export async function getActiveWindow() {
  let info;
  try {
    info = await activeWin();
  } catch (err) {
    console.warn('[WindowDetector] Falha ao consultar a janela ativa:', err.message);
    return null;
  }

  // Pode retornar undefined em telas seguras (ex.: tela de login do Windows)
  // ou quando nenhuma janela está em primeiro plano.
  if (!info || !info.owner) {
    return null;
  }

  return {
    processName: normalizeProcessName(info.owner.name),
    windowTitle: info.title || '',
    exePath: info.owner.path || '',
  };
}
