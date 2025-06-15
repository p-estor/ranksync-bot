import { ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('listar-roles')
  .setDescription('Lista todos los roles del servidor con sus IDs');

export async function execute(interaction: ChatInputCommandInteraction) {
  // Obtener roles del servidor, excluyendo @everyone
  const roles = interaction.guild?.roles.cache.filter(role => role.name !== '@everyone');

  if (!roles || roles.size === 0) {
    return interaction.reply({ content: 'No se encontraron roles en este servidor.', ephemeral: true });
  }

  // Crear texto con los roles y sus IDs
  const rolesList = roles
    .map(role => `${role.name} - ${role.id}`)
    .join('\n');

  // Crear buffer para el archivo
  const buffer = Buffer.from(rolesList, 'utf-8');

  // Crear adjunto con nombre roles.txt
  const attachment = new AttachmentBuilder(buffer, { name: 'roles.txt' });

  // Enviar respuesta con el archivo adjunto
  await interaction.reply({
    content: 'Aquí tienes la lista completa de roles con sus IDs:',
    files: [attachment],
    ephemeral: true,
  });
}
