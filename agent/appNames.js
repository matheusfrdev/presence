/**
 * Mapa de nomes de processo -> nome amigável exibido no site.
 * Processos que não estiverem aqui aparecem com o próprio nome
 * do executável (fallback), nunca somem da tela.
 */
export const FRIENDLY_NAMES = {
  'code.exe': 'Visual Studio Code',
  'chrome.exe': 'Google Chrome',
  'msedge.exe': 'Microsoft Edge',
  'firefox.exe': 'Firefox',
  'discord.exe': 'Discord',
  'spotify.exe': 'Spotify',
  'steam.exe': 'Steam',
  'steamwebhelper.exe': 'Steam',
  'notepad.exe': 'Notepad',
  'notepad++.exe': 'Notepad++',
  'explorer.exe': 'Windows Explorer',
  'devenv.exe': 'Visual Studio',
  'windowsterminal.exe': 'Windows Terminal',
  'cmd.exe': 'Prompt de Comando',
  'powershell.exe': 'PowerShell',
  'wt.exe': 'Windows Terminal',
  'slack.exe': 'Slack',
  'postman.exe': 'Postman',
  'figma.exe': 'Figma',
  'obs64.exe': 'OBS Studio',
};

export function toFriendlyName(processName) {
  if (!processName) return '';
  const key = processName.toLowerCase();
  return FRIENDLY_NAMES[key] || processName;
}
