// src/commands/vincular.ts
import axios from 'axios';
import { upsertAccount, getAccountsByDiscordId } from '../utils/accountDb';
import { storeUserData } from '../utils/storage';
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ButtonInteraction,
    EmbedBuilder,
    GuildMember,
    Message,
} from 'discord.js';

var TeemoJS = require('teemojs');

async function safeReply(interaction: ChatInputCommandInteraction | ModalSubmitInteraction | any, message: string): Promise<Message | undefined> {
    try {
        if (!interaction.replied && !interaction.deferred) {
            return await interaction.reply({ content: message, ephemeral: true, fetchReply: true }) as Message;
        } else {
            return await interaction.followUp({ content: message, ephemeral: true, fetchReply: true }) as Message;
        }
    } catch (err) {
        console.error('❌ Error enviando respuesta segura:', err);
        return undefined;
    }
}

const RIOT_API_KEY = process.env.RIOT_API_KEY; // Para la API de LoL (LoL normal, Account, Summoner)
const RIOT_API_KEY_TFT = process.env.RIOT_API_KEY_TFT; // Para la API de TFT (League TFT)
const MAX_ACCOUNTS = 3;

if (!RIOT_API_KEY) {
    console.error('Environment variable RIOT_API_KEY is not set.');
    process.exit(1);
}
if (!RIOT_API_KEY_TFT) {
    console.error('Environment variable RIOT_API_KEY_TFT is not set.');
    process.exit(1);
}

const riotApiClient = new TeemoJS(RIOT_API_KEY); // Instancia para LoL normal
const riotApiClientTFT = new TeemoJS(RIOT_API_KEY_TFT); // Instancia para TFT

// console.log("TFT_KEY:", riotApiClientTFT) // ELIMINADO: Demasiado verbose, solo muestra el objeto TeemoJS

export const data = new SlashCommandBuilder()
    .setName('vincular')
    .setDescription('Vincula tu cuenta de LoL a Discord.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const discordId = interaction.user.id;

    const userAccounts = getAccountsByDiscordId(discordId);

    if (userAccounts.length >= MAX_ACCOUNTS) {
        await safeReply(interaction, `❌ Ya tienes el máximo de **${MAX_ACCOUNTS}** cuentas de League of Legends vinculadas. Si quieres vincular una nueva, primero desvincula una existente.`);
        return;
    }

    await showVincularModal(interaction);
}

export async function showVincularModal(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
        .setCustomId('vincularModal')
        .setTitle('Vincular cuenta LoL');

    const aliasInput = new TextInputBuilder()
        .setCustomId('alias')
        .setLabel('Alias (nombre de invocador)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Hide on bush')
        .setRequired(true);

    const tagInput = new TextInputBuilder()
        .setCustomId('tag')
        .setLabel('Tag sin #')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: EUW')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(aliasInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(tagInput)
    );

    await interaction.showModal(modal);
}

const roleIdMap: { [key: string]: { [tier: string]: string } } = {
    SOLOQ: {
        HIERRO: '1370029647005352018', BRONCE: '1370029647005352022', PLATA: '1370029647034581032',
        ORO: '1370029647034581036', PLATINO: '1370029647034581040', ESMERALDA: '1370029647101952132',
        DIAMANTE: '1370029647101952136', MAESTRO: '1370029647126986803', GRANDMASTER: '1370029647126986807',
        CHALLENGER: '1370029647126986811', UNRANKED: '1370029646976122898',
    },
    FLEX: {
        HIERRO: '1370029647005352017', BRONCE: '1370029647005352021', PLATA: '1370029647005352025',
        ORO: '1370029647034581035', PLATINO: '1370029647034581039', ESMERALDA: '1370029647101952131',
        DIAMANTE: '1370029647101952135', MAESTRO: '1370029647101952139', GRANDMASTER: '1370029647126986806',
        CHALLENGER: '1370029647126986810', UNRANKED: '1370029646976122897',
    },
    TFT: {
        HIERRO: '1370029647005352016', BRONCE: '1370029647005352020', PLATA: '1370029647005352024',
        ORO: '1370029647034581034', PLATINO: '1370029647034581038', ESMERALDA: '1370029647101952130',
        DIAMANTE: '1370029647101952134', MAESTRO: '1370029647101952138', GRANDMASTER: '1370029647126986805',
        CHALLENGER: '1370029647126986809', UNRANKED: '1370029646976122896',
    },
    DOUBLE_UP: {
        HIERRO: '1370029646976122899',
        BRONCE: '1370029647005352019',
        PLATA: '1370029647005352023',
        ORO: '1370029647034581033',
        PLATINO: '1370029647034581037',
        ESMERALDA: '1370029647034581041',
        DIAMANTE: '1370029647101952133',
        MAESTRO: '1370029647101952137',
        GRANDMASTER: '1370029647126986804',
        CHALLENGER: '1370029647126986808',
        UNRANKED: '1370029646976122895',
    },
};

const toSpanish = {
    rank: {
        IRON: 'HIERRO', BRONZE: 'BRONCE', SILVER: 'PLATA',
        GOLD: 'ORO', PLATINUM: 'PLATINO', EMERALD: 'ESMERALDA',
        DIAMOND: 'DIAMANTE', MASTER: 'MAESTRO', GRANDMASTER: 'GRAN MAESTRO',
        CHALLENGER: 'CHALLENGER', UNRANKED: 'UNRANKED',
    }
};

async function assignRankRoles(member: GuildMember, currentRanks: { soloQ: string, flex: string, tft: string, doubleUp: string }): Promise<string[]> {
    const allRankRoleIds = new Set<string>();
    Object.values(roleIdMap).forEach(queueRoles => {
        Object.values(queueRoles).forEach(roleId => allRankRoleIds.add(roleId));
    });

    for (const roleId of allRankRoleIds) {
        if (member.roles.cache.has(roleId)) {
            try {
                await member.roles.remove(roleId);
            } catch (error) {
                console.error(`Error al remover el rol ${roleId} de ${member.user.username}:`, error);
            }
        }
    }

    const rolesToAssign: string[] = [];
    const assignedRoleNames: string[] = [];

    const translatedSoloQRn = (toSpanish.rank[currentRanks.soloQ.toUpperCase() as keyof typeof toSpanish.rank] || 'UNRANKED').toUpperCase();
    const soloQRankId = roleIdMap.SOLOQ[translatedSoloQRn];
    if (soloQRankId) {
        rolesToAssign.push(soloQRankId);
        assignedRoleNames.push(`${translatedSoloQRn} (SoloQ)`);
    } else {
        const unrankedSoloQId = roleIdMap.SOLOQ.UNRANKED;
        if (unrankedSoloQId) {
            rolesToAssign.push(unrankedSoloQId);
            assignedRoleNames.push(`UNRANKED (SoloQ)`);
        }
    }

    const translatedFlexRn = (toSpanish.rank[currentRanks.flex.toUpperCase() as keyof typeof toSpanish.rank] || 'UNRANKED').toUpperCase();
    const flexRankId = roleIdMap.FLEX[translatedFlexRn];
    if (flexRankId) {
        rolesToAssign.push(flexRankId);
        assignedRoleNames.push(`${translatedFlexRn} (Flex)`);
    } else {
        const unrankedFlexId = roleIdMap.FLEX.UNRANKED;
        if (unrankedFlexId) {
            rolesToAssign.push(unrankedFlexId);
            assignedRoleNames.push(`UNRANKED (Flex)`);
        }
    }

    const translatedTFT_Rn = (toSpanish.rank[currentRanks.tft.toUpperCase() as keyof typeof toSpanish.rank] || 'UNRANKED').toUpperCase();
    const tftRankId = roleIdMap.TFT[translatedTFT_Rn];
    if (tftRankId) {
        rolesToAssign.push(tftRankId);
        assignedRoleNames.push(`${translatedTFT_Rn} (TFT)`);
    } else {
        const unrankedTFTId = roleIdMap.TFT.UNRANKED;
        if (unrankedTFTId) {
            rolesToAssign.push(unrankedTFTId);
            assignedRoleNames.push(`UNRANKED (TFT)`);
        }
    }

    const translatedDoubleUpRn = (toSpanish.rank[currentRanks.doubleUp.toUpperCase() as keyof typeof toSpanish.rank] || 'UNRANKED').toUpperCase();
    const doubleUpRankId = roleIdMap.DOUBLE_UP[translatedDoubleUpRn];
    if (doubleUpRankId) {
        rolesToAssign.push(doubleUpRankId);
        assignedRoleNames.push(`${translatedDoubleUpRn} (Double Up)`);
    } else {
        const unrankedDoubleUpId = roleIdMap.DOUBLE_UP.UNRANKED;
        if (unrankedDoubleUpId) {
            rolesToAssign.push(unrankedDoubleUpId);
            assignedRoleNames.push(`UNRANKED (Double Up)`);
        }
    }

    if (rolesToAssign.length > 0) {
        try {
            await member.roles.add(rolesToAssign);
            // console.log(`Roles [${assignedRoleNames.join(', ')}] asignados a ${member.user.username}`); // ELIMINADO: Log menos crítico
        } catch (error) {
            console.error(`Error al asignar roles [${rolesToAssign.join(', ')}] a ${member.user.username}:`, error);
        }
    } else {
        // console.log(`No se encontraron roles de rango válidos para asignar a ${member.user.username}.`); // ELIMINADO: Log menos crítico
    }

    return assignedRoleNames;
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.customId !== 'vincularModal') return;

    const alias = interaction.fields.getTextInputValue('alias');
    const tag = interaction.fields.getTextInputValue('tag');

    // console.log(`Alias: ${alias} Tag: ${tag}`); // ELIMINADO: Se verá en el mensaje de respuesta

    let initialReply: Message | undefined;

    try {
        const riotAccount = await riotApiClient.get('AMERICAS', 'account.getByRiotId', alias, tag);
        const riotAccountTFT = await riotApiClientTFT.get('AMERICAS', 'account.getByRiotId', alias, tag);
        const puuid = riotAccount?.puuid;
        const puuidTFT = riotAccountTFT?.puuid;

        // console.log("PUUID_LOL", riotAccount) // ELIMINADO: Demasiado verbose
        // console.log("PUUID_TFT", riotAccountTFT) // ELIMINADO: Demasiado verbose

        if (!puuid) { // Mantener solo si puuid de LoL no se encuentra
            await safeReply(interaction, '❌ No se encontró la cuenta de League of Legends con esos datos. Asegúrate de que el Alias y el Tag sean correctos (ej: Faker #EUW).');
            return;
        }
        // Si puuidTFT es crítico para la vinculación, se podría añadir una verificación similar:
        // if (!puuidTFT) {
        //     await safeReply(interaction, '❌ No se pudo obtener el PUUID para Teamfight Tactics. Esto podría causar problemas con la actualización de rangos de TFT. Intenta de nuevo.');
        //     return;
        // }


        const discordId = interaction.user.id;
        const userAccounts = getAccountsByDiscordId(discordId);
        // La verificación de duplicados debería considerar si ya existe un PUUID LoL *o* TFT vinculado
        const accountAlreadyLinked = userAccounts.some(account => account.puuid === puuid || account.puuidTFT === puuidTFT);

        if (accountAlreadyLinked) {
            await safeReply(interaction, `ℹ️ La cuenta de League of Legends con el Riot ID **${alias}#${tag}** ya está vinculada a tu Discord. No se puede vincular dos veces.`);
            return;
        }

        const summoner = await riotApiClient.get('EUW1', 'summoner.getByPUUID', puuid);
        // console.log("PUUID", summoner) // ELIMINADO: Demasiado verbose

        if (!summoner) {
            await safeReply(interaction, '❌ No se pudo obtener la información del invocador.');
            return;
        }

        // summonerId no se usa directamente en este flujo después de esta línea, se puede quitar si no tiene otro propósito
        // const summonerId = summoner.id;

        const randomIconId = Math.floor(Math.random() * 28) + 1;
        const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.9.1/img/profileicon/${randomIconId}.png`;
        const normalizedIconUrl = `https://images.weserv.nl/?url=${encodeURIComponent(iconUrl)}&w=128&h=128&fit=contain`;

        storeUserData(interaction.user.id, puuid, randomIconId);

        const embed = new EmbedBuilder()
            .setTitle('Verificación de icono')
            .setDescription('Cambia tu icono de invocador en League of Legends al que ves en la imagen y luego pulsa "Confirmar".')
            .setImage(normalizedIconUrl)
            .setColor('Blue');

        const button = new ButtonBuilder()
            .setCustomId(`confirmarIcono-${puuid}-${randomIconId}`)
            .setLabel('✅ Confirmar')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

        initialReply = await interaction.reply({
            content: `Alias: **${alias}** | Tag: **${tag}**`,
            embeds: [embed],
            components: [row],
            ephemeral: true,
            fetchReply: true,
        }) as Message;

        const filter = (buttonInteraction: any) =>
            buttonInteraction.customId === `confirmarIcono-${puuid}-${randomIconId}` &&
            buttonInteraction.user.id === interaction.user.id;

        if (!interaction.channel) {
            console.error('El canal es null, no se puede crear colector.');
            await safeReply(interaction, '❌ El canal no está disponible para iniciar la verificación.');
            return;
        }

        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 5 * 60 * 1000 });

        collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
            try {
                await buttonInteraction.deferUpdate();
            } catch (deferError: any) {
                console.error('Error al deferUpdate la interacción del botón:', deferError.code || deferError.message);
                if (initialReply) {
                    try {
                        const errorButton = new ButtonBuilder()
                            .setCustomId(`confirmarIcono-error-defer`)
                            .setLabel('❌ Error (intenta de nuevo)')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true);
                        const errorRow = new ActionRowBuilder<ButtonBuilder>().addComponents(errorButton);
                        await initialReply.edit({ content: '❌ Hubo un error al procesar tu clic. Intenta de nuevo.', components: [errorRow], embeds: [] });
                    } catch (editErr) {
                        console.error('Error al editar initialReply en fallo de deferUpdate fallback:', editErr);
                    }
                }
                collector.stop();
                return;
            }

            let updatedIconId: number | undefined;

            try {
                const updatedSummoner = await riotApiClient.get('EUW1', 'summoner.getByPUUID', puuid);
                updatedIconId = updatedSummoner?.profileIconId;

                // console.log("updatedSummoner: ", updatedSummoner) // ELIMINADO: Demasiado verbose

                if (!puuid) { // Este check es redundante aquí si ya se verificó al principio y si updatedSummoner se obtuvo correctamente
                    await buttonInteraction.editReply({
                        content: '❌ No se pudo encontrar la información del invocador con el PUUID guardado. Intenta vincular de nuevo.',
                        embeds: [],
                        components: []
                    });
                    collector.stop();
                    return;
                }

            } catch (apiError: any) {
                console.error('Error al obtener el invocador actualizado de Riot Games (en colector):', apiError.response?.status, apiError.response?.data || apiError.message);
                await buttonInteraction.editReply({
                    content: '❌ Hubo un problema al intentar verificar tu icono en Riot Games. Intenta de nuevo. (Error de Riot API).',
                    embeds: [],
                    components: []
                });
                collector.stop();
                return;
            }

            if (updatedIconId !== randomIconId) {
                await buttonInteraction.editReply({
                    content: '❌ ¡Icono incorrecto! Asegúrate de haber cambiado tu icono de invocador en League of Legends al que se te mostró.',
                    embeds: [embed],
                    components: [row]
                });
                return;
            }

            let rankDataLoL: any[] = [];
            let rankDataTFT: any[] = [];
            let rankFetchError = false;

            try {
                rankDataLoL = await riotApiClient.get('EUW1', 'league.getLeagueEntriesByPUUID', puuid);
                // console.log("LoL Rank Data (TeemoJS): ", rankDataLoL); // ELIMINADO: Demasiado verbose
            } catch (lolApiError: any) {
                console.error('Error al obtener los rangos de LoL de Riot Games:', lolApiError.response?.status, lolApiError.response?.data || lolApiError.message);
                rankFetchError = true;
            }

            // **IMPORTANTE**: Aquí se hace la petición de TFT. ¡Asegúrate de que puuidTFT esté disponible aquí!
            // Si riotAccountTFT?.puuid fue undefined al inicio del handleModalSubmit, puuidTFT será undefined aquí.
            // Considera cómo manejar eso. Si puuidTFT es nulo, esta llamada fallará de todas formas.
            if (puuidTFT) { // Solo si tenemos un puuidTFT para intentar obtener rangos de TFT
                try {
                    const encodedPuuidTFT = encodeURIComponent(puuidTFT); // Aplica el encodeURIComponent aquí también
                    const tftResponse = await axios.get(
                        `https://euw1.api.riotgames.com/tft/league/v1/by-puuid/${encodedPuuidTFT}`, // URL corregida y encodeado
                        { headers: { 'X-Riot-Token': RIOT_API_KEY_TFT } }
                    );
                    rankDataTFT = tftResponse.data;
                    // console.log("TFT Rank Data (Axios): ", rankDataTFT); // ELIMINADO: Demasiado verbose
                } catch (tftApiError: any) {
                    console.error('Error al obtener los rangos de TFT de Riot Games:', tftApiError.response?.status, tftApiError.response?.data || tftApiError.message);
                    rankFetchError = true;
                }
            } else {
                console.warn('PUUID para TFT no disponible, se saltará la obtención de rangos de TFT.'); // Advertencia útil
            }

            const soloRankEntry = Array.isArray(rankDataLoL) ? rankDataLoL.find((entry: { queueType: string }) => entry.queueType === 'RANKED_SOLO_5x5') : null;
            const flexRankEntry = Array.isArray(rankDataLoL) ? rankDataLoL.find((entry: { queueType: string }) => entry.queueType === 'RANKED_FLEX_SR') : null;
            const tftRankEntry = Array.isArray(rankDataTFT) ? rankDataTFT.find((entry: { queueType: string }) => entry.queueType === 'RANKED_TFT') : null;
            const doubleUpRankEntry = Array.isArray(rankDataTFT) ? rankDataTFT.find((entry: { queueType: string }) => entry.queueType === 'RANKED_TFT_DOUBLE_UP') : null;

            // console.log("solorankentry1: ", soloRankEntry) // ELIMINADO: Demasiado verbose
            
            const currentRanks = {
                soloQ: soloRankEntry?.tier ?? 'UNRANKED',
                flex: flexRankEntry?.tier ?? 'UNRANKED',
                tft: tftRankEntry?.tier ?? 'UNRANKED',
                doubleUp: doubleUpRankEntry?.tier ?? 'UNRANKED', 
            };

            // console.log("currentRankSOLOQ", currentRanks) // ELIMINADO: Demasiado verbose

            const guild = interaction.guild;
            if (!guild) {
                await buttonInteraction.editReply({
                    content: '❌ No se pudo obtener el servidor para asignar roles. La vinculación no se completó.',
                    embeds: [],
                    components: []
                });
                collector.stop();
                return;
            }
            const member = await guild.members.fetch(interaction.user.id);

            const assignedRoleNames = await assignRankRoles(member, currentRanks);

            // console.log("assignedRoleNames", assignedRoleNames) // ELIMINADO: Menos crítico, se puede inferir del mensaje final

            await upsertAccount({
                discordId: interaction.user.id,
                puuid: puuid,
                puuidTFT: puuidTFT, // **IMPORTANTE**: Asegúrate de que esto siempre sea puuidTFT
                summonerName: alias,
                tagLine: tag,
                rankSoloQ: currentRanks.soloQ,
                rankFlex: currentRanks.flex,
                rankTFT: currentRanks.tft,
                rankDoubleUp: currentRanks.doubleUp, 
            });

            let successMessage = `✅ Icono verificado correctamente. Tu cuenta de LoL **${alias}#${tag}** ha sido vinculada.`;
            if (assignedRoleNames.length > 0) {
                successMessage += `\nSe han asignado los siguientes roles: **${assignedRoleNames.join(', ')}**.`;
            } else {
                successMessage += `\nNo se asignaron roles de rango.`;
            }
            
            if (rankFetchError) {
                successMessage += '\n\n⚠️ Hubo un problema al obtener tus rangos de Riot Games (puede que algunos no se muestren). Usa `/refresh` para actualizar más tarde.';
            }

            await buttonInteraction.editReply({
                content: successMessage,
                embeds: [],
                components: []
            });

            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                if (initialReply) {
                    try {
                        await initialReply.delete();
                        // console.log('Mensaje efímero de verificación de icono eliminado por expiración.'); // ELIMINADO: Menos crítico
                    } catch (deleteError) {
                        console.error('Error al intentar eliminar el mensaje inicial por expiración:', deleteError);
                        try {
                            const expiredButton = new ButtonBuilder()
                                .setCustomId(`confirmarIcono-expired`)
                                .setLabel('❌ Tiempo Expirado')
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true);

                            const expiredRow = new ActionRowBuilder<ButtonBuilder>().addComponents(expiredButton);

                            await initialReply.edit({
                                content: `⏰ **El tiempo para verificar el icono ha expirado para ${alias || 'tu cuenta'}.**\nSi deseas vincular tu cuenta, usa \`/vincular\` de nuevo.`,
                                embeds: [],
                                components: [expiredRow]
                            });
                        } catch (editError) {
                            console.error('Error al intentar editar el mensaje inicial por expiración (fallback):', editError);
                        }
                    }
                } else {
                    await safeReply(interaction, '⏰ Se acabó el tiempo para confirmar el cambio de icono. Por favor, inténtalo de nuevo si aún deseas vincular tu cuenta.');
                }
            }
            // console.log('El colector de interacciones ha finalizado por razón:', reason); // ELIMINADO: Menos crítico
        });

    } catch (error: any) {
        console.error('Error general en vinculación de cuenta:', error); // Deja este log más general para errores inesperados
        let errorMessage = '❌ No se pudo vincular la cuenta. Verifica que el alias y el tag sean correctos y que la cuenta exista.';

        if (error.message.includes('404')) {
            errorMessage = '❌ La cuenta de Riot ID no fue encontrada. Asegúrate de que el Alias y el Tag sean correctos (Ej: Faker #EUW) y que la cuenta exista.';
        } else if (error.message.includes('403')) {
            errorMessage = '❌ Error de autenticación con la API de Riot Games. Esto suele ser un problema temporal o de configuración del bot. Contacta a un administrador. Asegúrate de que RIOT_API_KEY y RIOT_API_KEY_TFT estén configuradas correctamente.';
        } else if (error.message.includes('LIMIT_EXCEEDED')) {
            errorMessage = `❌ Ya tienes el máximo de **${MAX_ACCOUNTS}** cuentas de League of Legends vinculadas. Si quieres vincular una nueva, primero desvincula una existente.`;
        } else {
            errorMessage = `❌ Hubo un error inesperado. Intenta de nuevo más tarde. (Detalles: ${error.message})`;
        }
        await safeReply(interaction, errorMessage);
    }
}