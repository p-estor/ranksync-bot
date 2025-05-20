import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getAccountByDiscordId } from '../utils/accountDb';

export const data = new SlashCommandBuilder()
  .setName('refresh')
  .setDescription('Asigna el rol según el rango guardado en la base de datos (modo prueba)');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;
  const guild = interaction.guild;

  if (!guild) {
    return interaction.editReply('❌ No se pudo obtener el servidor.');
  }

  const account = await getAccountByDiscordId(discordId);
  if (!account || !account.rankTier) {
    return interaction.editReply('❌ No hay rango guardado para tu cuenta. Usa /vincular primero.');
  }

  const tier = account.rankTier.toUpperCase();

  const member = await guild.members.fetch(discordId);
  const tierRoleMap = {
    IRON: 'Iron',
    BRONZE: 'Bronze',
    SILVER: 'Silver',
    GOLD: 'Gold',
    PLATINUM: 'Platinum',
    DIAMOND: 'Diamond',
    MASTER: 'Master',
    GRANDMASTER: 'Grandmaster',
    CHALLENGER: 'Challenger',
    UNRANKED: 'Unranked',
  };

  const rolesToRemove = Object.values(tierRoleMap);
  for (const roleName of rolesToRemove) {
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role && member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
    }
  }

  const roleName = tierRoleMap[tier as keyof typeof tierRoleMap] || 'Unranked';
  const newRole = guild.roles.cache.find(r => r.name === roleName);
  if (newRole) {
    await member.roles.add(newRole);
  }

  await interaction.editReply(`✅ Tu rol ha sido actualizado a **${roleName}** (modo prueba).`);
}
