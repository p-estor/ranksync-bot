// src/commands/viewaccounts.ts
import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    ButtonInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    RepliableInteraction,
    StringSelectMenuInteraction
} from 'discord.js';
import { getAccountsByDiscordId, deleteAccount } from '../utils/accountDb';
import type { Account } from '../utils/types';
import { assignRankRoles } from '../commands/refresh'; // Importamos assignRankRoles para actualizar roles al desvincular

// Función de respuesta segura
async function safeReply(interaction: RepliableInteraction, message: string, ephemeral: boolean = true) {
    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: message, ephemeral: ephemeral });
        } else {
            await interaction.followUp({ content: message, ephemeral: ephemeral });
        }
    } catch (err) {
        console.error('❌ Error enviando respuesta segura en viewaccounts:', err);
    }
}

// Esta función se llamará cuando se presione el botón 'view_accounts'
export async function handleViewAccountsButton(interaction: ChatInputCommandInteraction | ModalSubmitInteraction | ButtonInteraction) {
    console.log(`[VIEWACCOUNTS] handleViewAccountsButton iniciado por ${interaction.user.tag}`);
    await interaction.deferReply({ ephemeral: true }); // Deferimos la respuesta ya que haremos consultas a la DB

    const discordId = interaction.user.id;
    const userAccounts = getAccountsByDiscordId(discordId); // Obtenemos las cuentas del usuario

    if (!userAccounts || userAccounts.length === 0) {
        // Si no hay cuentas vinculadas
        console.log(`[VIEWACCOUNTS] No hay cuentas vinculadas para ${discordId}.`);
        await interaction.editReply({
            content: '❌ No tienes ninguna cuenta de League of Legends vinculada. Usa el botón "Vincular cuenta" para empezar.',
        });
        return;
    }

    // Construir el embed para mostrar las cuentas
    const embed = new EmbedBuilder()
        .setTitle(`Cuentas Vinculadas`)
        .setColor('Green') // Puedes elegir otro color
        .setDescription('Aquí están las cuentas de League of Legends que tienes vinculadas a tu Discord.');

    // Añadir cada cuenta al embed
    userAccounts.forEach((account: Account, index: number) => {
        embed.addFields(
            {
                name: `Cuenta ${index + 1}: ${account.summonerName}#${account.tagLine}`,
                value: `**SoloQ:** ${account.rankSoloQ}\n**Flex:** ${account.rankFlex}\n**TFT:** ${account.rankTFT}\n**Double Up:** ${account.rankDoubleUp || 'UNRANKED'}\n*(ID de Riot: ${account.summonerName}#${account.tagLine})*`,
                inline: false,
            }
        );
    });

    // Añadir un pie de página con el límite
    embed.setFooter({ text: `Puedes vincular hasta 3 cuentas. (${userAccounts.length}/3)` });

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('unlink_account_prompt') // Un botón que pida al usuario qué cuenta desvincular
                .setLabel('🗑️ Desvincular cuenta')
                .setStyle(ButtonStyle.Danger),
        );

    await interaction.editReply({
        embeds: [embed],
        components: [actionRow], // Incluimos los botones opcionales
    });
    console.log(`[VIEWACCOUNTS] Cuentas mostradas para ${interaction.user.tag}.`);
}

// NUEVA FUNCIÓN: Mostrar el selector de desvinculación (llamada por el botón 'unlink_account_prompt')
export async function showUnlinkAccountSelector(interaction: ButtonInteraction) {
    // Diferir la respuesta, ya que el menú desplegable puede tardar un momento en aparecer.
    await interaction.deferReply({ ephemeral: true });
    console.log(`[VIEWACCOUNTS] showUnlinkAccountSelector iniciado por ${interaction.user.tag}`);

    const discordId = interaction.user.id;
    const userAccounts = getAccountsByDiscordId(discordId);

    if (!userAccounts || userAccounts.length === 0) {
        console.warn(`[VIEWACCOUNTS] No hay cuentas vinculadas para ${discordId} para desvincular.`);
        await interaction.editReply({
            content: '❌ No tienes ninguna cuenta de League of Legends vinculada para desvincular.',
        });
        return;
    }

    // Crear las opciones para el menú desplegable
    const selectOptions = userAccounts.map((account: Account, index: number) =>
        new StringSelectMenuOptionBuilder()
            .setLabel(`${account.summonerName}#${account.tagLine} (SoloQ: ${account.rankSoloQ}, TFT: ${account.rankTFT}, Double Up: ${account.rankDoubleUp || 'UNRANKED'})`)
            .setValue(account.puuid) // El valor real que se enviará cuando el usuario seleccione esta opción
    );

    // Crear el menú desplegable
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_account_to_unlink') // ID único para este selector (usado en bot.ts)
        .setPlaceholder('Elige una cuenta para desvincular...') // Texto que se muestra antes de seleccionar
        .addOptions(selectOptions); // Añadir las opciones creadas

    // Crear una ActionRow para el menú desplegable
    const actionRowSelect = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(selectMenu);

    // Enviar el mensaje con el menú desplegable
    await interaction.editReply({
        content: 'Por favor, selecciona la cuenta que deseas desvincular:',
        components: [actionRowSelect], // Añadimos la fila que contiene el selector
    });
    console.log(`[VIEWACCOUNTS] Selector de desvinculación mostrado para ${interaction.user.tag}.`);
}

// NUEVA FUNCIÓN: Manejar la selección del StringSelectMenu para desvincular
export async function handleUnlinkAccountSelection(interaction: StringSelectMenuInteraction) {
    // deferUpdate() se usa para interacciones de componentes que no necesitan una respuesta nueva,
    // simplemente reconocen la interacción y permiten editar el mensaje original.
    await interaction.deferUpdate();
    console.log(`[VIEWACCOUNTS] handleUnlinkAccountSelection iniciado por ${interaction.user.tag}`);

    const discordId = interaction.user.id;
    // interaction.values es un array con los valores seleccionados. Para un StringSelectMenu con single select, es el primer elemento.
    const puuidToUnlink = interaction.values[0];

    console.log(`[VIEWACCOUNTS] Intento de desvincular cuenta. Discord ID: ${discordId}, PUUID a desvincular: ${puuidToUnlink}`);

    if (!puuidToUnlink) {
        console.warn(`[VIEWACCOUNTS] No se proporcionó PUUID para desvincular.`);
        await interaction.followUp({ content: '❌ No se seleccionó ninguna cuenta para desvincular.', ephemeral: true });
        return;
    }

    const userAccounts = getAccountsByDiscordId(discordId);
    const accountToDelete = userAccounts?.find(acc => acc.puuid === puuidToUnlink);

    if (!accountToDelete) {
        console.warn(`[VIEWACCOUNTS] Cuenta a desvincular no encontrada en DB para PUUID: ${puuidToUnlink}`);
        await interaction.followUp({ content: '❌ La cuenta seleccionada no se encontró en tu lista de vinculadas.', ephemeral: true });
        return;
    }

    // LÓGICA CLAVE: Eliminar la cuenta de la base de datos
    const deletionSuccessful = deleteAccount(discordId, puuidToUnlink);

    if (!deletionSuccessful) {
        console.error(`[VIEWACCOUNTS] Falló la eliminación de la cuenta en la DB para PUUID: ${puuidToUnlink}`);
        await interaction.followUp({ content: '❌ Hubo un error al intentar desvincular la cuenta. Por favor, inténtalo de nuevo.', ephemeral: true });
        return;
    }

    // Lógica para actualizar roles después de desvincular
    const member = interaction.guild?.members.cache.get(discordId) || await interaction.guild?.members.fetch(discordId);

    if (member) {
        const remainingAccounts = getAccountsByDiscordId(discordId); // Vuelve a obtener las cuentas restantes

        if (!remainingAccounts || remainingAccounts.length === 0) {
            // Si no quedan cuentas, remover todos los roles de rango
            console.log(`[VIEWACCOUNTS] No quedan cuentas vinculadas para ${discordId}. Removiendo todos los roles de rango.`);
            // Aquí, pasamos `true` como tercer argumento para indicar que se deben remover todos los roles de rango.
            // Los rangos específicos en el segundo argumento no importan en este caso, pero se mantienen por tipado.
            await assignRankRoles(member, { soloQ: '', flex: '', tft: '', doubleUp: '' }, true);
            await interaction.editReply({
                content: `✅ La cuenta **${accountToDelete.summonerName}#${accountToDelete.tagLine}** ha sido desvinculada. Ya no tienes cuentas vinculadas, se han **removido todos tus roles de rango** relacionados con LoL/TFT.`,
                components: [] // Eliminar el selector después de la acción
            });
        } else {
            // Si quedan cuentas, actualizamos los roles según la "última" cuenta restante
            const accountForRoles = remainingAccounts[remainingAccounts.length - 1];
            console.log(`[VIEWACCOUNTS] Quedan cuentas vinculadas para ${discordId}. Actualizando roles según ${accountForRoles.summonerName}#${accountForRoles.tagLine}.`);
            // Aquí, NO pasamos `true` como tercer argumento, se comportará como una actualización normal.
            await assignRankRoles(member, {
                soloQ: accountForRoles.rankSoloQ,
                flex: accountForRoles.rankFlex,
                tft: accountForRoles.rankTFT,
                doubleUp: accountForRoles.rankDoubleUp || 'UNRANKED'
            });
            await interaction.editReply({
                content: `✅ La cuenta **${accountToDelete.summonerName}#${accountToDelete.tagLine}** ha sido desvinculada. Tus roles han sido actualizados en base a tu cuenta actual: **${accountForRoles.summonerName}#${accountForRoles.tagLine}**.`,
                components: [] // Eliminar el selector después de la acción
            });
        }
    } else {
        console.warn(`[VIEWACCOUNTS] No se pudo encontrar GuildMember para ${discordId} al desvincular cuenta. No se pudieron actualizar los roles.`);
        await interaction.editReply({
            content: `✅ La cuenta **${accountToDelete.summonerName}#${accountToDelete.tagLine}** ha sido desvinculada.`,
            components: [] // Eliminar el selector después de la acción
        });
    }

    console.log(`[VIEWACCOUNTS] Desvinculación de cuenta completada para ${accountToDelete.summonerName}#${accountToDelete.tagLine}.`);
}