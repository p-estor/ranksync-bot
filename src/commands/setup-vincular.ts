import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setup-vincular')
  .setDescription('Envía el mensaje principal con los botones para vincular cuenta de LoL.');

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🔎 • VINCULAR CUENTAS Y BÚSQUEDA DE PARTIDA • 🔍')
    .setDescription(
        `Para que podáis buscar partida de forma eficiente hemos dividido los canales en las distintas clasificaciones que existen dentro de League of Legends, y para ello, debéis vincular las cuentas con las que queráis jugar.

**❓ • FAQ**
• ¿Debo volver a verificar la cuenta que usé en mi registro?
No, nuestro sistema la verificará automáticamente cuando introduzcas el nombre de invocador.

• ¿Hay algún límite de cuentas a vincular?
Sí, solamente podéis vincular un máximo de 3 cuentas.

• ¿Cómo elimino una de mis cuentas vinculadas?
Al pulsar el botón **Ver cuentas**, aparecerá un menú desplegable junto a ellas por si queréis eliminar alguna.

• He subido de división, pero no se me han actualizado los canales/roles, ¿qué puedo hacer?
Pulsando el botón **Actualizar datos** podréis actualizar manualmente vuestras cuentas en caso de que eso ocurra.`
    )
    .setColor('Blue');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('link_account')
      .setLabel('🔗 Vincular cuenta')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('view_accounts')
      .setLabel('Ver cuentas')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('refresh_rank')
      .setLabel('🔄 Actualizar datos')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.reply({
    embeds: [embed],
    components: [row],
  });
}
