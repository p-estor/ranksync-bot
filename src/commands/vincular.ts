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

// showVincularModal puede ser llamado desde el comando slash (ChatInputCommandInteraction)
// o potencialmente desde un botón (ButtonInteraction) si decides añadir uno para reabrir el modal.
// Por ahora, lo mantenemos compatible con la llamada desde el comando.
export async function showVincularModal(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
        .setCustomId('vincularModal')
        .setTitle('Vincular cuenta LoL');

    const aliasInput = new TextInputBuilder()
        .setCustomId('alias')
        .setLabel('Alias (nombre de invocador)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Faker')
        .setRequired(true);

    const tagInput = new TextInputBuilder()
        .setCustomId('tag')
        .setLabel('Tag (1234)')
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
        IRON: '1370029647005352018', BRONZE: '1370029647005352022', SILVER: '1370029647034581032',
        GOLD: '1370029647034581036', PLATINUM: '1370029647034581040', EMERALD: '1370029647101952132',
        DIAMOND: '1370029647101952136', MASTER: '1370029647126986803', GRANDMASTER: '1370029647126986807',
        CHALLENGER: '1370029647126986811', UNRANKED: '1370029646976122898',
    },
    FLEX: {
        IRON: '1370029647005352017', BRONZE: '1370029647005352021', SILVER: '1370029647005352025',
        GOLD: '1370029647034581035', PLATINUM: '1370029647034581039', EMERALD: '1370029647101952131',
        DIAMOND: '1370029647101952135', MASTER: '1370029647101952139', GRANDMASTER: '1370029647126986806',
        CHALLENGER: '1370029647126986810', UNRANKED: '1370029646976122897',
    },
    TFT: {
        IRON: '1370029647005352016', BRONZE: '1370029647005352020', SILVER: '1370029647005352024',
        GOLD: '1370029647034581034', PLATINUM: '1370029647034581038', EMERALD: '1370029647101952130',
        DIAMOND: '1370029647101952134', MASTER: '1370029647101952138', GRANDMASTER: '1370029647126986805',
        CHALLENGER: '1370029647126986809', UNRANKED: '1370029646976122896',
    },
};

async function assignRankRoles(member: GuildMember, currentRanks: { soloQ: string, flex: string, tft: string }): Promise<string[]> {
    // ... (tu función assignRankRoles sin cambios, solo asegúrate de que el tipo de retorno sea Promise<string[]>) ...
    const allRankRoleIds = new Set<string>();
    Object.values(roleIdMap).forEach(queueRoles => {
        Object.values(queueRoles).forEach(roleId => allRankRoleIds.add(roleId));
    });


    //Sería interesante hacer que si no está la caché lo haga por fetch (que no usa la caché)
    for (const roleId of allRankRoleIds) {
        //if (member.roles.cache.has(roleId)) {
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


// Exportamos handleModalSubmit para que modalHandler.ts pueda importarlo.
export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.customId !== 'vincularModal') return;

    const alias = interaction.fields.getTextInputValue('alias');
    const tag = interaction.fields.getTextInputValue('tag');

    console.log(`Alias: ${alias} Tag: ${tag}`);

    let initialReply: Message | undefined;

    try {
        // Paso 1: Obtener puuid
        const puuidResponse = await axios.get(
            `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${alias}/${tag}`,
            { headers: { 'X-Riot-Token': RIOT_API_KEY } }
        );

        const puuid = puuidResponse.data?.puuid;
        if (!puuid) {
            await safeReply(interaction, '❌ No se encontró la cuenta con esos datos. Asegúrate de que el Alias y el Tag sean correctos (ej: Faker #EUW).');
            return;
        }

        // ¡Nueva comprobación! Antes de pedir el icono, verifica si esta cuenta de LoL ya está vinculada por *este* Discord ID
        const discordId = interaction.user.id;
        const userAccounts = getAccountsByDiscordId(discordId);
        const accountAlreadyLinked = userAccounts.some(account => account.puuid === puuid);

        if (accountAlreadyLinked) {
            await safeReply(interaction, `ℹ️ La cuenta de League of Legends con el Riot ID **${alias}#${tag}** ya está vinculada a tu Discord. No se puede vincular dos veces.`);
            return;
        }
        // Fin de la nueva comprobación de duplicados para el mismo usuario.


        // Paso 2: Obtener summoner
        const summonerResponse = await axios.get(
            `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
            { headers: { 'X-Riot-Token': RIOT_API_KEY } }
        );

        const summoner = summonerResponse.data;
        if (!summoner || !summoner.id) {
            await safeReply(interaction, '❌ No se pudo obtener la información del invocador.');
            return;
        }

        const summonerId = summoner.id;

        // Paso 3: Generar icono aleatorio
        const randomIconId = Math.floor(Math.random() * 28) + 1; // Un rango de 1 a 28 para asegurar que los iconos existan
        const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.9.1/img/profileicon/${randomIconId}.png`; // Asegúrate de actualizar la versión del CDN de DDragon

        storeUserData(interaction.user.id, puuid, randomIconId);

        // Paso 4: Enviar embed con imagen y botón
        const embed = new EmbedBuilder()
            .setTitle('Verificación de icono')
            .setDescription('Cambia tu icono de invocador en League of Legends al que ves en la imagen y luego pulsa "Confirmar".\n\n*(Si no tienes el icono, puedes comprarlo por 1 PI en la tienda de LoL)*')
            .setImage(iconUrl)
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

        // Crear filtro y colector
        // Usamos MessageComponentInteraction para el filtro del colector
        const filter = (buttonInteraction: any) => // No cambiar a ButtonInteraction aqui, porque se tipa en Collector
            buttonInteraction.customId === `confirmarIcono-${puuid}-${randomIconId}` &&
            buttonInteraction.user.id === interaction.user.id;

        if (!interaction.channel) {
            console.error('El canal es null, no se puede crear colector.');
            await safeReply(interaction, '❌ El canal no está disponible para iniciar la verificación.');
            return;
        }

        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 5 * 60 * 1000 }); // 5 minutos para confirmar

        collector.on('collect', async (buttonInteraction: any) => { // Aqui el tipo ya es ButtonInteraction
            try {
                await buttonInteraction.deferUpdate(); // Indicar que se actualizará el mensaje original
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
                const summonerRes = await axios.get(
                    `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
                    { headers: { 'X-Riot-Token': RIOT_API_KEY } }
                );
                currentSummonerId = summonerRes.data?.id;
                updatedIconId = summonerRes.data?.profileIconId;

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
                const rankResponse = await axios.get(
                    `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${currentSummonerId}`,
                    { headers: { 'X-Riot-Token': RIOT_API_KEY } }
                );
                rankData = rankResponse.data;
            } catch (apiError: any) {
                console.error('Error al obtener los rangos de Riot Games:', apiError.response?.status, apiError.response?.data || apiError.message);
                rankFetchError = true;
            }

            const soloRankEntry = Array.isArray(rankData) ? rankData.find((entry: { queueType: string }) => entry.queueType === 'RANKED_SOLO_5x5') : null;
            const flexRankEntry = Array.isArray(rankData) ? rankData.find((entry: { queueType: string }) => entry.queueType === 'RANKED_FLEX_SR') : null;
            const tftRankEntry = Array.isArray(rankData) ? rankData.find((entry: { queueType: string }) => entry.queueType === 'RANKED_TFT') : null;

            const currentRanks = {
                soloQ: soloRankEntry?.tier ?? 'UNRANKED',
                flex: flexRankEntry?.tier ?? 'UNRANKED',
                tft: tftRankEntry?.tier ?? 'UNRANKED',
            };

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
            successMessage += `\nSe han asignado los siguientes roles de rango basados en esta cuenta: **${assignedRoleNames.join(', ')}**.`;
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
                        await initialReply.delete(); // Intenta eliminar el mensaje efímero
                        console.log('Mensaje efímero de verificación de icono eliminado por expiración.');
                    } catch (deleteError) {
                        console.error('Error al intentar eliminar el mensaje inicial por expiración:', deleteError);
                        // Fallback: si no se puede eliminar, edita el mensaje para indicar que ha expirado.
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
                    // Si initialReply es undefined, no podemos editar/eliminar. Solo se puede responder con followUp.
                    // Esto es un caso raro si safeReply no devolvió el mensaje.
                    await safeReply(interaction, '⏰ Se acabó el tiempo para confirmar el cambio de icono. Por favor, inténtalo de nuevo si aún deseas vincular tu cuenta.');
                }
            }
            console.log('El colector de interacciones ha finalizado por razón:', reason);
        });

    } catch (error: any) {
        console.error('Error al vincular cuenta:', error.response?.status, error.response?.data || error.message);
        let errorMessage = '❌ No se pudo vincular la cuenta. Verifica que el alias y el tag sean correctos y que la cuenta exista. (Ej: Faker #EUW).';
        if (error.response && error.response.status === 404) {
            errorMessage = '❌ La cuenta de Riot ID no fue encontrada. Asegúrate de que el Alias y el Tag sean correctos (Ej: Faker #EUW) y que la cuenta exista.';
        } else if (error.response && error.response.status === 403) {
            errorMessage = '❌ Error de autenticación con la API de Riot Games. Esto suele ser un problema temporal o de configuración del bot. Contacta a un administrador.';
        } else if (error.response) {
            errorMessage = `❌ Error en la API de Riot Games (${error.response.status}): ${error.response.statusText}. Intenta de nuevo más tarde.`;
        }
        await safeReply(interaction, errorMessage);
    }
}