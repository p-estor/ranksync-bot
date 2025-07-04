// src/handlers/commandHandler.ts
import { Collection, CommandInteraction, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder, ChatInputCommandInteraction } from 'discord.js';

// Importa los datos (que son la instancia de SlashCommandBuilder) y la función execute *específica para slash commands*
//import { data as vincularCommandData, execute as executeVincular } from '../commands/vincular';
//import { data as refreshCommandData, execute as executeRefreshSlash } from '../commands/refresh';
import { data as setupVincularCommandData, execute as executeSetupVincular } from '../commands/setup-vincular';
//import { data as gifModalCommandData, execute as executeGifModal } from '../commands/gif-modal';
//import { data as listarRolesCommandData, execute as executeListarRoles } from '../commands/listar-roles';

// Define el tipo de un comando para mayor claridad
interface Command {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
    // **** CAMBIO CLAVE AQUÍ ****
    // La función 'execute' de los comandos slash siempre recibirá una ChatInputCommandInteraction.
    // Esto resuelve la incompatibilidad de tipos con las funciones 'execute' importadas.
    execute: (interaction: ChatInputCommandInteraction) => Promise<void | any>; // Puede ser Promise<void> o Promise<any>
}

// Crea una Collection para almacenar los comandos
export const commands = new Collection<string, Command>();

// Añade cada comando a la Collection
//commands.set(vincularCommandData.name, { data: vincularCommandData, execute: executeVincular });
//commands.set(refreshCommandData.name, { data: refreshCommandData, execute: executeRefreshSlash });
commands.set(setupVincularCommandData.name, { data: setupVincularCommandData, execute: executeSetupVincular });
//commands.set(gifModalCommandData.name, { data: gifModalCommandData, execute: executeGifModal });
//commands.set(listarRolesCommandData.name, { data: listarRolesCommandData, execute: executeListarRoles });

// Exporta una función para obtener todos los datos de los comandos (para el registro)
export function getCommandDataForRegistration() {
    return Array.from(commands.values()).map(command => command.data.toJSON());
}

// Exporta la función para manejar la interacción de un comando slash
export async function handleCommand(interaction: CommandInteraction) {
    // Es crucial asegurar que la interacción sea de tipo ChatInputCommandInteraction antes de pasarla
    // a la función execute del comando. El bot.ts ya debería filtrar esto, pero es una buena práctica.
    if (!interaction.isChatInputCommand()) {
        console.warn(`[COMMAND_HANDLER] Se recibió una interacción que no es un comando de chat slash (${interaction.commandType}). Saltando.`);
        // Dependiendo de tu lógica, podrías querer responder con un error aquí si esto ocurre inesperadamente.
        return;
    }

    const command = commands.get(interaction.commandName);

    if (!command) {
        console.warn(`[COMMAND_HANDLER] Comando desconocido: ${interaction.commandName}`);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Lo siento, no pude procesar este comando.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Lo siento, no pude procesar este comando.', ephemeral: true });
        }
        return;
    }

    try {
        // Ahora, 'command.execute' espera y recibe explícitamente una ChatInputCommandInteraction.
        await command.execute(interaction);
    } catch (error) {
        console.error(`[COMMAND_HANDLER] Error al ejecutar el comando ${interaction.commandName}:`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
        }
    }
}