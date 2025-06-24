// src/utils/accountDb.ts

import db from '../db'; // Asumo que este es tu objeto de base de datos de better-sqlite3
import type { Account } from './types';

// Función para insertar o actualizar una cuenta
export async function upsertAccount(data: Account) {
    try {
        // CAMBIO: Verificar el límite de cuentas ANTES de intentar insertar/actualizar
        const userAccounts = getAccountsByDiscordId(data.discordId);
        const existingAccount = userAccounts.find(acc => acc.puuid === data.puuid);

        if (!existingAccount && userAccounts.length >= 3) {
            console.warn(`❌ Límite de 3 cuentas alcanzado para DiscordID: ${data.discordId}. No se puede vincular una nueva cuenta.`);
            throw new Error('LIMIT_EXCEEDED'); // Lanza un error para manejarlo en el comando de vinculación
        }

        const stmt = db.prepare(`
            INSERT INTO accounts (discordId, puuid, summonerName, tagLine, summonerId, rankSoloQ, rankFlex, rankTFT)
            VALUES (@discordId, @puuid, @summonerName, @tagLine, @summonerId, @rankSoloQ, @rankFlex, @rankTFT)
            ON CONFLICT(puuid) DO UPDATE SET -- La clave de conflicto por puuid es correcta para UPDATE
                discordId = excluded.discordId,
                summonerName = excluded.summonerName,
                tagLine = excluded.tagLine,
                summonerId = excluded.summonerId,
                rankSoloQ = excluded.rankSoloQ,
                rankFlex = excluded.rankFlex,
                rankTFT = excluded.rankTFT,
                lastUpdated = CURRENT_TIMESTAMP
        `);
        const info = stmt.run(data);
        if (info.changes === 1) {
            console.log(`[DB] Cuenta vinculada o actualizada para DiscordID: ${data.discordId}, PUUID: ${data.puuid}`);
        }
        return info;
    } catch (error: any) { // Usamos 'any' para capturar cualquier tipo de error y luego verificar si es un error de límite
        if (error.message === 'LIMIT_EXCEEDED') {
            throw error; // Relanzar el error de límite
        }
        console.error('[DB] Error en upsertAccount:', error);
        throw error;
    }
}

// Función: Obtener TODAS las cuentas vinculadas a un Discord ID
export function getAccountsByDiscordId(discordId: string): Account[] {
    const stmt = db.prepare('SELECT * FROM accounts WHERE discordId = ?');
    const accounts = stmt.all(discordId) as Account[]; // Usamos .all() para obtener múltiples resultados
    console.log(`[DB] Cuentas obtenidas para Discord ID ${discordId}: ${accounts.length}`);
    return accounts;
}

// NUEVA FUNCIÓN: Eliminar una cuenta específica por discordId y puuid
export function deleteAccount(discordId: string, puuid: string): boolean {
    try {
        const stmt = db.prepare('DELETE FROM accounts WHERE discordId = ? AND puuid = ?');
        const info = stmt.run(discordId, puuid);
        if (info.changes === 1) {
            console.log(`[DB] Cuenta con PUUID ${puuid} eliminada para Discord ID ${discordId}.`);
            return true;
        } else {
            console.warn(`[DB] No se encontró cuenta con PUUID ${puuid} para Discord ID ${discordId} para eliminar.`);
            return false;
        }
    } catch (error) {
        console.error('[DB] Error en deleteAccount:', error);
        return false;
    }
}

// Opcional: Función para obtener una cuenta por PUUID (si necesitas verificar su existencia en otros lugares)
export function getAccountByPuuid(puuid: string): Account | undefined {
    const stmt = db.prepare('SELECT * FROM accounts WHERE puuid = ?');
    const account = stmt.get(puuid) as Account | undefined;
    if (account) {
        console.log(`[DB] Cuenta obtenida por PUUID ${puuid}: ${account.summonerName}`);
    } else {
        console.log(`[DB] No se encontró cuenta por PUUID ${puuid}.`);
    }
    return account;
}