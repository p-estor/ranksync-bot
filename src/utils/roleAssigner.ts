// src/utils/roleAssigner.ts

import { GuildMember, Role } from 'discord.js';
import { Account } from './types'; // Asegúrate de que Account esté correctamente tipado

// Mapeo de roles de rango. ¡Asegúrate de que estos IDs sean correctos para tu servidor!
// Puedes tener múltiples roles para el mismo Tier si es necesario (ej: "Platino SoloQ", "Platino Flex")
const roleIdMap: { [key: string]: string } = {
    // League of Legends (SoloQ)
    'IRON_SOLOQ': '1370029647005352018',
    'BRONZE_SOLOQ': '1370029647005352022',
    'SILVER_SOLOQ': '1370029647034581032',
    'GOLD_SOLOQ': '1370029647034581036',
    'PLATINUM_SOLOQ': '1370029647034581040',
    'EMERALD_SOLOQ': '1370029647101952132',
    'DIAMOND_SOLOQ': '1370029647101952136',
    'MASTER_SOLOQ': '1370029647126986803',
    'GRANDMASTER_SOLOQ': '1370029647126986807',
    'CHALLENGER_SOLOQ': '1370029647126986811',
    'UNRANKED_SOLOQ': '1370029646976122898',

    // League of Legends (Flex)
    'IRON_FLEX': '1370029647005352017',
    'BRONZE_FLEX': '1370029647005352021',
    'SILVER_FLEX': '1370029647005352025',
    'GOLD_FLEX': '1370029647034581035',
    'PLATINUM_FLEX': '1370029647034581039',
    'EMERALD_FLEX': '1370029647101952131',
    'DIAMOND_FLEX': '1370029647101952135',
    'MASTER_FLEX': '1370029647101952139',
    'GRANDMASTER_FLEX': '1370029647126986806',
    'CHALLENGER_FLEX': '1370029647126986810',
    'UNRANKED_FLEX': '1370029646976122897',

    // Teamfight Tactics (TFT)
    'IRON_TFT': '1370029647005352016',
    'BRONZE_TFT': '1370029647005352020',
    'SILVER_TFT': '1370029647005352024',
    'GOLD_TFT': '1370029647034581034',
    'PLATINUM_TFT': '1370029647034581038',
    'EMERALD_TFT': '1370029647101952130',
    'DIAMOND_TFT': '1370029647101952134',
    'MASTER_TFT': '1370029647101952138',
    'GRANDMASTER_TFT': '1370029647126986805',
    'CHALLENGER_TFT': '1370029647126986809',
    'UNRANKED_TFT': '1370029646976122896',

    // Teamfight Tactics (Double Up)
    'IRON_DOUBLEUP': '1370029646976122899',
    'BRONZE_DOUBLEUP': '1370029647005352019',
    'SILVER_DOUBLEUP': '1370029647005352023',
    'GOLD_DOUBLEUP': '1370029647034581033',
    'PLATINUM_DOUBLEUP': '1370029647034581037',
    'EMERALD_DOUBLEUP': '1370029647034581041',
    'DIAMOND_DOUBLEUP': '1370029647101952133',
    'MASTER_DOUBLEUP': '1370029647101952137',
    'GRANDMASTER_DOUBLEUP': '1370029647126986804',
    'CHALLENGER_DOUBLEUP': '1370029647126986808',
    'UNRANKED_DOUBLEUP': '1370029646976122895',
};



// Array de todos los IDs de rol de rango posibles, para limpieza
const allRankRoleIds = Object.values(roleIdMap);


/**
 * Asigna y remueve roles de rango de Discord basándose en la acumulación de rangos de todas las cuentas vinculadas de un usuario.
 * @param member El GuildMember al que se le asignarán los roles.
 * @param userAccounts Un array de objetos Account del usuario, que contiene los rangos de todas sus cuentas.
 * @returns Un array de nombres de roles asignados.
 */
export async function assignRankRoles(member: GuildMember, userAccounts: Account[]): Promise<string[]> {
    if (!member || !member.guild) {
        console.error('❌ assignRankRoles: GuildMember o Guild no disponible.');
        return [];
    }

    const currentMemberRoleIds = new Set(member.roles.cache.map(role => role.id));
    const rolesToAdd: Set<string> = new Set(); // IDs de roles que el miembro debe tener
    const assignedRoleNames: string[] = [];

    // Paso 1: Determinar TODOS los roles de rango deseados de todas las cuentas
    for (const account of userAccounts) {
        // SoloQ
        const soloQRankKey = `${account.rankSoloQ.toUpperCase()}_SOLOQ`;
        if (roleIdMap[soloQRankKey]) {
            rolesToAdd.add(roleIdMap[soloQRankKey]);
        } else if (account.rankSoloQ === 'UNRANKED' && roleIdMap['UNRANKED_SOLOQ']) {
            rolesToAdd.add(roleIdMap['UNRANKED_SOLOQ']);
        }

        // Flex
        const flexRankKey = `${account.rankFlex.toUpperCase()}_FLEX`;
        if (roleIdMap[flexRankKey]) {
            rolesToAdd.add(roleIdMap[flexRankKey]);
        } else if (account.rankFlex === 'UNRANKED' && roleIdMap['UNRANKED_FLEX']) {
            rolesToAdd.add(roleIdMap['UNRANKED_FLEX']);
        }

        // TFT
        const tftRankKey = `${account.rankTFT.toUpperCase()}_TFT`;
        if (roleIdMap[tftRankKey]) {
            rolesToAdd.add(roleIdMap[tftRankKey]);
        } else if (account.rankTFT === 'UNRANKED' && roleIdMap['UNRANKED_TFT']) {
            rolesToAdd.add(roleIdMap['UNRANKED_TFT']);
        }

        // Double Up
        const doubleUpRankKey = `${(account.rankDoubleUp || 'UNRANKED').toUpperCase()}_DOUBLEUP`; // Asegúrate de manejar 'UNRANKED'
        if (roleIdMap[doubleUpRankKey]) {
            rolesToAdd.add(roleIdMap[doubleUpRankKey]);
        } else if ((account.rankDoubleUp === 'UNRANKED' || !account.rankDoubleUp) && roleIdMap['UNRANKED_DOUBLEUP']) {
            rolesToAdd.add(roleIdMap['UNRANKED_DOUBLEUP']);
        }
    }

    // Paso 2: Remover roles de rango que el usuario NO debería tener
    // Esto es crucial para la "limpieza" y evitar roles obsoletos.
    const rolesToRemove: string[] = [];
    for (const roleId of allRankRoleIds) { // Iterar sobre TODOS los roles de rango posibles
        if (currentMemberRoleIds.has(roleId) && !rolesToAdd.has(roleId)) {
            // El usuario tiene este rol, pero ya no debería tenerlo (no está en rolesToAdd)
            rolesToRemove.push(roleId);
        }
    }

    if (rolesToRemove.length > 0) {
        console.log(`[ROLES] Removiendo roles para ${member.user.tag}: ${rolesToRemove.map(id => member.guild.roles.cache.get(id)?.name || id).join(', ')}`);
        try {
            await member.roles.remove(rolesToRemove, 'Actualización de roles por rangos de LoL/TFT');
        } catch (error) {
            console.error(`❌ Error al remover roles para ${member.user.tag}:`, error);
        }
    }

    // Paso 3: Añadir roles que el usuario debería tener y no tiene
    const rolesToApply: string[] = [];
    for (const roleId of rolesToAdd) {
        if (!currentMemberRoleIds.has(roleId)) {
            rolesToApply.push(roleId);
        }
    }

    if (rolesToApply.length > 0) {
        console.log(`[ROLES] Asignando roles para ${member.user.tag}: ${rolesToApply.map(id => member.guild.roles.cache.get(id)?.name || id).join(', ')}`);
        try {
            await member.roles.add(rolesToApply, 'Actualización de roles por rangos de LoL/TFT');
            rolesToApply.forEach(roleId => {
                const roleName = member.guild.roles.cache.get(roleId)?.name;
                if (roleName) assignedRoleNames.push(roleName);
            });
        } catch (error) {
            console.error(`❌ Error al asignar roles para ${member.user.tag}:`, error);
        }
    }

    if (rolesToRemove.length === 0 && rolesToApply.length === 0) {
        console.log(`[ROLES] No se requieren cambios de roles para ${member.user.tag}.`);
    }

    return assignedRoleNames;
}

// Puedes mantener o remover `toSpanish` si no se usa externamente.
// Ya no es estrictamente necesaria para la lógica de roles con la nueva implementación.
export function toSpanish(englishRank: string): string {
    const rankMap: { [key: string]: string } = {
        'IRON': 'Hierro',
        'BRONZE': 'Bronce',
        'SILVER': 'Plata',
        'GOLD': 'Oro',
        'PLATINUM': 'Platino',
        'EMERALD': 'Esmeralda',
        'DIAMOND': 'Diamante',
        'MASTER': 'Maestro',
        'GRANDMASTER': 'Gran Maestro',
        'CHALLENGER': 'Challenger',
        'UNRANKED': 'Unranked',
    };
    return rankMap[englishRank.toUpperCase()] || englishRank;
}