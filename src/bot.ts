// src/bot.ts
import { Client, GatewayIntentBits, REST, Routes, Interaction } from 'discord.js';
import 'dotenv/config';

// Importamos los manejadores centrales de interacciones
// Estos archivos serán responsables de 'rutear' y ejecutar la lógica de cada tipo de interacción.
import { handleCommand, getCommandDataForRegistration } from './handlers/commandHandler';
import { handleButton } from './handlers/buttonHandler';
import { handleModal } from './handlers/modalHandler';
import { handleSelectMenu } from './handlers/selectMenuHandler'; // Asumimos que también manejarás select menus

// Creamos la instancia del cliente de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // Necesario para operar en servidores (guilds)
        GatewayIntentBits.GuildMessages,    // Necesario para recibir eventos de mensajes en guilds
        GatewayIntentBits.MessageContent    // Necesario para leer el contenido de los mensajes (si tu bot usa prefijos o escanea mensajes)
                                            // ¡OJO! Si tu bot es solo de slash commands, puedes quitar MessageContent.
    ]
});

// Creamos la instancia REST para interactuar con la API de Discord (para registrar comandos)
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

// Obtenemos los datos de los comandos slash a registrar desde commandHandler.ts
// Así, commandHandler.ts es el único lugar donde necesitas definir tus comandos.
const commandsToRegister = getCommandDataForRegistration();

// Este evento se dispara una vez cuando el bot se conecta exitosamente a Discord.
client.once('ready', async () => {
    try {
        console.log('✅ Bot iniciado como ' + client.user?.tag);
        console.log('Eliminando comandos globales...');

        // 1) Borramos todos los comandos globales para evitar duplicados o comandos antiguos.
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID!),
            { body: [] }
        );

        console.log('🔄 Registrando comandos en el servidor de pruebas...');

        // 2) Registramos los comandos solo en el servidor de pruebas (Guild ID)
        // Esto es ideal para desarrollo, para no "inundar" todos los servidores.
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID!,
                process.env.GUILD_ID!
            ),
            { body: commandsToRegister }
        );

        console.log('✅ Comandos registrados correctamente en el servidor de pruebas');
    } catch (error) {
        console.error('❌ Error al (re)registrar los comandos:', error);
    }
});

// --- Manejo Centralizado de Todas las Interacciones ---
// Este es el corazón de cómo el bot procesa cada acción de un usuario (comando, botón, modal, etc.).
client.on('interactionCreate', async (interaction: Interaction) => {
    try {
        // Verificamos el tipo de interacción y la delegamos a su manejador específico.

        // Si es un comando de chat (slash command como /vincular, /ping)
        if (interaction.isChatInputCommand()) {
            await handleCommand(interaction);
            return; // Importante: Salir después de manejar la interacción
        }

        // Si es un envío de formulario (modal submit como el de 'vincularModal')
        if (interaction.isModalSubmit()) {
            await handleModal(interaction);
            return;
        }

        // Si es un clic de botón
        if (interaction.isButton()) {
            await handleButton(interaction);
            return;
        }

        // Si es una selección en un menú desplegable (select menu)
        if (interaction.isStringSelectMenu()) { // O interaction.isAnySelectMenu() para ser más general con otros tipos
            await handleSelectMenu(interaction);
            return;
        }

        // Aquí puedes añadir otros tipos de interacciones si los implementas en el futuro,
        // por ejemplo: interaction.isUserContextMenuCommand(), interaction.isMessageContextMenuCommand()

    } catch (error) {
        // Capturamos cualquier error que ocurra durante el manejo de *cualquier* interacción.
        console.error('❌ Error general al manejar una interacción:', error);

        // Intentamos responder al usuario si la interacción es respondible y no ha sido respondida o aplazada.
        if (interaction.isRepliable()) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Ocurrió un error inesperado al procesar tu solicitud.', ephemeral: true });
            } else {
                await interaction.followUp({ content: 'Ocurrió un error inesperado al procesar tu solicitud.', ephemeral: true });
            }
        }
    }
});

// Iniciamos sesión del bot en Discord con el token de tu .env
client.login(process.env.DISCORD_TOKEN);