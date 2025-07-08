// src/commands/refresh.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, ButtonInteraction } from 'discord.js';
import { getAccountsByDiscordId, upsertAccount } from '../utils/accountDb';
import { assignRankRoles } from '../utils/roleAssigner';
import type { Account } from '../utils/types';
import axios from 'axios';
var TeemoJS = require('teemojs');

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const RIOT_API_KEY_TFT = process.env.RIOT_API_KEY_TFT;

const riotApiClient = RIOT_API_KEY ? new TeemoJS(RIOT_API_KEY) : undefined;
const riotApiClientTFT = RIOT_API_KEY_TFT ? new TeemoJS(RIOT_API_KEY_TFT) : undefined;

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

    let userAccounts = getAccountsByDiscordId(discordId);
    console.log(`[REFRESH - execute] Cuentas obtenidas de DB para ${discordId}: ${userAccounts?.length || 0} cuenta(s).`);

    if (!userAccounts || userAccounts.length === 0) {
        console.warn('[REFRESH - execute] No hay datos de rango guardados para el usuario.');
        return interaction.editReply('❌ No tienes ninguna cuenta de League of Legends vinculada. Usa vincular primero.');
    }

    if (!riotApiClient || !riotApiClientTFT) {
        console.error('[REFRESH - execute] ERROR: Claves de API de Riot o clientes TeemoJS no configurados correctamente. Verifica RIOT_API_KEY y RIOT_API_KEY_TFT.');
        await interaction.editReply('❌ Las claves de API de Riot o los clientes TeemoJS no están configurados correctamente. Contacta al administrador del bot.');
        return;
    }

    let allRankFetchErrors: string[] = [];

    // Iterar sobre cada cuenta para actualizar sus rangos individualmente
    for (let i = 0; i < userAccounts.length; i++) {
        let account = userAccounts[i];
        console.log(`[REFRESH - execute] Procesando cuenta ${i + 1}/${userAccounts.length}: ${account.summonerName}#${account.tagLine}`);

        let rankDataLoL: any[] = [];
        let rankDataTFT: any[] = [];

        if (!account.puuidTFT) {
            console.warn(`[REFRESH - execute] puuidTFT no encontrado en la DB para ${account.summonerName}#${account.tagLine}. Intentando obtenerlo de la API de Riot...`);
            try {
                const riotAccountTFT = await riotApiClientTFT.get('AMERICAS', 'account.getByRiotId', account.summonerName, account.tagLine);
                account.puuidTFT = riotAccountTFT?.puuid;
                if (!account.puuidTFT) {
                    console.warn('[REFRESH - execute] No se pudo obtener el PUUID de TFT. Esto puede ser normal si la cuenta no existe en la región o hay un problema con el Riot ID.');
                    allRankFetchErrors.push(`(TFT de ${account.summonerName}#${account.tagLine})`);
                } else {
                    console.log(`[REFRESH - execute] PUUID de TFT obtenida desde la API y actualizada en objeto: ${account.puuidTFT}`);
                }
            } catch (puuidTFTError: any) {
                console.error(`[REFRESH - execute] ERROR al intentar obtener la PUUID de TFT desde la API para ${account.summonerName}#${account.tagLine}: ${puuidTFTError.message}`);
                allRankFetchErrors.push(`(TFT PUUID de ${account.summonerName}#${account.tagLine})`);
            }
        } else {
            console.log(`[REFRESH - execute] Usando PUUID de TFT almacenado en DB: ${account.puuidTFT}`);
        }

        try {
            console.log(`[REFRESH - execute] Realizando petición a Riot para rangos LoL por PUUID: ${account.puuid}`);
            rankDataLoL = await riotApiClient.get('EUW1', 'league.getLeagueEntriesByPUUID', account.puuid);
            console.log(`[REFRESH - execute] Datos de rango LoL obtenidos para ${account.summonerName}#${account.tagLine}: ${rankDataLoL.length > 0 ? rankDataLoL.map((r: any) => `${r.queueType}: ${r.tier}`).join(', ') : 'Ninguno'}`);
        } catch (lolApiError: any) {
            allRankFetchErrors.push(`(LoL de ${account.summonerName}#${account.tagLine})`);
            console.error(`[REFRESH - execute] ERROR al obtener rangos de LoL para ${account.summonerName}#${account.tagLine}: ${lolApiError.message}`);
        }

        if (account.puuidTFT) {
            try {
                console.log(`[REFRESH - execute] Realizando petición a Riot para rangos TFT por PUUID (Axios): ${account.puuidTFT}`);
                const encodedPuuidTFT = encodeURIComponent(account.puuidTFT);
                const tftResponse = await axios.get(
                    `https://euw1.api.riotgames.com/tft/league/v1/by-puuid/${encodedPuuidTFT}`,
                    { headers: { 'X-Riot-Token': RIOT_API_KEY_TFT } }
                );
                rankDataTFT = tftResponse.data;
                console.log(`[REFRESH - execute] Datos de rango TFT obtenidos para ${account.summonerName}#${account.tagLine}: ${rankDataTFT.length > 0 ? rankDataTFT.map((r: any) => `${r.queueType}: ${r.tier}`).join(', ') : 'Ninguno'}`);
            } catch (tftApiError: any) {
                allRankFetchErrors.push(`(TFT de ${account.summonerName}#${account.tagLine})`);
                console.error(`[REFRESH - execute] ERROR al obtener rangos de TFT para ${account.summonerName}#${account.tagLine}: ${tftApiError.message}`);
            }
        } else {
            console.warn(`[REFRESH - execute] No se pudo obtener puuidTFT previamente para ${account.summonerName}#${account.tagLine}, saltando la obtención de rangos de TFT.`);
        }

        const soloRankEntry = Array.isArray(rankDataLoL) ? rankDataLoL.find((entry: { queueType: string }) => entry.queueType === 'RANKED_SOLO_5x5') : null;
        const flexRankEntry = Array.isArray(rankDataLoL) ? rankDataLoL.find((entry: { queueType: string }) => entry.queueType === 'RANKED_FLEX_SR') : null;
        const tftRankEntry = Array.isArray(rankDataTFT) ? rankDataTFT.find((entry: { queueType: string }) => entry.queueType === 'RANKED_TFT') : null;
        const doubleUpRankEntry = Array.isArray(rankDataTFT) ? rankDataTFT.find((entry: { queueType: string }) => entry.queueType === 'RANKED_TFT_DOUBLE_UP') : null;

        account.rankSoloQ = soloRankEntry?.tier ?? 'UNRANKED';
        account.rankFlex = flexRankEntry?.tier ?? 'UNRANKED';
        account.rankTFT = tftRankEntry?.tier ?? 'UNRANKED';
        account.rankDoubleUp = doubleUpRankEntry?.tier ?? 'UNRANKED';

        console.log(`[REFRESH - execute] Actualizando cuenta en DB con nuevos rangos para ${account.summonerName}#${account.tagLine}...`);
        await upsertAccount(account);
        console.log(`[REFRESH - execute] Cuenta en DB actualizada para ${account.summonerName}#${account.tagLine}.`);
    }

    // Obtener las cuentas actualizadas una vez más para asegurar la consistencia.
    const updatedUserAccounts = getAccountsByDiscordId(discordId);

    const member = await guild.members.fetch(discordId).catch(e => {
        console.error(`[REFRESH - execute] No se pudo obtener GuildMember para ${discordId} antes de asignar roles:`, e);
        return null;
    });

    if (!member) {
        console.error(`[REFRESH - execute] No se pudo obtener el miembro. No se asignarán roles.`);
        await interaction.editReply('❌ Se actualizaron tus cuentas, pero no se pudieron actualizar tus roles de Discord. Asegúrate de que el bot tenga los permisos correctos.');
        return;
    }
    console.log(`[REFRESH - execute] GuildMember obtenido: ${member.user.username}`);

    console.log(`[REFRESH - execute] Llamando a assignRankRoles con TODAS las cuentas del usuario...`);
    // ¡PASAMOS EL ARRAY COMPLETO DE CUENTAS!
    const assignedRoleNames = await assignRankRoles(member, updatedUserAccounts);
    console.log(`[REFRESH - execute] assignRankRoles completado. Roles asignados: [${assignedRoleNames.join(', ')}]`);

    let replyMessage = `✅ Roles de rango actualizados para tus cuentas. Tus roles ahora reflejan **todos los rangos válidos** de tus cuentas vinculadas.`;
    if (assignedRoleNames.length > 0) {
        replyMessage += `\n**Roles asignados/actualizados:** ${assignedRoleNames.join(', ')}.`;
    } else {
        replyMessage += `\nActualmente no se han asignado roles de rango basados en tus cuentas vinculadas.`;
    }

    if (allRankFetchErrors.length > 0) {
        replyMessage += `\n\n⚠️ Hubo un problema al obtener la información de rango para algunas de tus cuentas (${allRankFetchErrors.join(', ')}). Los roles se actualizaron con la información disponible. Intenta de nuevo más tarde si no ves los rangos esperados.`;
    }

    console.log(`[REFRESH - execute] Editando respuesta final. Mensaje: "${replyMessage.substring(0, 100)}..."`);
    await interaction.editReply(replyMessage);
    console.log(`[REFRESH - execute] Comando 'refresh' finalizado con éxito.`);
}