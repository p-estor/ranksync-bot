// src/bot.ts
import { Client, GatewayIntentBits, REST, Routes, Interaction } from 'discord.js';
import 'dotenv/config';

// --- NUEVA IMPORTACIÓN ---
import { runMigrations } from './utils/migrations'; // Asegúrate de que la ruta sea correcta
// --- FIN NUEVA IMPORTACIÓN ---

// Importamos los manejadores centrales de interacciones
import { handleCommand, getCommandDataForRegistration } from './handlers/commandHandler';
import { handleButton } from './handlers/buttonHandler';
import { handleModal } from './handlers/modalHandler';
import { handleSelectMenu } from './handlers/selectMenuHandler';

// Creamos la instancia del cliente de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Creamos la instancia REST para interactuar con la API de Discord (para registrar comandos)
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

// Obtenemos los datos de los comandos slash a registrar
const commandsToRegister = getCommandDataForRegistration();

// --- Bloque de inicialización asíncrona ---
// Esta es la parte más importante para la ejecución de migraciones y el inicio del bot.
(async () => {
    try {
        console.log('Iniciando el bot...');

        // Paso 1: Ejecutar las migraciones de la base de datos
        // Hacemos esto ANTES de iniciar sesión en Discord para asegurar que la DB esté lista.
        console.log('Iniciando migraciones de base de datos...');
        await runMigrations(); // <--- ¡Aquí se llama a la función de migración!
        console.log('✅ Migraciones de base de datos completadas.');

        // Paso 2: Iniciar sesión del bot en Discord
        const discordToken = process.env.DISCORD_TOKEN;
        if (!discordToken) {
            throw new Error('El token de Discord (DISCORD_TOKEN) no está definido en las variables de entorno.');
        }
        await client.login(discordToken);
        console.log(`🤖 Bot iniciado y conectado a Discord como ${client.user?.tag}!`);

        // Paso 3: Registro de comandos (puede ir después de login o en el evento 'ready')
        // Aquí lo dejamos en el evento 'ready' como lo tenías, pero es una alternativa válida
        // hacerlo justo después del client.login si no necesitas el objeto client.user para registrar.
        // Lo importante es que las migraciones se ejecuten primero.

    } catch (error) {
        console.error('❌ Error crítico al iniciar el bot:', error);
        // Si hay un error al iniciar la DB o al iniciar sesión en Discord, el bot no puede funcionar.
        process.exit(1);
    }
})();

// Este evento se dispara una vez cuando el bot se conecta exitosamente a Discord.
// Ahora, este evento se encargará principalmente del registro de comandos.
client.once('ready', async () => {
    try {
        // console.log('✅ Bot iniciado como ' + client.user?.tag); // Ya se imprime en el bloque async superior
        console.log('Eliminando comandos globales...');

        // 1) Borramos todos los comandos globales para evitar duplicados o comandos antiguos.
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID!),
            { body: [] }
        );

        console.log('🔄 Registrando comandos en el servidor de pruebas...');

        // 2) Registramos los comandos solo en el servidor de pruebas (Guild ID)
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
client.on('interactionCreate', async (interaction: Interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            await handleCommand(interaction);
            return;
        }

        if (interaction.isModalSubmit()) {
            await handleModal(interaction);
            return;
        }

        if (interaction.isButton()) {
            await handleButton(interaction);
            return;
        }

        if (interaction.isStringSelectMenu()) {
            await handleSelectMenu(interaction);
            return;
        }

    } catch (error) {
        console.error('❌ Error general al manejar una interacción:', error);

        if (interaction.isRepliable()) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Ocurrió un error inesperado al procesar tu solicitud.', ephemeral: true });
            } else {
                await interaction.followUp({ content: 'Ocurrió un error inesperado al procesar tu solicitud.', ephemeral: true });
            }
        }
    }
});
// La línea `client.login()` ya no es necesaria aquí abajo, se movió al bloque async inicial.