import Database from 'better-sqlite3';

const db = new Database('lol_accounts.db');

// Crear tabla si no existe
db.prepare(`
  CREATE TABLE IF NOT EXISTS accounts (
    discordId TEXT PRIMARY KEY,
    puuid TEXT,
    summonerName TEXT,
    tagLine TEXT,
    summonerId TEXT,
    rankTier TEXT,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

export default db;
