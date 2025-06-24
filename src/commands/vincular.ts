// src/commands/vincular.ts
import axios from 'axios'; // Mantenemos axios para otras posibles llamadas si fuera necesario
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

// --- CAMBIO CLAVE 1: Importar TeemoJS correctamente ---
var TeemoJS = require('teemojs');

// No es necesario exportar safeReply si solo se usa internamente
async function safeReply(interaction: ChatInputCommandInteraction | ModalSubmitInteraction | any, message: string): Promise<Message | undefined> {
    try {
        if (!interaction.replied && !interaction.deferred) {
            return await interaction.reply({ content: message, ephemeral: true, fetchReply: true }) as Message;
        } else {
            return await interaction.followUp({ content: message, ephemeral: true, fetchReply: true }) as Message;
        }
    } catch (err) {
        console.error('❌ Error enviando respuesta segura:', err);
        return undefined; // Devuelve undefined en caso de error
    }
}

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const MAX_ACCOUNTS = 3;

// --- CAMBIO CLAVE 2: Inicializar TeemoJS una vez globalmente (o en un módulo de API) ---
// Es una buena práctica inicializar TeemoJS una sola vez con tu API Key.
// Puedes hacerlo aquí o, preferiblemente, en un módulo separado de "riotApi.ts"
// y exportar la instancia para usarla en otros comandos.
// Por simplicidad, lo inicializaremos aquí para este ejemplo.
if (!RIOT_API_KEY) {
    console.error('Environment variable RIOT_API_KEY is not set.');
    process.exit(1); // Sale del proceso si la clave no está configurada
}

const riotApiClient = TeemoJS(RIOT_API_KEY); // Ahora TeemoJS es una función

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
    // ... (tu roleIdMap sin cambios) ...
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
};

async function assignRankRoles(member: GuildMember, currentRanks: { soloQ: string, flex: string, tft: string }): Promise<string[]> {
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

    const soloQRankId = roleIdMap.SOLOQ[currentRanks.soloQ.toUpperCase()];
    if (soloQRankId) {
        rolesToAssign.push(soloQRankId);
        assignedRoleNames.push(`${currentRanks.soloQ} (SoloQ)`);
    } else {
        const unrankedSoloQId = roleIdMap.SOLOQ.UNRANKED;
        if (unrankedSoloQId) {
            rolesToAssign.push(unrankedSoloQId);
            assignedRoleNames.push(`UNRANKED (SoloQ)`);
        }
    }

    const flexRankId = roleIdMap.FLEX[currentRanks.flex.toUpperCase()];
    if (flexRankId) {
        rolesToAssign.push(flexRankId);
        assignedRoleNames.push(`${currentRanks.flex} (Flex)`);
    } else {
        const unrankedFlexId = roleIdMap.FLEX.UNRANKED;
        if (unrankedFlexId) {
            rolesToAssign.push(unrankedFlexId);
            assignedRoleNames.push(`UNRANKED (Flex)`);
        }
    }

    const tftRankId = roleIdMap.TFT[currentRanks.tft.toUpperCase()];
    if (tftRankId) {
        rolesToAssign.push(tftRankId);
        assignedRoleNames.push(`${currentRanks.tft} (TFT)`);
    } else {
        const unrankedTFTId = roleIdMap.TFT.UNRANKED;
        if (unrankedTFTId) {
            rolesToAssign.push(unrankedTFTId);
            assignedRoleNames.push(`UNRANKED (TFT)`);
        }
    }

    if (rolesToAssign.length > 0) {
        try {
            await member.roles.add(rolesToAssign);
            console.log(`Roles [${assignedRoleNames.join(', ')}] asignados a ${member.user.username}`);
        } catch (error) {
            console.error(`Error al asignar roles [${rolesToAssign.join(', ')}] a ${member.user.username}:`, error);
        }
    } else {
        console.log(`No se encontraron roles de rango válidos para asignar a ${member.user.username}.`);
    }

    return assignedRoleNames;
}


export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.customId !== 'vincularModal') return;

    const alias = interaction.fields.getTextInputValue('alias');
    const tag = interaction.fields.getTextInputValue('tag');

    console.log(`Alias: ${alias} Tag: ${tag}`);

    let initialReply: Message | undefined;

    try {
        // --- CAMBIO CLAVE 3: Usar TeemoJS para obtener puuid ---
        // El shard 'AMERICAS' es para Riot ID universal. TeemoJS se encarga de las regiones.
        const riotAccount = await riotApiClient.get('AMERICAS', 'account.getByRiotId', alias, tag);
        const puuid = riotAccount?.puuid;

        if (!puuid) {
            await safeReply(interaction, '❌ No se encontró la cuenta con esos datos. Asegúrate de que el Alias y el Tag sean correctos (ej: Faker #EUW).');
            return;
        }

        const discordId = interaction.user.id;
        const userAccounts = getAccountsByDiscordId(discordId);
        const accountAlreadyLinked = userAccounts.some(account => account.puuid === puuid);

        if (accountAlreadyLinked) {
            await safeReply(interaction, `ℹ️ La cuenta de League of Legends con el Riot ID **${alias}#${tag}** ya está vinculada a tu Discord. No se puede vincular dos veces.`);
            return;
        }

        // --- CAMBIO CLAVE 4: Usar TeemoJS para obtener summoner ---
        // Asumiendo EUW como región principal para el summoner para este ejemplo.
        // Puedes parametrizar esto si necesitas soportar múltiples regiones de invocador.
        const summoner = await riotApiClient.get('EUW1', 'summoner.getByPUUID', puuid);
        console.log("PUUID", summoner)

        if (!summoner || !summoner.id) {
            await safeReply(interaction, '❌ No se pudo obtener la información del invocador.');
            return;
        }

        const summonerId = summoner.id;

        const randomIconId = Math.floor(Math.random() * 28) + 1;
        // La URL de DDragon es estática, no necesita TeemoJS
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

        collector.on('collect', async (buttonInteraction: ButtonInteraction) => { // Aqui el tipo ya es ButtonInteraction
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
            let currentSummonerId: string | undefined;

            try {
                // --- CAMBIO CLAVE 5: Usar TeemoJS para verificar el icono actualizado ---
                const updatedSummoner = await riotApiClient.get('EUW1', 'summoner.getByPUUID', puuid);
                currentSummonerId = updatedSummoner?.id;
                updatedIconId = updatedSummoner?.profileIconId;

                if (!currentSummonerId) {
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

            // --- Si la verificación es exitosa: ---
            let rankData: any[] = [];
            let rankFetchError = false;
            try {
                // --- CAMBIO CLAVE 6: Usar TeemoJS para obtener los rangos ---
                // Nota: La región para las ligas es la misma que la del invocador.
                rankData = await riotApiClient.get('EUW1', 'league.getLeagueEntriesByPUUID', puuid);
                console.log("rankdata: ", rankData)
                console.log("rankdatatoString: " + rankData.toString)
            } catch (apiError: any) {
                console.error('Error al obtener los rangos de Riot Games:', apiError.response?.status, apiError.response?.data || apiError.message);
                rankFetchError = true;
            }

            const soloRankEntry = Array.isArray(rankData) ? rankData.find((entry: { queueType: string }) => entry.queueType === 'RANKED_SOLO_5x5') : null;
            const flexRankEntry = Array.isArray(rankData) ? rankData.find((entry: { queueType: string }) => entry.queueType === 'RANKED_FLEX_SR') : null;
            const tftRankEntry = Array.isArray(rankData) ? rankData.find((entry: { queueType: string }) => entry.queueType === 'RANKED_TFT') : null;

            console.log("solorankentry1: ", soloRankEntry)

            // Esto sirve para traducir los rangos, ya que desde la API llegan en inglés.
            const toSpanish = {
                rank: {
                    IRON: 'HIERRO', BRONZE: 'BRONCE', SILVER: 'PLATA',
                    GOLD: 'ORO', PLATINUM: 'PLATINO', EMERALD: 'ESMERALDA',
                    DIAMOND: 'DIAMANTE', MASTER: 'MAESTRO', GRANDMASTER: 'GRAN MAESTRO',
                    CHALLENGER: 'CHALLENGER', UNRANKED: 'UNRANKED',
                }
            };

            if (soloRankEntry) {
                soloRankEntry.tier = toSpanish.rank[soloRankEntry.tier as keyof typeof toSpanish.rank]
                console.log("solorankentry2: ", soloRankEntry)
            }
            

            if (flexRankEntry) {
                flexRankEntry.tier = toSpanish.rank[flexRankEntry.tier as keyof typeof toSpanish.rank]
            }

            if (tftRankEntry) {
                tftRankEntry.tier = toSpanish.rank[tftRankEntry?.tier as keyof typeof toSpanish.rank]
            }

            const currentRanks = {
                soloQ: soloRankEntry?.tier ?? 'UNRANKED',
                flex: flexRankEntry?.tier ?? 'UNRANKED',
                tft: tftRankEntry?.tier ?? 'UNRANKED',
            };

            console.log("currentRankSOLOQ", currentRanks)

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

            console.log("assignedRoleNames", assignedRoleNames)

            await upsertAccount({
                discordId: interaction.user.id,
                puuid,
                summonerName: alias,
                tagLine: tag,
                summonerId: currentSummonerId,
                rankSoloQ: currentRanks.soloQ,
                rankFlex: currentRanks.flex,
                rankTFT: currentRanks.tft,
            });

            let successMessage = `✅ Icono verificado correctamente. Tu cuenta de LoL **${alias}#${tag}** ha sido vinculada.`;
            successMessage += `\nSe han asignado los siguientes roles: **${assignedRoleNames.join(', ')}**.`;
            if (rankFetchError) {
                successMessage += '\n\n⚠️ Hubo un problema al obtener tus rangos de Riot Games. Usa `/refresh` para actualizar más tarde.';
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
                        console.log('Mensaje efímero de verificación de icono eliminado por expiración.');
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
            console.log('El colector de interacciones ha finalizado por razón:', reason);
        });

    } catch (error: any) {
        // En caso de error con TeemoJS, la estructura de error.response NO existe,
        // TeemoJS lanza errores directamente o los contiene en el objeto de error.
        // Adaptamos el manejo de errores.
        console.error('Error al vincular cuenta (TeemoJS):', error.message);
        let errorMessage = '❌ No se pudo vincular la cuenta. Verifica que el alias y el tag sean correctos y que la cuenta exista.';

        // TeemoJS suele lanzar errores con mensajes descriptivos.
        // Si el error contiene "404", es un "Not Found".
        // Si contiene "403", es un "Forbidden" (problema de API Key).
        if (error.message.includes('404')) {
            errorMessage = '❌ La cuenta de Riot ID no fue encontrada. Asegúrate de que el Alias y el Tag sean correctos (Ej: Faker #EUW) y que la cuenta exista.';
        } else if (error.message.includes('403')) {
            errorMessage = '❌ Error de autenticación con la API de Riot Games. Esto suele ser un problema temporal o de configuración del bot. Contacta a un administrador.';
        } else {
            errorMessage = `❌ Hubo un error inesperado con la API de Riot Games. Intenta de nuevo más tarde. (Detalles: ${error.message})`;
        }
        await safeReply(interaction, errorMessage);
    }
}