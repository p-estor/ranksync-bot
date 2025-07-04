// utils/types.ts
export interface Account {
  discordId: string;
  puuid: string;
  puuidTFT: string;
  summonerName: string;
  tagLine: string;
  rankSoloQ: string; // Renombrado de 'rankTier' a 'rankSoloQ'
  rankFlex: string;  // Nuevo campo para el rango de Flex
  rankTFT: string;   // Nuevo campo para el rango de TFT
  rankDoubleUp: string;
  lastUpdated?: string; // Opcional, ya que la BD lo maneja automáticamente
}