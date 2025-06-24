// utils/types.ts
export interface Account {
  discordId: string;
  puuid: string;
  summonerName: string;
  tagLine: string;
  summonerId: string;
  rankSoloQ: string; // Renombrado de 'rankTier' a 'rankSoloQ'
  rankFlex: string;  // Nuevo campo para el rango de Flex
  rankTFT: string;   // Nuevo campo para el rango de TFT
  lastUpdated?: string; // Opcional, ya que la BD lo maneja automáticamente
}