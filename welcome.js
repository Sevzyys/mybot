// features/welcome.js
const { EmbedBuilder, Events } = require('discord.js');

module.exports = (client, cfg) => {
  client.on(Events.GuildMemberAdd, async (member) => {
    // DM
    try {
      const emb = new EmbedBuilder()
        .setColor(cfg.EMBED_PURPLE)
        .setTitle('🎉 Welcome!')
        .setDescription(
          `Hey **${member.user.username}**, glad to have you here!\n\n` +
          `🛒 Check out our shop: **[Sev Services Shop](${cfg.SHOP_LINK})**\n\n` +
          `If you have questions, just reply to this DM or ask in the server.`
        )
        .setTimestamp();
      await member.send({ embeds: [emb] });
    } catch {}

    // Log
    const ch = member.guild.channels.cache.get(cfg.LOG_CHANNEL_ID);
    if (ch) {
      const log = new EmbedBuilder()
        .setColor(cfg.EMBED_PURPLE)
        .setTitle('📥 Member Joined')
        .setDescription(`**${member.user.tag}** joined.`)
        .addFields({ name: 'User ID', value: member.id })
        .setTimestamp();
      ch.send({ embeds: [log] }).catch(() => {});
    }
  });
};
