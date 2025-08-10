// features/moderation.js
const { EmbedBuilder, Events } = require('discord.js');

const warns = {};

function getWarn(gid, uid) {
  if (!warns[gid]) warns[gid] = {};
  return warns[gid][uid] || 0;
}

function addWarn(gid, uid) {
  if (!warns[gid]) warns[gid] = {};
  warns[gid][uid] = (warns[gid][uid] || 0) + 1;
  return warns[gid][uid];
}

function violates(content, cfg) {
  const lower = content.toLowerCase();
  if (cfg.BANNED_WORDS.some(w => lower.includes(w))) return 'Blocked term detected';
  if (cfg.INVITE_REGEX.test(content)) return 'Discord invite link detected';
  if (cfg.SCAM_PATTERNS.some(rx => rx.test(content))) return 'Scam pattern detected';
  return null;
}

function warningEmbed(count, guildName, purple) {
  const e = new EmbedBuilder()
    .setColor(purple)
    .setTitle('⚠️ Warning Issued')
    .setDescription(`You broke a server rule in **${guildName}**.`)
    .setTimestamp();
  if (count === 1) {
    e.addFields(
      { name: 'Action', value: 'You have been server muted for **3 hours**.' },
      { name: 'Next Violation', value: 'Mute for **12 hours** (Warning 2/3).' },
    );
  } else if (count === 2) {
    e.addFields(
      { name: 'Action', value: 'You have been server muted for **12 hours**.' },
      { name: 'Next Violation', value: '**Permanent ban** (Warning 3/3).' },
    );
  } else {
    e.addFields({ name: 'Action', value: 'You have been **banned** from the server.' });
  }
  return e;
}

module.exports = (client, cfg) => {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;

    const reason = violates(message.content, cfg);
    if (!reason) return;

    await message.delete().catch(() => {});
    const count = addWarn(message.guild.id, message.author.id);

    try {
      await message.author.send({
        embeds: [warningEmbed(count, message.guild.name, cfg.EMBED_PURPLE)],
      });
    } catch {}

    try {
      if (count === 1) {
        await message.member.timeout(3 * 60 * 60 * 1000, 'Warning 1/3 – rule violation');
      } else if (count === 2) {
        await message.member.timeout(12 * 60 * 60 * 1000, 'Warning 2/3 – rule violation');
      } else {
        await message.guild.members.ban(message.author.id, { reason: 'Warning 3/3 – rule violation' });
      }
    } catch {}

    const ch = message.guild.channels.cache.get(cfg.LOG_CHANNEL_ID);
    if (ch) {
      const fields = [
        { name: 'User', value: `${message.author.tag} (${message.author.id})` },
        { name: 'Reason', value: reason },
        { name: 'Warnings', value: `${getWarn(message.guild.id, message.author.id)}/3` },
        { name: 'Channel', value: `<#${message.channel.id}>` },
      ];
      fields.push({ name: 'Action', value:
        count === 1 ? 'Message deleted • 3h timeout'
      : count === 2 ? 'Message deleted • 12h timeout'
      : 'Message deleted • Ban' });

      const emb = new EmbedBuilder()
        .setColor(cfg.EMBED_PURPLE)
        .setTitle('🛡️ Moderation Action')
        .addFields(fields)
        .setTimestamp();
      ch.send({ embeds: [emb] }).catch(() => {});
    }
  });
};
