// src/utils/roleAssigner.ts
import { GuildMember } from 'discord.js';

// --- Mapeo de tiers a IDs de roles de Discord ---
// Las claves aquí (IRON, BRONZE, etc.) DEBEN coincidir con los valores que devuelve la API de Riot.
export const roleIdMap: { [key: string]: { [tier: string]: string | undefined } } = {
    SOLOQ: {
        IRON: '1370029647005352018',
        BRONZE: '1370029647005352022',
        SILVER: '1370029647034581032',
        GOLD: '1370029647034581036',
        PLATINUM: '1370029647034581040',
        EMERALD: '1370029647101952132',
        DIAMOND: '1370029647101952136',
        MASTER: '1370029647126986803',
        GRANDMASTER: '1370029647126986807',
        CHALLENGER: '1370029647126986811',
        UNRANKED: '1370029646976122898',
    },
    FLEX: {
        IRON: '1370029647005352017',
        BRONZE: '1370029647005352021',
        SILVER: '1370029647005352025',
        GOLD: '1370029647034581035',
        PLATINUM: '1370029647034581039',
        EMERALD: '1370029647101952131',
        DIAMOND: '1370029647101952135',
        MASTER: '1370029647101952139',
        GRANDMASTER: '1370029647126986806',
        CHALLENGER: '1370029647126986810',
        UNRANKED: '1370029646976122897',
    },
    TFT: {
        IRON: '1370029647005352016',
        BRONZE: '1370029647005352020',
        SILVER: '1370029647005352024',
        GOLD: '1370029647034581034',
        PLATINUM: '1370029647034581038',
        EMERALD: '1370029647101952130',
        DIAMOND: '1370029647101952134',
        MASTER: '1370029647101952138',
        GRANDMASTER: '1370029647126986805',
        CHALLENGER: '1370029647126986809',
        UNRANKED: '1370029646976122896',
    },
    DOUBLE_UP: {
        IRON: '1370029646976122899',
        BRONZE: '1370029647005352019',
        SILVER: '1370029647005352023',
        GOLD: '1370029647034581033',
        PLATINUM: '1370029647034581037',
        EMERALD: '1370029647034581041',
        DIAMOND: '1370029647101952133',
        MASTER: '1370029647101952137',
        GRANDMASTER: '1370029647126986804',
        CHALLENGER: '1370029647126986808',
        UNRANKED: '1370029646976122895',
    },
};

// Objeto para traducir los tiers de inglés a español
export const toSpanish = {
    rank: {
        IRON: 'HIERRO', BRONZE: 'BRONCE', SILVER: 'PLATA',
        GOLD: 'ORO', PLATINUM: 'PLATINO', EMERALD: 'ESMERALDA',
        DIAMOND: 'DIAMANTE', MASTER: 'MAESTRO', GRANDMASTER: 'GRAN MAESTRO',
        CHALLENGER: 'CHALLENGER', UNRANKED: 'UNRANKED',
    }
};

export async function assignRankRoles(
    member: GuildMember,
    currentRanks: { soloQ: string, flex: string, tft: string, doubleUp: string }
) {
    console.log(`[RoleAssigner - assignRankRoles] INICIO para usuario: ${member.user.username} (${member.id})`);
    console.log(`[RoleAssigner - assignRankRoles] Rangos de entrada (API, en inglés): SoloQ: ${currentRanks.soloQ}, Flex: ${currentRanks.flex}, TFT: ${currentRanks.tft}, Double Up: ${currentRanks.doubleUp}`);

    const guild = member.guild;
    if (!guild) {
        console.error('[RoleAssigner - assignRankRoles] ERROR: Guild es null.');
        return [];
    }
    console.log(`[RoleAssigner - assignRankRoles] Guild disponible: ${guild.name} (${guild.id})`);

    // Recalcular dynamicAllRankRoleIds cada vez que se llama a assignRankRoles para asegurar que está actualizado
    const dynamicAllRankRoleIds = new Set<string>();
    Object.values(roleIdMap).forEach(queueRoles => {
        Object.values(queueRoles).forEach(roleId => {
            if (roleId) {
                dynamicAllRankRoleIds.add(roleId);
            }
        });
    });
    console.log(`[RoleAssigner - assignRankRoles] Recalculado dynamicAllRankRoleIds (IDs de roles que gestiona el bot): [${Array.from(dynamicAllRankRoleIds).join(', ')}]`);

    const desiredRoleIds = new Set<string>();
    const assignedRoleNames: string[] = [];

    const getSafeRankRoleId = (queue: 'SOLOQ' | 'FLEX' | 'TFT' | 'DOUBLE_UP', tier: string): string | undefined => {
        const uppercaseTier = tier.toUpperCase();
        const roleId = roleIdMap[queue]?.[uppercaseTier];
        if (!roleId) {
            console.warn(`[RoleAssigner - assignRankRoles] Advertencia: ID de rol no encontrado en roleIdMap para ${queue} - ${tier.toUpperCase()}. Asegúrate de que el tier del juego coincide con el mapeo.`);
        }
        return roleId;
    };

    // Determine desired roles based on current ranks (from API, in ENGLISH)
    const soloQId = getSafeRankRoleId('SOLOQ', currentRanks.soloQ);
    if (soloQId) {
        desiredRoleIds.add(soloQId);
        assignedRoleNames.push(`${toSpanish.rank[currentRanks.soloQ.toUpperCase() as keyof typeof toSpanish.rank] || 'UNRANKED'} (SoloQ)`);
    } else {
        const unrankedSoloQId = roleIdMap.SOLOQ.UNRANKED;
        if (unrankedSoloQId) {
            desiredRoleIds.add(unrankedSoloQId);
            assignedRoleNames.push(`UNRANKED (SoloQ)`);
        }
    }

    const flexId = getSafeRankRoleId('FLEX', currentRanks.flex);
    if (flexId) {
        desiredRoleIds.add(flexId);
        assignedRoleNames.push(`${toSpanish.rank[currentRanks.flex.toUpperCase() as keyof typeof toSpanish.rank] || 'UNRANKED'} (Flex)`);
    } else {
        const unrankedFlexId = roleIdMap.FLEX.UNRANKED;
        if (unrankedFlexId) {
            desiredRoleIds.add(unrankedFlexId);
            assignedRoleNames.push(`UNRANKED (Flex)`);
        }
    }

    const tftId = getSafeRankRoleId('TFT', currentRanks.tft);
    if (tftId) {
        desiredRoleIds.add(tftId);
        assignedRoleNames.push(`${toSpanish.rank[currentRanks.tft.toUpperCase() as keyof typeof toSpanish.rank] || 'UNRANKED'} (TFT)`);
    } else {
        const unrankedTFTId = roleIdMap.TFT.UNRANKED;
        if (unrankedTFTId) {
            desiredRoleIds.add(unrankedTFTId);
            assignedRoleNames.push(`UNRANKED (TFT)`);
        }
    }

    const doubleUpId = getSafeRankRoleId('DOUBLE_UP', currentRanks.doubleUp);
    if (doubleUpId) {
        desiredRoleIds.add(doubleUpId);
        assignedRoleNames.push(`${toSpanish.rank[currentRanks.doubleUp.toUpperCase() as keyof typeof toSpanish.rank] || 'UNRANKED'} (Double Up)`);
    } else {
        const unrankedDoubleUpId = roleIdMap.DOUBLE_UP.UNRANKED;
        if (unrankedDoubleUpId) {
            desiredRoleIds.add(unrankedDoubleUpId);
            assignedRoleNames.push(`UNRANKED (Double Up)`);
        }
    }

    console.log(`[RoleAssigner - assignRankRoles] IDs de roles deseados: [${Array.from(desiredRoleIds).join(', ')}]`);

    // Fetch fresh member to ensure accurate role cache
    let freshMember = await guild.members.fetch(member.id).catch(e => {
        console.error(`[RoleAssigner - assignRankRoles] No se pudo re-obtener GuildMember para ${member.id}:`, e);
        return null;
    });

    if (!freshMember) {
        console.error(`[RoleAssigner - assignRankRoles] Fallo al obtener el miembro fresco. No se pueden gestionar roles.`);
        return [];
    }
    member = freshMember; // Update the 'member' reference
    console.log(`[RoleAssigner - assignRankRoles] GuildMember re-obtenido con éxito.`);

    let currentMemberRoleIds = Array.from(member.roles.cache.keys());
    console.log(`[RoleAssigner - assignRankRoles] Roles actuales del miembro (IDs en caché ANTES DE CAMBIOS): [${currentMemberRoleIds.join(', ')}]`);

    const rolesToRemove: string[] = [];
    const rolesToAdd: string[] = [];

    // 1. Identify roles to remove: existing bot-managed rank roles that are NOT desired
    for (const currentRoleId of currentMemberRoleIds) {
        if (dynamicAllRankRoleIds.has(currentRoleId) && !desiredRoleIds.has(currentRoleId)) {
            rolesToRemove.push(currentRoleId);
        }
    }
    console.log(`[RoleAssigner - assignRankRoles] Roles de rango identificados para remover: [${rolesToRemove.map(id => guild.roles.cache.get(id)?.name || id).join(', ')}]`);

    // 2. Identify roles to add: desired roles that the member does NOT currently have
    for (const desiredRoleId of desiredRoleIds) {
        if (!currentMemberRoleIds.includes(desiredRoleId)) {
            rolesToAdd.push(desiredRoleId);
        }
    }
    console.log(`[RoleAssigner - assignRankRoles] Roles identificados para añadir: [${rolesToAdd.map(id => guild.roles.cache.get(id)?.name || id).join(', ')}]`);

    // Execute removals
    if (rolesToRemove.length > 0) {
        try {
            console.log(`[RoleAssigner - assignRankRoles] Intentando remover ${rolesToRemove.length} roles...`);
            await member.roles.remove(rolesToRemove);
            console.log(`[RoleAssigner - assignRankRoles] Roles removidos con éxito.`);
            // Update cache after removal to reflect changes
            member = await guild.members.fetch(member.id);
            currentMemberRoleIds = Array.from(member.roles.cache.keys());
            console.log(`[RoleAssigner - assignRankRoles] Roles del miembro después de REMOCIÓN y fetch: [${currentMemberRoleIds.join(', ')}]`);
        } catch (error: any) {
            console.error(`[RoleAssigner - assignRankRoles] ERROR CRÍTICO al remover roles para ${member.user.username}:`, error.message || error);
            if (error.code === 50013) {
                console.error(`[RoleAssigner - assignRankRoles] ¡¡¡PERMISOS INSUFICIENTES!!! Asegúrate de que el bot tenga 'Gestionar roles' y que su rol esté por encima de TODOS los roles de rango.`);
            }
            // Continue to add roles even if removal failed, to at least get new ranks assigned.
        }
    } else {
        console.log(`[RoleAssigner - assignRankRoles] No hay roles de rango para remover.`);
    }

    // Execute additions
    if (rolesToAdd.length > 0) {
        try {
            console.log(`[RoleAssigner - assignRankRoles] Intentando añadir ${rolesToAdd.length} roles...`);
            await member.roles.add(rolesToAdd);
            console.log(`[RoleAssigner - assignRankRoles] Roles añadidos con éxito.`);
            // Update cache after addition
            member = await guild.members.fetch(member.id);
            currentMemberRoleIds = Array.from(member.roles.cache.keys());
            console.log(`[RoleAssigner - assignRankRoles] Roles del miembro después de ADICIÓN y fetch: [${currentMemberRoleIds.join(', ')}]`);
        } catch (error: any) {
            console.error(`[RoleAssigner - assignRankRoles] ERROR CRÍTICO al añadir roles para ${member.user.username}:`, error.message || error);
            if (error.code === 50013) {
                console.error(`[RoleAssigner - assignRankRoles] ¡¡¡PERMISOS INSUFICIENTES!!! Asegúrate de que el bot tenga 'Gestionar roles' y que su rol esté por encima de TODOS los roles de rango.`);
            }
        }
    } else {
        console.log(`[RoleAssigner - assignRankRoles] No hay roles de rango para añadir (puede que no haya cambios o ya estén asignados).`);
    }

    console.log(`[RoleAssigner - assignRankRoles] FIN para usuario: ${member.user.username}`);
    return assignedRoleNames;
}