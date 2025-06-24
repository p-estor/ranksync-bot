// src/commands/refresh.ts
import axios from 'axios';
import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, ButtonInteraction } from 'discord.js';
import { getAccountsByDiscordId, upsertAccount } from '../utils/accountDb';
import type { Account } from '../utils/types';

const RIOT_API_KEY = process.env.RIOT_API_KEY;

export const data = new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Actualiza tus roles de rango de LoL en Discord.');

// --- Mapeo de tiers a IDs de roles de Discord ---
// CAMBIO IMPORTANTE: Permitir que los valores sean `string | undefined`
// Esto es crucial para manejar casos donde un rol no existe o no quieres asignarlo,
// y también para que el compilador no se queje si un 'tier' no tiene un ID explícito.
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
};

// CAMBIO: Definir todos los IDs de roles de rango como un Set para búsquedas rápidas.
const ALL_RANK_ROLE_IDS = new Set<string>();
Object.values(roleIdMap).forEach(queueRoles => {
    Object.values(queueRoles).forEach(roleId => {
        // Solo añadir si el roleId no es undefined (si decidiste no tener roles para ciertos tiers, ej. UNRANKED)
        if (roleId) {
            ALL_RANK_ROLE_IDS.add(roleId);
        }
    });
});

// AÑADIR EXPLICITAMENTE LOS IDs de los roles UNRANKED y Double Up,
// para que el bot siempre los considere para remoción si los tiene el usuario.
ALL_RANK_ROLE_IDS.add('1370029646976122898'); // ID de Unranked (SoloQ)
ALL_RANK_ROLE_IDS.add('1370029646976122897'); // ID de Unranked (Flex)
ALL_RANK_ROLE_IDS.add('1370029646976122896'); // ID de Unranked (TFT)
ALL_RANK_ROLE_IDS.add('1370029646976122895'); // ID de Unranked (Double Up)
ALL_RANK_ROLE_IDS.add('1370029647034581037'); // ID de Platino (Double Up)
ALL_RANK_ROLE_IDS.add('1370029647005352019'); // ID de Bronce (Double Up)
ALL_RANK_ROLE_IDS.add('1370029647101952137'); // ID de Maestro (Double Up)
ALL_RANK_ROLE_IDS.add('1370029647005352023'); // ID de Plata (Double Up)
ALL_RANK_ROLE_IDS.add('1370029646976122899'); // ID de Hierro (Double Up)
ALL_RANK_ROLE_IDS.add('1370029647034581041'); // ID de Esmeralda (Double Up)
ALL_RANK_ROLE_IDS.add('1370029647034581033'); // ID de Oro (Double Up)
ALL_RANK_ROLE_IDS.add('1370029647126986808'); // ID de Challenger (Double Up)
ALL_RANK_ROLE_IDS.add('1370029647126986804'); // ID de Gran Maestro (Double Up)
ALL_RANK_ROLE_IDS.add('1370029647101952133'); // ID de Diamante (Double Up)

// --- Función para asignar o actualizar roles de rango ---
export async function assignRankRoles(member: GuildMember, currentRanks: { soloQ: string, flex: string, tft: string }) {
    console.log(`[DEBUG - REFRESH] --- INICIO assignRankRoles para usuario: ${member.user.username} (${member.id}) ---`);
    console.log(`[DEBUG - REFRESH] Rangos proporcionados: SoloQ: ${currentRanks.soloQ}, Flex: ${currentRanks.flex}, TFT: ${currentRanks.tft}`);

    const guild = member.guild;
    if (!guild) {
        console.error('[DEBUG - REFRESH] ERROR: Guild es null en assignRankRoles.');
        return [];
    }
    console.log(`[DEBUG - REFRESH] Guild disponible: ${guild.name} (${guild.id})`);


    const rolesToRemove: string[] = [];
    const rolesToAssign: string[] = [];
    const assignedRoleNames: string[] = [];

    const desiredRoleIds = new Set<string>();

    const hasAnyActualRank = 
        currentRanks.soloQ.toUpperCase() !== 'UNRANKED' ||
        currentRanks.flex.toUpperCase() !== 'UNRANKED' ||
        currentRanks.tft.toUpperCase() !== 'UNRANKED';

    console.log(`[DEBUG - REFRESH] hasAnyActualRank: ${hasAnyActualRank}`);

    const getSafeRankRoleId = (queue: 'SOLOQ' | 'FLEX' | 'TFT', tier: string): string | undefined => {
        const uppercaseTier = tier.toUpperCase();
        const roleId = roleIdMap[queue]?.[uppercaseTier];
        if (!roleId) {
            console.warn(`[DEBUG - REFRESH] Advertencia: ID de rol no encontrado en roleIdMap para ${queue} - ${tier.toUpperCase()}.`);
        }
        return roleId;
    };

    if (hasAnyActualRank) {
        console.log(`[DEBUG - REFRESH] Hay al menos un rango real (no UNRANKED).`);
        const soloQId = getSafeRankRoleId('SOLOQ', currentRanks.soloQ);
        if (soloQId) {
            desiredRoleIds.add(soloQId);
            assignedRoleNames.push(`${currentRanks.soloQ} (SoloQ)`);
            console.log(`[DEBUG - REFRESH] Añadido a desiredRoleIds: SoloQ ${currentRanks.soloQ} (${soloQId})`);
        }

        const flexId = getSafeRankRoleId('FLEX', currentRanks.flex);
        if (flexId) {
            desiredRoleIds.add(flexId);
            assignedRoleNames.push(`${currentRanks.flex} (Flex)`);
            console.log(`[DEBUG - REFRESH] Añadido a desiredRoleIds: Flex ${currentRanks.flex} (${flexId})`);
        }

        const tftId = getSafeRankRoleId('TFT', currentRanks.tft);
        if (tftId) {
            desiredRoleIds.add(tftId);
            assignedRoleNames.push(`${currentRanks.tft} (TFT)`);
            console.log(`[DEBUG - REFRESH] Añadido a desiredRoleIds: TFT ${currentRanks.tft} (${tftId})`);
        }
    } else {
        console.log(`[DEBUG - REFRESH] Todos los rangos son UNRANKED. Determinando roles deseados.`);
        // LÓGICA PARA ASIGNAR/NO ASIGNAR ROLES UNRANKED
        // **Decide aquí si quieres roles "UNRANKED" específicos o ningún rol de rango:**
        // SI QUIERES ASIGNAR ROLES "UNRANKED" (ej. "Unranked SoloQ", "Unranked Flex"):
        /*const unrankedSoloQId = getSafeRankRoleId('SOLOQ', 'UNRANKED');
        if (unrankedSoloQId) {
            desiredRoleIds.add(unrankedSoloQId);
            assignedRoleNames.push(`UNRANKED (SoloQ)`);
            console.log(`[DEBUG - REFRESH] Añadido a desiredRoleIds: UNRANKED SoloQ (${unrankedSoloQId})`);
        }
        const unrankedFlexId = getSafeRankRoleId('FLEX', 'UNRANKED');
        if (unrankedFlexId) {
            desiredRoleIds.add(unrankedFlexId);
            assignedRoleNames.push(`UNRANKED (Flex)`);
            console.log(`[DEBUG - REFRESH] Añadido a desiredRoleIds: UNRANKED Flex (${unrankedFlexId})`);
        }
        const unrankedTFTId = getSafeRankRoleId('TFT', 'UNRANKED');
        if (unrankedTFTId) {
            desiredRoleIds.add(unrankedTFTId);
            assignedRoleNames.push(`UNRANKED (TFT)`);
            console.log(`[DEBUG - REFRESH] Añadido a desiredRoleIds: UNRANKED TFT (${unrankedTFTId})`);
        }*/
        // SI NO QUIERES NINGÚN ROL DE RANGO (incluido UNRANKED) cuando todas las cuentas están desvinculadas,
        // ENTONCES COMENTA LAS 9 LÍNEAS DE ARRIBA (las que asignan unrankedSoloQId, unrankedFlexId, unrankedTFTId)
        // Y asegurate de que las entradas 'UNRANKED' para cada cola en 'roleIdMap' sean 'undefined' o eliminadas.
        if (desiredRoleIds.size === 0) {
            console.log(`[DEBUG - REFRESH] desiredRoleIds está vacío (no se asignarán roles de rango).`);
        }
    }
    console.log(`[DEBUG - REFRESH] desiredRoleIds final: [${Array.from(desiredRoleIds).join(', ')}]`);


    const freshMember = await guild.members.fetch(member.id).catch(e => {
        console.error(`[DEBUG - REFRESH] No se pudo re-obtener GuildMember para ${member.id}:`, e);
        return null;
    });

    if (!freshMember) {
        console.error(`[DEBUG - REFRESH] Fallo al obtener el miembro fresco. No se pueden gestionar roles.`);
        return [];
    }
    member = freshMember; 
    console.log(`[DEBUG - REFRESH] GuildMember re-obtenido con éxito.`);

    // Loggear todos los roles que el miembro tiene actualmente, mapeados a sus nombres si es posible
    const currentMemberRoleIds = Array.from(member.roles.cache.keys());
    const currentMemberRoleNames = currentMemberRoleIds.map(id => guild.roles.cache.get(id)?.name || `Unknown Role (${id})`);
    console.log(`[DEBUG - REFRESH] Roles actuales del miembro (IDs): [${currentMemberRoleIds.join(', ')}]`);
    console.log(`[DEBUG - REFRESH] Roles actuales del miembro (Nombres): [${currentMemberRoleNames.join(', ')}]`);

    // Loggear todos los roles de rango CONOCIDOS por el bot
    const allKnownRankRoleNames = Array.from(ALL_RANK_ROLE_IDS).map(id => guild.roles.cache.get(id)?.name || `Unknown Role (${id})`);
    console.log(`[DEBUG - REFRESH] Todos los roles de rango CONOCIDOS por el bot (IDs): [${Array.from(ALL_RANK_ROLE_IDS).join(', ')}]`);
    console.log(`[DEBUG - REFRESH] Todos los roles de rango CONOCIDOS por el bot (Nombres): [${allKnownRankRoleNames.join(', ')}]`);


    for (const knownRankRoleId of ALL_RANK_ROLE_IDS) {
        const roleName = guild.roles.cache.get(knownRankRoleId)?.name || `Unknown Role (${knownRankRoleId})`;
        const memberHasRole = member.roles.cache.has(knownRankRoleId);
        const roleIsDesired = desiredRoleIds.has(knownRankRoleId);

        console.log(`[DEBUG - REFRESH] Procesando rol: ${roleName} (ID: ${knownRankRoleId})`);
        console.log(`[DEBUG - REFRESH]   - ¿Miembro tiene este rol?: ${memberHasRole}`);
        console.log(`[DEBUG - REFRESH]   - ¿Rol es deseado?: ${roleIsDesired}`);

        if (memberHasRole) {
            if (!roleIsDesired) {
                rolesToRemove.push(knownRankRoleId);
                console.log(`[DEBUG - REFRESH]     -> Añadido a rolesToRemove.`);
            } else {
                console.log(`[DEBUG - REFRESH]     -> Miembro ya tiene este rol y es deseado. No se hace nada.`);
            }
        } else {
            if (roleIsDesired) {
                rolesToAssign.push(knownRankRoleId);
                console.log(`[DEBUG - REFRESH]     -> Añadido a rolesToAssign.`);
            } else {
                console.log(`[DEBUG - REFRESH]     -> Miembro no tiene este rol y no es deseado. No se hace nada.`);
            }
        }
    }

    console.log(`[DEBUG - REFRESH] Roles a remover: [${rolesToRemove.map(id => guild.roles.cache.get(id)?.name || id).join(', ')}]`);
    console.log(`[DEBUG - REFRESH] Roles a añadir: [${rolesToAssign.map(id => guild.roles.cache.get(id)?.name || id).join(', ')}]`);


    // Paso 3: Realizar las operaciones de añadir y remover
    try {
        if (rolesToRemove.length > 0) {
            console.log(`[DEBUG - REFRESH] Intentando remover roles...`);
            await member.roles.remove(rolesToRemove);
            console.log(`[DEBUG - REFRESH] Roles removidos con éxito.`);
        } else {
            console.log(`[DEBUG - REFRESH] No hay roles de rango para remover.`);
        }

        if (rolesToAssign.length > 0) {
            console.log(`[DEBUG - REFRESH] Intentando añadir roles...`);
            await member.roles.add(rolesToAssign);
            console.log(`[DEBUG - REFRESH] Roles añadidos con éxito.`);
        } else {
            console.log(`[DEBUG - REFRESH] No hay roles de rango para añadir.`);
        }

        console.log(`[DEBUG - REFRESH] Roles actualizados para ${member.user.username}.`);
    } catch (error: any) {
        console.error(`[DEBUG - REFRESH] ERROR CRÍTICO al gestionar roles para ${member.user.username}:`, error.message || error);
        if (error.code === 50013) {
            console.error(`[DEBUG - REFRESH] ¡¡¡PERMISOS INSUFICIENTES!!! Asegúrate de que el bot tenga 'Gestionar roles' y que su rol esté por encima de TODOS los roles de rango.`);
        }
        // Log detallado del error de Discord API si está disponible
        if (error.rawError?.code && error.rawError?.message) {
            console.error(`[DEBUG - REFRESH] Discord API Error Code: ${error.rawError.code}, Message: ${error.rawError.message}`);
        } else if (error.stack) {
            console.error(`[DEBUG - REFRESH] Stack Trace: ${error.stack}`);
        }
        return []; 
    }

    console.log(`[DEBUG - REFRESH] --- FIN assignRankRoles ---`);
    return assignedRoleNames;
}

// ... (El resto de la función execute permanece igual) ...

export async function execute(interaction: ChatInputCommandInteraction | ButtonInteraction) {
    console.log(`[REFRESH] Comando o botón 'refresh' ejecutado por ${interaction.user.tag} (${interaction.user.id}).`);
    await interaction.deferReply({ ephemeral: true });
    console.log(`[REFRESH] Respuesta diferida.`);

    const discordId = interaction.user.id;
    const guild = interaction.guild;

    if (!guild) {
        console.error('[REFRESH] ERROR: Guild no disponible.');
        return interaction.editReply('❌ No se pudo obtener el servidor.');
    }
    console.log(`[REFRESH] Guild encontrado: ${guild.name} (${guild.id})`);

    const accounts = getAccountsByDiscordId(discordId);
    console.log(`[REFRESH] Cuentas obtenidas de DB para ${discordId}: ${accounts?.length || 0} cuenta(s).`);

    if (!accounts || accounts.length === 0) {
        console.warn('[REFRESH] No hay datos de rango guardados para el usuario.');
        return interaction.editReply('❌ No tienes ninguna cuenta de League of Legends vinculada. Usa `/vincular` primero.');
    }

    // Lógica para seleccionar la cuenta a refrescar.
    // Actualmente, se selecciona la última cuenta vinculada.
    // Si tienes varias cuentas vinculadas, podrías implementar lógica aquí
    // para seleccionar la "mejor" cuenta (ej. la de mayor rango) para actualizar los roles.
    let accountToRefresh = accounts[accounts.length - 1];
    
    console.log(`[REFRESH] Usando la cuenta: ${accountToRefresh.summonerName}#${accountToRefresh.tagLine} (PUUID: ${accountToRefresh.puuid})`);


    let rankData: any[] = [];
    let rankFetchError = false;
    let summonerId: string | undefined;

    try {
        if (!RIOT_API_KEY) {
            console.error('[REFRESH] ERROR: RIOT_API_KEY no definida en las variables de entorno.');
            await interaction.editReply('❌ La clave de API de Riot no está configurada. Contacta al administrador del bot.');
            return;
        }

        console.log(`[REFRESH] Realizando petición a Riot para summonerId por PUUID: ${accountToRefresh.puuid}`);
        const summonerResponse = await axios.get(
            `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${accountToRefresh.puuid}`,
            { headers: { 'X-Riot-Token': RIOT_API_KEY } }
        );
        summonerId = summonerResponse.data?.id;
        console.log(`[REFRESH] SummonerId obtenido: ${summonerId}`);

        if (!summonerId) {
            console.error(`[REFRESH] No se pudo obtener summonerId para PUUID: ${accountToRefresh.puuid}`);
            await interaction.editReply(`❌ No se pudo encontrar la información del invocador para la cuenta ${accountToRefresh.summonerName}#${accountToRefresh.tagLine}.`);
            return;
        }

        console.log(`[REFRESH] Realizando petición a Riot para rangos por summonerId: ${summonerId}`);
        const rankResponse = await axios.get(
            `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`,
            { headers: { 'X-Riot-Token': RIOT_API_KEY } }
        );
        rankData = rankResponse.data;
        console.log(`[REFRESH] Datos de rango obtenidos de Riot:`, JSON.stringify(rankData));

    } catch (apiError: any) {
        rankFetchError = true;
        console.error(`[REFRESH] ERROR durante petición a Riot Games:`,
            `Status: ${apiError.response?.status}`,
            `Data: ${JSON.stringify(apiError.response?.data)}`,
            `Message: ${apiError.message}`
        );
        if (apiError.response?.status === 403 || apiError.response?.status === 401) {
            await interaction.editReply('❌ Error de autenticación con la API de Riot. La clave de API es inválida o ha expirado. Contacta al administrador.');
            return;
        }
        if (apiError.response?.status === 404) {
            await interaction.editReply(`❌ No se encontraron datos de rango para ${accountToRefresh.summonerName}#${accountToRefresh.tagLine}. Asegúrate de haber jugado partidas clasificatorias.`);
            return;
        }
        await interaction.editReply('❌ Hubo un error al conectar con la API de Riot Games. Inténtalo de nuevo más tarde.');
        return;
    }

    // Filtrar y obtener los rangos para cada cola. Si no se encuentran, se asume 'UNRANKED'.
    const soloRankEntry = Array.isArray(rankData) ? rankData.find((entry: { queueType: string }) => entry.queueType === 'RANKED_SOLO_5x5') : null;
    const flexRankEntry = Array.isArray(rankData) ? rankData.find((entry: { queueType: string }) => entry.queueType === 'RANKED_FLEX_SR') : null;
    const tftRankEntry = Array.isArray(rankData) ? rankData.find((entry: { queueType: string }) => entry.queueType === 'RANKED_TFT') : null;

    const updatedRanks = {
        soloQ: soloRankEntry?.tier ?? 'UNRANKED',
        flex: flexRankEntry?.tier ?? 'UNRANKED',
        tft: tftRankEntry?.tier ?? 'UNRANKED',
    };
    console.log(`[REFRESH] Rangos parseados:`, updatedRanks);

    console.log(`[REFRESH] Actualizando cuenta en DB con nuevos rangos...`);
    await upsertAccount({
        discordId: accountToRefresh.discordId,
        puuid: accountToRefresh.puuid,
        summonerName: accountToRefresh.summonerName,
        tagLine: accountToRefresh.tagLine,
        // Usamos el nuevo summonerId si se obtuvo, de lo contrario mantenemos el de la DB
        summonerId: summonerId || accountToRefresh.summonerId,
        rankSoloQ: updatedRanks.soloQ,
        rankFlex: updatedRanks.flex,
        rankTFT: updatedRanks.tft,
    });
    console.log(`[REFRESH] Cuenta en DB actualizada.`);

    // Asegurarse de que el miembro esté actualizado antes de pasar a assignRankRoles
    const member = await guild.members.fetch(discordId).catch(e => {
        console.error(`[REFRESH] No se pudo obtener GuildMember para ${discordId} antes de asignar roles:`, e);
        return null;
    });

    if (!member) {
        console.error(`[REFRESH] No se pudo obtener el miembro. No se asignarán roles.`);
        await interaction.editReply('❌ Se actualizó tu cuenta, pero no se pudieron actualizar tus roles de Discord. Asegúrate de que el bot tenga los permisos correctos.');
        return;
    }
    console.log(`[REFRESH] GuildMember obtenido: ${member.user.username}`);

    console.log(`[REFRESH] Llamando a assignRankRoles...`);
    const assignedRoleNames = await assignRankRoles(member, updatedRanks);
    console.log(`[REFRESH] assignRankRoles completado. Roles asignados: ${assignedRoleNames.join(', ')}`);

    let replyMessage = `✅ Roles de rango actualizados para tu cuenta **${accountToRefresh.summonerName}#${accountToRefresh.tagLine}**: **${assignedRoleNames.join(', ')}**.`;
    if (rankFetchError) {
        replyMessage += '\n\n⚠️ Hubo un problema al obtener tus rangos de Riot Games. Los roles se actualizaron con la última información disponible.';
    } else if (accounts.length > 1) {
        replyMessage += `\n\n*(Nota: Si tienes varias cuentas vinculadas, tus roles de Discord reflejarán los rangos de la cuenta actualizada. Actualmente, esta es la última que vinculaste. Considera crear un comando '/cuentas' para gestionarlas.)*`;
    }

    console.log(`[REFRESH] Editando respuesta final: ${replyMessage.substring(0, 100)}...`);
    await interaction.editReply(replyMessage);
    console.log(`[REFRESH] Comando 'refresh' finalizado con éxito.`);
}