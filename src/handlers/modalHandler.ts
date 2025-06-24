// src/handlers/modalHandler.ts
import { Collection, ModalSubmitInteraction } from 'discord.js';

// Importa los handlers de modales de tus comandos
import { handleModalSubmit as handleVincularModal } from '../commands/vincular'; // Importa el handler del modal de vincular
// Si tuvieras otro comando con un modal, lo importarías aquí:
// import { handleModalSubmit as handleOtroModal } from '../commands/otrocomando';

// Define el tipo de un handler de modal
interface ModalHandler {
    execute: (interaction: ModalSubmitInteraction) => Promise<any>;
}

// Crea una Collection para almacenar los handlers de modales
export const modals = new Collection<string, ModalHandler>();

// Añade cada handler de modal a la Collection
// La clave debe ser el customId del modal
modals.set('vincularModal', { execute: handleVincularModal });
// modals.set('otroModalCustomId', { execute: handleOtroModal }); // Ejemplo de otro modal

// Exporta la función para manejar la interacción de un modal
export async function handleModal(interaction: ModalSubmitInteraction) {
    const handler = modals.get(interaction.customId);

    if (!handler) {
        console.warn(`[MODAL_HANDLER] Modal desconocido o sin handler: ${interaction.customId}`);
        // Considera enviar una respuesta de error al usuario si esto ocurre
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Lo siento, no pude procesar este formulario.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Lo siento, no pude procesar este formulario.', ephemeral: true });
        }
        return;
    }

    try {
        await handler.execute(interaction);
    } catch (error) {
        console.error(`[MODAL_HANDLER] Error al ejecutar el modal ${interaction.customId}:`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Hubo un error al procesar tu formulario.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Hubo un error al procesar tu formulario.', ephemeral: true });
        }
    }
}