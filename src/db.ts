// src/db.ts
import Database from 'better-sqlite3';

const db = new Database('lol_accounts.db');

// Crear tabla si no existe con el esquema FINAL deseado.
// CAMBIO CLAVE: 'puuid' es ahora la CLAVE PRIMARIA.
// Esto permite que un 'discordId' tenga múltiples entradas
// (representando múltiples cuentas de LoL vinculadas).
db.prepare(`
  CREATE TABLE IF NOT EXISTS accounts (
    discordId TEXT NOT NULL,          -- El ID de Discord (ya NO es PRIMARY KEY)
    puuid TEXT PRIMARY KEY,           -- El PUUID de la cuenta de Riot (¡AHORA CLAVE PRIMARIA!)
    puuidTFT TEXT,
    summonerName TEXT,
    tagLine TEXT,
    rankSoloQ TEXT DEFAULT 'UNRANKED', 
    rankFlex TEXT DEFAULT 'UNRANKED',  
    rankTFT TEXT DEFAULT 'UNRANKED',   
    rankDoubleUp TEXT DEFAULT 'UNRANKED',
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

export default db;