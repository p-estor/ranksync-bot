// src/handlers/selectMenuHandler.ts
import { Collection, StringSelectMenuInteraction } from 'discord.js';

// --- Importa los handlers de tus select menus aquí ---
// Cada handler de select menu debe ser exportado desde su archivo de comando
// y tener una firma similar a: async (interaction: StringSelectMenuInteraction) => Promise<void>

// Importa el handler para el select menu de desvincular cuentas
import { handleUnlinkAccountSelection } from '../commands/viewaccounts';

// Define el tipo de un handler de select menu para mayor claridad
interface SelectMenuHandler {
    execute: (interaction: StringSelectMenuInteraction) => Promise<any>;
}

// Crea una Collection para almacenar los handlers de select menus
// La clave de la colección debe ser el 'customId' exacto del select menu
export const selectMenus = new Collection<string, SelectMenuHandler>();

// --- Asigna tus select menus a la colección aquí ---

// Asignar el handler para el select menu de desvincular cuentas
selectMenus.set('select_account_to_unlink', { execute: handleUnlinkAccountSelection });


// --- Función para manejar todas las interacciones de select menus ---
export async function handleSelectMenu(interaction: StringSelectMenuInteraction) {
    // Buscamos el handler para el customId de la interacción
    const handler = selectMenus.get(interaction.customId);

    if (!handler) {
        console.warn(`[SELECT_MENU_HANDLER] Select menu desconocido o sin handler: ${interaction.customId}`);
        // Si el select menu no tiene un handler definido, puedes responder al usuario o simplemente ignorarlo.
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Lo siento, no pude procesar esta selección.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Lo siento, no pude procesar esta selección.', ephemeral: true });
        }
        return;
    }

    try {
        // Ejecutamos la función asociada al select menu
        await handler.execute(interaction);
    } catch (error) {
        console.error(`[SELECT_MENU_HANDLER] Error al ejecutar el select menu ${interaction.customId}:`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Hubo un error al procesar tu selección.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Hubo un error al procesar tu selección.', ephemeral: true });
        }
    }
}