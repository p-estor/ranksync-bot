// src/commands/gif-modal.ts

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  EmbedBuilder,
} from 'discord.js';

// Slash command data
export const data = new SlashCommandBuilder()
  .setName('gifmodal')
  .setDescription('Muestra un modal y luego un gif');

// Ejecutar el comando (muestra el modal)
export async function execute(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('gifModal')
    .setTitle('Escribe algo para ver un GIF');

  const input = new TextInputBuilder()
    .setCustomId('userInput')
    .setLabel('Escribe algo')
    .setStyle(TextInputStyle.Short);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

// ✅ Exporta esta función
export async function handleGifModal(interaction: ModalSubmitInteraction) {
  const userInput = interaction.fields.getTextInputValue('userInput');

  const embed = new EmbedBuilder()
    .setTitle('🎉 Aquí tienes tu GIF!')
    .setDescription(`Texto recibido: **${userInput || 'Nada'}**`)
    .setImage('https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif')
    .setColor('Random');

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
