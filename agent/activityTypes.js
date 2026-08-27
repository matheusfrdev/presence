export const ACTIVITY_TYPE_BY_PROCESS = {
  // música
  'spotify.exe': 'music',

  // código
  'code.exe': 'coding',
  'devenv.exe': 'coding',
  'code - insiders.exe': 'coding',

  // navegadores
  'chrome.exe': 'browser',
  'msedge.exe': 'browser',
  'firefox.exe': 'browser',
  'brave.exe': 'browser',

  // discord
  'discord.exe': 'discord',
  'discordcanary.exe': 'discord',
  'discordptb.exe': 'discord',

  // jogos (lista conservadora — só processos inequívocos)
  'cs2.exe': 'game',
  'csgo.exe': 'game',
  'valorant-win64-shipping.exe': 'game',
  'dota2.exe': 'game',
  'leagueclientux.exe': 'game',
  'fortniteclient-win64-shipping.exe': 'game',
  'gta5.exe': 'game',
  'r5apex.exe': 'game',
  'valorant.exe': 'game',
};

/**
 * @param {string|null|undefined} processName ex.: "Spotify.exe"
 * @returns {string} activityType (ou "default" se não reconhecido)
 */
export function getActivityType(processName) {
  if (!processName) return 'default';
  return ACTIVITY_TYPE_BY_PROCESS[processName.toLowerCase()] || 'default';
}
