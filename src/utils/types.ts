// utils/types.ts
export interface Account {
  discordId: string;
  puuid: string;
  summonerName: string;
  tagLine: string;
  summonerId: string;
  rankTier: string;
  lastUpdated?: string; // opcional, porque la BD lo pone automáticamente
}
