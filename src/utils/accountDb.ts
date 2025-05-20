import db from '../db';
import type { Account } from './types';

export async function upsertAccount(data: Account) {
  try {
    const stmt = db.prepare(`
      INSERT INTO accounts (discordId, puuid, summonerName, tagLine, summonerId, rankTier)
      VALUES (@discordId, @puuid, @summonerName, @tagLine, @summonerId, @rankTier)
      ON CONFLICT(discordId) DO UPDATE SET
        puuid = excluded.puuid,
        summonerName = excluded.summonerName,
        tagLine = excluded.tagLine,
        summonerId = excluded.summonerId,
        rankTier = excluded.rankTier,
        lastUpdated = CURRENT_TIMESTAMP
    `);
    const info = stmt.run(data);
    if (info.changes === 1) {
      console.log(`Cuenta vinculada o actualizada para DiscordID: ${data.discordId}`);
    }
    return info;
  } catch (error) {
    console.error('Error en upsertAccount:', error);
    throw error;
  }
}

export function getAccountByDiscordId(discordId: string): Account | undefined {
  const stmt = db.prepare('SELECT * FROM accounts WHERE discordId = ?');
  return stmt.get(discordId) as Account | undefined;
}

export function updateRankTier(discordId: string, rankTier: string) {
  const stmt = db.prepare(`
    UPDATE accounts SET rankTier = ?, lastUpdated = CURRENT_TIMESTAMP WHERE discordId = ?
  `);
  return stmt.run(rankTier, discordId);
}
