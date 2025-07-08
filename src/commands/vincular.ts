// src/commands/vincular.ts
import axios from 'axios';
import { upsertAccount, getAccountsByDiscordId } from '../utils/accountDb';
import { assignRankRoles } from '../utils/roleAssigner'; 
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

// Creo que puedo borrar ChatInputCommandInteraction 
async function safeReply(interaction: ModalSubmitInteraction | any, message: string): Promise<Message | undefined> {
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

// ... (API Keys y TeemoJS setup) ...
const RIOT_API_KEY = process.env.RIOT_API_KEY;
const RIOT_API_KEY_TFT = process.env.RIOT_API_KEY_TFT;
const MAX_ACCOUNTS = 3;

if (!RIOT_API_KEY) {
    console.error('Environment variable RIOT_API_KEY is not set.');
    process.exit(1);
}
if (!RIOT_API_KEY_TFT) {
    console.error('Environment variable RIOT_API_KEY_TFT is not set.');
    process.exit(1);
}

const riotApiClient = new TeemoJS(RIOT_API_KEY);
const riotApiClientTFT = new TeemoJS(RIOT_API_KEY_TFT);

export const data = new SlashCommandBuilder()
    .setName('vincular')
    .setDescription('Vincula tu cuenta de LoL a Discord.');

// ... (execute y showVincularModal permanecen sin cambios) ...

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

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.customId !== 'vincularModal') return;

    const alias = interaction.fields.getTextInputValue('alias');
    const tag = interaction.fields.getTextInputValue('tag');

    let initialReply: Message | undefined;

    try {
        const riotAccount = await riotApiClient.get('AMERICAS', 'account.getByRiotId', alias, tag);
        const riotAccountTFT = await riotApiClientTFT.get('AMERICAS', 'account.getByRiotId', alias, tag);
        const puuid = riotAccount?.puuid;
        const puuidTFT = riotAccountTFT?.puuid;

        if (!puuid) {
            await safeReply(interaction, '❌ No se encontró la cuenta de League of Legends con esos datos. Asegúrate de que el Alias y el Tag sean correctos (ej: Faker #EUW).');
            return;
        }

        const discordId = interaction.user.id;
        const userAccounts = getAccountsByDiscordId(discordId);
        const accountAlreadyLinked = userAccounts.some(account => account.puuid === puuid || account.puuidTFT === puuidTFT);

        if (accountAlreadyLinked) {
            await safeReply(interaction, `ℹ️ La cuenta de League of Legends con el Riot ID **${alias}#${tag}** ya está vinculada a tu Discord. No se puede vincular dos veces.`);
            return;
        }

        const summoner = await riotApiClient.get('EUW1', 'summoner.getByPUUID', puuid);

        if (!summoner) {
            await safeReply(interaction, '❌ No se pudo obtener la información del invocador.');
            return;
        }

        const randomIconId = Math.floor(Math.random() * 28) + 1;
        const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.9.1/img/profileicon/${randomIconId}.png`;
        const normalizedIconUrl = `https://images.weserv.nl/?url=${encodeURIComponent(iconUrl)}&w=128&h=128&fit=contain`;

        // storeUserData(interaction.user.id, puuid, randomIconId); // Revisa si esto sigue siendo necesario.

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
            console.error('El canal es nulo, no se puede crear el colector.');
            await safeReply(interaction, '❌ El canal no está disponible para iniciar la verificación.');
            return;
        }

        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 5 * 60 * 1000 });

        collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
            try {
                await buttonInteraction.deferUpdate();
            } catch (deferError: any) {
                console.error('Error al aplazar la interacción del botón:', deferError.code || deferError.message);
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

                if (!puuid) {
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
            } catch (lolApiError: any) {
                console.error('Error al obtener los rangos de LoL de Riot Games:', lolApiError.response?.status, lolApiError.response?.data || lolApiError.message);
                rankFetchError = true;
            }

            if (puuidTFT) {
                try {
                    const encodedPuuidTFT = encodeURIComponent(puuidTFT);
                    const tftResponse = await axios.get(
                        `https://euw1.api.riotgames.com/tft/league/v1/by-puuid/${encodedPuuidTFT}`,
                        { headers: { 'X-Riot-Token': RIOT_API_KEY_TFT } }
                    );
                    rankDataTFT = tftResponse.data;
                } catch (tftApiError: any) {
                    console.error('Error al obtener los rangos de TFT de Riot Games:', tftApiError.response?.status, tftApiError.response?.data || tftApiError.message);
                    rankFetchError = true;
                }
            } else {
                console.warn('PUUID para TFT no disponible, se saltará la obtención de rangos de TFT.');
            }

            const soloRankEntry = Array.isArray(rankDataLoL) ? rankDataLoL.find((entry: { queueType: string }) => entry.queueType === 'RANKED_SOLO_5x5') : null;
            const flexRankEntry = Array.isArray(rankDataLoL) ? rankDataLoL.find((entry: { queueType: string }) => entry.queueType === 'RANKED_FLEX_SR') : null;
            const tftRankEntry = Array.isArray(rankDataTFT) ? rankDataTFT.find((entry: { queueType: string }) => entry.queueType === 'RANKED_TFT') : null;
            const doubleUpRankEntry = Array.isArray(rankDataTFT) ? rankDataTFT.find((entry: { queueType: string }) => entry.queueType === 'RANKED_TFT_DOUBLE_UP') : null;

            const newAccountData = {
                discordId: interaction.user.id,
                puuid: puuid,
                puuidTFT: puuidTFT || null,
                summonerName: alias,
                tagLine: tag,
                rankSoloQ: soloRankEntry?.tier ?? 'UNRANKED',
                rankFlex: flexRankEntry?.tier ?? 'UNRANKED',
                rankTFT: tftRankEntry?.tier ?? 'UNRANKED',
                rankDoubleUp: doubleUpRankEntry?.tier ?? 'UNRANKED',
            };

            await upsertAccount(newAccountData); // Guardar la nueva cuenta

            //Obtenemos TODAS las cuentas vinculadas y pasamos el array completo
            const allUserAccounts = getAccountsByDiscordId(discordId);

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

            // Asignar roles con el ARRAY COMPLETO de cuentas
            const assignedRoleNames = await assignRankRoles(member, allUserAccounts);

            let successMessage = `✅ Icono verificado correctamente. Tu cuenta de LoL **${alias}#${tag}** ha sido vinculada.`;
            if (assignedRoleNames.length > 0) {
                successMessage += `\nSe han asignado/actualizado los siguientes roles (basados en todas tus cuentas): **${assignedRoleNames.join(', ')}**.`;
            } else {
                successMessage += `\nActualmente no se asignaron roles de rango.`;
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

        //Paso _ como parámetro porque no se requiere
        collector.on('end', async (_, reason) => {
            if (reason === 'time') {
                if (initialReply) {
                    try {
                        await initialReply.delete();
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
        });

    } catch (error: any) {
        console.error('Error general en vinculación de cuenta:', error);
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