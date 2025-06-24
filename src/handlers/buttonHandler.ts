// src/handlers/buttonHandler.ts
import { Collection, ButtonInteraction } from 'discord.js';

// --- Importa los handlers de tus botones aquí ---
// Cada handler de botón debe ser exportado desde su archivo de comando
// y tener una firma similar a: async (interaction: ButtonInteraction) => Promise<void>

// Ejemplo: Para el botón 'link_account' que abre el modal de vincular
// Importamos showVincularModal desde vincular.ts
import { showVincularModal } from '../commands/vincular';

// Importa los handlers de viewaccounts
import { handleViewAccountsButton, showUnlinkAccountSelector } from '../commands/viewaccounts';

// Importa el handler de refresh (si es un botón que refresca, aunque ya lo tienes como slash command)
import { execute as executeRefresh } from '../commands/refresh';

// Define el tipo de un handler de botón para mayor claridad
interface ButtonHandler {
    execute: (interaction: ButtonInteraction) => Promise<any>;
}

// Crea una Collection para almacenar los handlers de botones
// La clave de la colección debe ser el 'customId' exacto del botón
export const buttons = new Collection<string, ButtonHandler>();

// --- Asigna tus botones a la colección aquí ---

// Botón 'link_account': Abre el modal de vincular
buttons.set('link_account', { execute: showVincularModal });

// Botón 'view_accounts': Muestra las cuentas vinculadas
buttons.set('view_accounts', { execute: handleViewAccountsButton });

// Botón 'unlink_account_prompt': Muestra el selector para desvincular
buttons.set('unlink_account_prompt', { execute: showUnlinkAccountSelector });

// Botón 'refresh_rank': Refresca el rango (reutiliza la lógica de executeRefresh)
// Asegúrate de que executeRefresh pueda manejar ButtonInteraction o haz una envoltura
buttons.set('refresh_rank', { execute: executeRefresh });


// --- Función para manejar todas las interacciones de botones ---
export async function handleButton(interaction: ButtonInteraction) {
    // Primero, verificamos si el customId del botón es uno que debería ser manejado por un colector.
    // Los colectores están escuchando un botón específico después de enviar un mensaje.
    // Por ejemplo, el botón 'confirmarIcono-' en 'vincular.ts' se maneja con un colector.
    if (interaction.customId.startsWith('confirmarIcono-')) {
        console.log(`[BUTTON_HANDLER] Botón '${interaction.customId}' detectado. Será manejado por un colector en su comando. Ignorando.`);
        // No respondemos ni deferimos aquí porque el colector lo hará.
        return;
    }

    // Buscamos el handler para el customId de la interacción
    const handler = buttons.get(interaction.customId);

    if (!handler) {
        console.warn(`[BUTTON_HANDLER] Botón desconocido o sin handler: ${interaction.customId}`);
        // Si el botón no tiene un handler definido, puedes responder al usuario o simplemente ignorarlo.
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Lo siento, no pude procesar este botón.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Lo siento, no pude procesar este botón.', ephemeral: true });
        }
        return;
    }

    try {
        // Ejecutamos la función asociada al botón
        await handler.execute(interaction);
    } catch (error) {
        console.error(`[BUTTON_HANDLER] Error al ejecutar el botón ${interaction.customId}:`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Hubo un error al procesar tu solicitud con este botón.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Hubo un error al procesar tu solicitud con este botón.', ephemeral: true });
        }
    }
}