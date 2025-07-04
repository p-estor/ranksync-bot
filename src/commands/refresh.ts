// src/commands/refresh.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, ButtonInteraction } from 'discord.js';
import { getAccountsByDiscordId, upsertAccount } from '../utils/accountDb';
import type { Account } from '../utils/types';
import axios from 'axios';
var TeemoJS = require('teemojs');

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const RIOT_API_KEY_TFT = process.env.RIOT_API_KEY_TFT;

const riotApiClient = RIOT_API_KEY ? new TeemoJS(RIOT_API_KEY) : undefined;
const riotApiClientTFT = RIOT_API_KEY_TFT ? new TeemoJS(RIOT_API_KEY_TFT) : undefined;

// --- Mapeo de tiers a IDs de roles de Discord ---
// Las claves aquí (IRON, BRONZE, etc.) DEBEN coincidir con los valores que devuelve la API de Riot.
const roleIdMap: { [key: string]: { [tier: string]: string | undefined } } = {
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
const toSpanish = {
    rank: {
        IRON: 'HIERRO', BRONZE: 'BRONCE', SILVER: 'PLATA',
        GOLD: 'ORO', PLATINUM: 'PLATINO', EMERALD: 'ESMERALDA',
        DIAMOND: 'DIAMANTE', MASTER: 'MAESTRO', GRANDMASTER: 'GRAN MAESTRO',
        CHALLENGER: 'CHALLENGER', UNRANKED: 'UNRANKED',
    }
};

// ALL_RANK_ROLE_IDS se inicializa una vez, pero assignRankRoles usará dynamicAllRankRoleIds
// para asegurar que siempre está al día con roleIdMap.
const ALL_RANK_ROLE_IDS_INITIAL_LOAD = new Set<string>();
Object.values(roleIdMap).forEach(queueRoles => {
    Object.values(queueRoles).forEach(roleId => {
        if (roleId) {
            ALL_RANK_ROLE_IDS_INITIAL_LOAD.add(roleId);
        }
    });
});


// --- Función para asignar o actualizar roles de rango ---
export async function assignRankRoles(
    member: GuildMember,
    currentRanks: { soloQ: string, flex: string, tft: string, doubleUp: string },
    removeAllRanks: boolean = false
) {
    console.log(`[REFRESH - assignRankRoles] INICIO para usuario: ${member.user.username} (${member.id})`);
    console.log(`[REFRESH - assignRankRoles] Rangos de entrada (API, en inglés): SoloQ: ${currentRanks.soloQ}, Flex: ${currentRanks.flex}, TFT: ${currentRanks.tft}, Double Up: ${currentRanks.doubleUp}`);
    console.log(`[REFRESH - assignRankRoles] removeAllRanks flag: ${removeAllRanks}`);

    const guild = member.guild;
    if (!guild) {
        console.error('[REFRESH - assignRankRoles] ERROR: Guild es null.');
        return [];
    }
    console.log(`[REFRESH - assignRankRoles] Guild disponible: ${guild.name} (${guild.id})`);

    // Recalcular dynamicAllRankRoleIds cada vez que se llama a assignRankRoles para asegurar que está actualizado
    const dynamicAllRankRoleIds = new Set<string>();
    Object.values(roleIdMap).forEach(queueRoles => {
        Object.values(queueRoles).forEach(roleId => {
            if (roleId) {
                dynamicAllRankRoleIds.add(roleId);
            }
        });
    });
    console.log(`[REFRESH - assignRankRoles] Recalculado dynamicAllRankRoleIds (IDs de roles que gestiona el bot): [${Array.from(dynamicAllRankRoleIds).join(', ')}]`);

    let rolesToAssign: string[] = []; // Reiniciamos rolesToAssign
    const assignedRoleNames: string[] = [];
    const desiredRoleIds = new Set<string>();

    const getSafeRankRoleId = (queue: 'SOLOQ' | 'FLEX' | 'TFT' | 'DOUBLE_UP', tier: string): string | undefined => {
        const uppercaseTier = tier.toUpperCase();
        const roleId = roleIdMap[queue]?.[uppercaseTier];
        if (!roleId) {
            console.warn(`[REFRESH - assignRankRoles] Advertencia: ID de rol no encontrado en roleIdMap para ${queue} - ${tier.toUpperCase()}. Asegúrate de que el tier del juego coincide con el mapeo.`);
        }
        return roleId;
    };

    if (!removeAllRanks) {
        // Añadir roles deseados basados en los rangos actuales (que vienen en INGLÉS de la API)
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
    }

    console.log(`[REFRESH - assignRankRoles] IDs de roles deseados (final): [${Array.from(desiredRoleIds).join(', ')}]`);

    // Obtener la información más fresca del miembro al inicio de la función
    // para asegurar que las comprobaciones iniciales son precisas.
    let freshMember = await guild.members.fetch(member.id).catch(e => {
        console.error(`[REFRESH - assignRankRoles] No se pudo re-obtener GuildMember para ${member.id}:`, e);
        return null;
    });

    if (!freshMember) {
        console.error(`[REFRESH - assignRankRoles] Fallo al obtener el miembro fresco. No se pueden gestionar roles.`);
        return [];
    }
    // Actualizamos la referencia 'member' con la versión más reciente.
    member = freshMember;
    console.log(`[REFRESH - assignRankRoles] GuildMember re-obtenido con éxito.`);

    let currentMemberRoleIds = Array.from(member.roles.cache.keys());
    console.log(`[REFRESH - assignRankRoles] Roles actuales del miembro (IDs en caché ANTES DE REMOCIÓN): [${currentMemberRoleIds.join(', ')}]`);

    // --- LÓGICA DE ROLES MEJORADA ---
    const rolesToRemove: string[] = [];

    // 1. Identificar todos los roles de rango que el miembro tiene actualmente y que son gestionados por el bot.
    for (const currentRoleId of currentMemberRoleIds) {
        if (dynamicAllRankRoleIds.has(currentRoleId)) {
            rolesToRemove.push(currentRoleId);
        }
    }
    console.log(`[REFRESH - assignRankRoles] Roles de rango identificados para remover: [${rolesToRemove.map(id => guild.roles.cache.get(id)?.name || id).join(', ')}]`);

    // 2. Remover todos los roles de rango identificados.
    try {
        if (rolesToRemove.length > 0) {
            console.log(`[REFRESH - assignRankRoles] Intentando remover ${rolesToRemove.length} roles...`);
            await member.roles.remove(rolesToRemove);
            console.log(`[REFRESH - assignRankRoles] Roles removidos con éxito.`);

            // FORZAR ACTUALIZACIÓN DE LA CACHÉ DESPUÉS DE LA REMOCIÓN
            // Es crucial que 'member' sea la referencia más reciente.
            member = await guild.members.fetch(member.id);
            currentMemberRoleIds = Array.from(member.roles.cache.keys()); // Actualiza también el array de IDs
            console.log(`[REFRESH - assignRankRoles] Roles del miembro después de REMOCIÓN y fetch: [${currentMemberRoleIds.join(', ')}]`);

        } else {
            console.log(`[REFRESH - assignRankRoles] No hay roles de rango relevantes para remover.`);
        }
    } catch (error: any) {
        console.error(`[REFRESH - assignRankRoles] ERROR CRÍTICO al remover roles para ${member.user.username}:`, error.message || error);
        if (error.code === 50013) {
            console.error(`[REFRESH - assignRankRoles] ¡¡¡PERMISOS INSUFICIENTES!!! Asegúrate de que el bot tenga 'Gestionar roles' y que su rol esté por encima de TODOS los roles de rango.`);
        }
        return [];
    }

    // 3. Añadir solo los roles deseados (si `removeAllRanks` es false).
    if (!removeAllRanks) {
        rolesToAssign = []; // Reiniciamos el array para esta operación
        for (const desiredRoleId of desiredRoleIds) {
            // Verificar si el miembro ya NO tiene el rol (después de la remoción y el fetch).
            if (!currentMemberRoleIds.includes(desiredRoleId)) { // Usar el array 'currentMemberRoleIds' actualizado
                rolesToAssign.push(desiredRoleId);
            }
        }
        console.log(`[REFRESH - assignRankRoles] Roles identificados para añadir: [${rolesToAssign.map(id => guild.roles.cache.get(id)?.name || id).join(', ')}]`);

        try {
            if (rolesToAssign.length > 0) {
                console.log(`[REFRESH - assignRankRoles] Intentando añadir ${rolesToAssign.length} roles...`);
                await member.roles.add(rolesToAssign);
                console.log(`[REFRESH - assignRankRoles] Roles añadidos con éxito.`);
                // FORZAR ACTUALIZACIÓN DE LA CACHÉ DESPUÉS DE LA ADICIÓN
                member = await guild.members.fetch(member.id);
                currentMemberRoleIds = Array.from(member.roles.cache.keys()); // Actualiza también el array de IDs
                console.log(`[REFRESH - assignRankRoles] Roles del miembro después de ADICIÓN y fetch: [${currentMemberRoleIds.join(', ')}]`);
            } else {
                console.log(`[REFRESH - assignRankRoles] No hay roles de rango para añadir (puede que no haya cambios o ya estén asignados).`);
            }
        } catch (error: any) {
            console.error(`[REFRESH - assignRankRoles] ERROR CRÍTICO al añadir roles para ${member.user.username}:`, error.message || error);
            if (error.code === 50013) {
                console.error(`[REFRESH - assignRankRoles] ¡¡¡PERMISOS INSUFICIENTES!!! Asegúrate de que el bot tenga 'Gestionar roles' y que su rol esté por encima de TODOS los roles de rango.`);
            }
            return [];
        }
    } else {
        console.log(`[REFRESH - assignRankRoles] removeAllRanks es true, no se añadirán nuevos roles.`);
    }

    console.log(`[REFRESH - assignRankRoles] FIN para usuario: ${member.user.username}`);
    return assignedRoleNames;
}

export const data = new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Actualiza tus roles de rango de LoL/TFT en Discord.');

export async function execute(interaction: ChatInputCommandInteraction | ButtonInteraction) {
    console.log(`[REFRESH - execute] Comando o botón 'refresh' ejecutado por ${interaction.user.tag} (${interaction.user.id}).`);
    await interaction.deferReply({ ephemeral: true });
    console.log(`[REFRESH - execute] Respuesta diferida.`);

    const discordId = interaction.user.id;
    const guild = interaction.guild;

    if (!guild) {
        console.error('[REFRESH - execute] ERROR: Guild no disponible.');
        return interaction.editReply('❌ No se pudo obtener el servidor.');
    }
    console.log(`[REFRESH - execute] Guild encontrado: ${guild.name} (${guild.id})`);

    const accounts = getAccountsByDiscordId(discordId);
    console.log(`[REFRESH - execute] Cuentas obtenidas de DB para ${discordId}: ${accounts?.length || 0} cuenta(s).`);

    if (!accounts || accounts.length === 0) {
        console.warn('[REFRESH - execute] No hay datos de rango guardados para el usuario.');
        return interaction.editReply('❌ No tienes ninguna cuenta de League of Legends vinculada. Usa `/vincular` primero.');
    }

    let accountToRefresh = accounts[accounts.length - 1]; // Siempre toma la última cuenta vinculada

    console.log(`[REFRESH - execute] Procesando cuenta: ${accountToRefresh.summonerName}#${accountToRefresh.tagLine} (PUUID LoL: ${accountToRefresh.puuid}, PUUID TFT: ${accountToRefresh.puuidTFT || 'N/A'})`);

    let rankDataLoL: any[] = [];
    let rankDataTFT: any[] = [];
    let rankFetchError = false;

    if (!riotApiClient || !riotApiClientTFT) {
        console.error('[REFRESH - execute] ERROR: Claves de API de Riot o clientes TeemoJS no configurados correctamente. Verifica RIOT_API_KEY y RIOT_API_KEY_TFT.');
        await interaction.editReply('❌ Las claves de API de Riot o los clientes TeemoJS no están configurados correctamente. Contacta al administrador del bot.');
        return;
    }

    const puuidLoL = accountToRefresh.puuid;
    let puuidTFT = accountToRefresh.puuidTFT;

    // Si por alguna razón puuidTFT no está almacenado (ej. migraciones, o error previo), intentar obtenerlo
    if (!puuidTFT) {
        console.warn(`[REFRESH - execute] puuidTFT no encontrado en la DB para ${accountToRefresh.summonerName}#${accountToRefresh.tagLine}. Intentando obtenerlo de la API de Riot...`);
        try {
            const riotAccountTFT = await riotApiClientTFT.get('AMERICAS', 'account.getByRiotId', accountToRefresh.summonerName, accountToRefresh.tagLine);
            puuidTFT = riotAccountTFT?.puuid;
            if (!puuidTFT) {
                console.warn('[REFRESH - execute] No se pudo obtener el PUUID de TFT. Esto puede ser normal si la cuenta no existe en la región o hay un problema con el Riot ID.');
                rankFetchError = true; // Marca que hubo un error al obtener TFT, aunque sea solo el PUUID
            } else {
                console.log(`[REFRESH - execute] PUUID de TFT obtenida desde la API y actualizada en DB: ${puuidTFT}`);
                await upsertAccount({
                    ...accountToRefresh,
                    puuidTFT: puuidTFT,
                });
            }
        } catch (puuidTFTError: any) {
            console.error(`[REFRESH - execute] ERROR al intentar obtener la PUUID de TFT desde la API:`,
                `Status: ${puuidTFTError.response?.status || 'N/A'}`,
                `Data: ${JSON.stringify(puuidTFTError.response?.data || 'N/A')}`,
                `Message: ${puuidTFTError.message}`
            );
            rankFetchError = true;
        }
    } else {
        console.log(`[REFRESH - execute] Usando PUUID de TFT almacenado en DB: ${puuidTFT}`);
    }

    try {
        console.log(`[REFRESH - execute] Realizando petición a Riot para rangos LoL por PUUID: ${puuidLoL}`);
        rankDataLoL = await riotApiClient.get('EUW1', 'league.getLeagueEntriesByPUUID', puuidLoL);
        console.log("[REFRESH - execute] Datos de rango LoL obtenidos:", rankDataLoL.length > 0 ? rankDataLoL.map((r: any) => `${r.queueType}: ${r.tier}`).join(', ') : 'Ninguno');
    } catch (lolApiError: any) {
        rankFetchError = true;
        console.error(`[REFRESH - execute] ERROR al obtener rangos de LoL:`,
            `Status: ${lolApiError.response?.status || 'N/A'}`,
            `Data: ${JSON.stringify(lolApiError.response?.data || 'N/A')}`,
            `Message: ${lolApiError.message}`
        );
    }

    if (puuidTFT) { // Solo intenta obtener rangos de TFT si tenemos un puuidTFT válido
        try {
            console.log(`[REFRESH - execute] Realizando petición a Riot para rangos TFT por PUUID (Axios): ${puuidTFT}`);
            const encodedPuuidTFT = encodeURIComponent(puuidTFT);
            const tftResponse = await axios.get(
                `https://euw1.api.riotgames.com/tft/league/v1/by-puuid/${encodedPuuidTFT}`,
                { headers: { 'X-Riot-Token': RIOT_API_KEY_TFT } }
            );
            rankDataTFT = tftResponse.data;
            console.log("[REFRESH - execute] Datos de rango TFT obtenidos:", rankDataTFT.length > 0 ? rankDataTFT.map((r: any) => `${r.queueType}: ${r.tier}`).join(', ') : 'Ninguno');
        } catch (tftApiError: any) {
            rankFetchError = true;
            console.error(`[REFRESH - execute] ERROR al obtener rangos de TFT:`,
                `Status: ${tftApiError.response?.status || 'N/A'}`,
                `Data: ${JSON.stringify(tftApiError.response?.data || 'N/A')}`,
                `Message: ${tftApiError.message}`
            );
        }
    } else {
        console.warn(`[REFRESH - execute] No se pudo obtener puuidTFT previamente, saltando la obtención de rangos de TFT.`);
    }

    // Define los entries para cada cola. Asegúrate de que `rankDataLoL` y `rankDataTFT`
    // contengan los datos crudos (en inglés) de la API de Riot.
    const soloRankEntry = Array.isArray(rankDataLoL) ? rankDataLoL.find((entry: { queueType: string }) => entry.queueType === 'RANKED_SOLO_5x5') : null;
    const flexRankEntry = Array.isArray(rankDataLoL) ? rankDataLoL.find((entry: { queueType: string }) => entry.queueType === 'RANKED_FLEX_SR') : null;
    const tftRankEntry = Array.isArray(rankDataTFT) ? rankDataTFT.find((entry: { queueType: string }) => entry.queueType === 'RANKED_TFT') : null;
    const doubleUpRankEntry = Array.isArray(rankDataTFT) ? rankDataTFT.find((entry: { queueType: string }) => entry.queueType === 'RANKED_TFT_DOUBLE_UP') : null;

    // ¡IMPORTANTE! Aquí, `currentRanks` debe almacenar los nombres de los tiers en INGLÉS.
    // NO USES `toSpanish.rank` AQUÍ.
    const currentRanks = {
        soloQ: soloRankEntry?.tier ?? 'UNRANKED', // Debe ser 'GOLD', 'SILVER', etc.
        flex: flexRankEntry?.tier ?? 'UNRANKED',  // Debe ser 'GOLD', 'SILVER', etc.
        tft: tftRankEntry?.tier ?? 'UNRANKED',    // Debe ser 'GOLD', 'SILVER', etc.
        doubleUp: doubleUpRankEntry?.tier ?? 'UNRANKED', // Debe ser 'GOLD', 'SILVER', etc.
    };
    console.log(`[REFRESH - execute] Rangos consolidados (en inglés para roleIdMap):`, currentRanks);


    console.log(`[REFRESH - execute] Actualizando cuenta en DB con nuevos rangos...`);
    await upsertAccount({
        discordId: accountToRefresh.discordId,
        puuid: accountToRefresh.puuid,
        puuidTFT: puuidTFT || accountToRefresh.puuidTFT || '', // Asegurarse de guardar el puuidTFT actualizado o el existente
        summonerName: accountToRefresh.summonerName,
        tagLine: accountToRefresh.tagLine,
        rankSoloQ: currentRanks.soloQ,
        rankFlex: currentRanks.flex,
        rankTFT: currentRanks.tft,
        rankDoubleUp: currentRanks.doubleUp,
    });
    console.log(`[REFRESH - execute] Cuenta en DB actualizada.`);

    const member = await guild.members.fetch(discordId).catch(e => {
        console.error(`[REFRESH - execute] No se pudo obtener GuildMember para ${discordId} antes de asignar roles:`, e);
        return null;
    });

    if (!member) {
        console.error(`[REFRESH - execute] No se pudo obtener el miembro. No se asignarán roles.`);
        await interaction.editReply('❌ Se actualizó tu cuenta, pero no se pudieron actualizar tus roles de Discord. Asegúrate de que el bot tenga los permisos correctos.');
        return;
    }
    console.log(`[REFRESH - execute] GuildMember obtenido: ${member.user.username}`);

    console.log(`[REFRESH - execute] Llamando a assignRankRoles...`);
    // assignRankRoles ahora recibe los rangos en inglés y hace la traducción interna
    const assignedRoleNames = await assignRankRoles(member, currentRanks, false);
    console.log(`[REFRESH - execute] assignRankRoles completado. Roles asignados: [${assignedRoleNames.join(', ')}]`);

    let replyMessage = `✅ Roles de rango actualizados para tu cuenta **${accountToRefresh.summonerName}#${accountToRefresh.tagLine}**: **${assignedRoleNames.join(', ')}**.`;
    if (rankFetchError) {
        replyMessage += '\n\n⚠️ Hubo un problema al obtener todos tus rangos de Riot Games (puede que algunos no se muestren). Los roles se actualizaron con la información disponible. Intenta de nuevo más tarde si no ves los rangos esperados.';
    } else if (accounts.length > 1) {
        replyMessage += `\n\n*(Nota: Si tienes varias cuentas vinculadas, tus roles de Discord reflejarán los rangos de la cuenta actualizada. Actualmente, esta es la última que vinculaste. Considera crear un comando \`/cuentas\` para gestionarlas.)*`;
    }

    console.log(`[REFRESH - execute] Editando respuesta final. Mensaje: "${replyMessage.substring(0, 100)}..."`);
    await interaction.editReply(replyMessage);
    console.log(`[REFRESH - execute] Comando 'refresh' finalizado con éxito.`);

}