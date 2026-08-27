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
