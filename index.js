// index.js
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
} = require('discord.js');

// ---------- CONFIG ----------
const SHOP_LINK = 'https://sevservices.mysellauth.com/';
const LOG_CHANNEL_ID = '1325296163661811735';
const EMBED_PURPLE = 0x9B59B6;

// Triggers to moderate
const BANNED_WORDS = ['badword1', 'badword2']; // example words
const INVITE_REGEX = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i;
const SCAM_PATTERNS = [
  /free\s*nitro/i,
  /steamcommunity\.com\/gift/i,
  /bit\.ly|tinyurl\.com|t\.co|shorturl/i,
  /claim.*gift/i,
];

// Warning counts { guildId: { userId: number } }
const warningCounts = Object.create(null);

// ---------- HELPERS ----------
function getWarn(guildId, userId) {
  if (!warningCounts[guildId]) warningCounts[guildId] = {};
  return warningCounts[guildId][userId] || 0;
}
function addWarn(guildId, userId) {
  if (!warningCounts[guildId]) warningCounts[guildId] = {};
  warningCounts[guildId][userId] = (warningCounts[guildId][userId] || 0) + 1;
  return warningCounts[guildId][userId];
}
function violates(content) {
  const lower = content.toLowerCase();
  if (BANNED_WORDS.some(w => lower.includes(w))) return `Blocked term detected`;
  if (INVITE_REGEX.test(content)) return `Discord invite link detected`;
  if (SCAM_PATTERNS.some(rx => rx.test(content))) return `Scam pattern detected`;
  return null;
}
function warningEmbed({ count, guildName }) {
  const emb = new EmbedBuilder()
    .setColor(EMBED_PURPLE)
    .setTitle('⚠️ Warning Issued')
    .setDescription(`You broke a server rule in **${guildName}**.`)
    .setTimestamp();

  if (count === 1) {
    emb.addFields(
      { name: 'Action', value: 'You have been server muted for **3 hours**.' },
      { name: 'Next Violation', value: 'Mute for **12 hours** (Warning 2/3).' }
    );
  } else if (count === 2) {
    emb.addFields(
      { name: 'Action', value: 'You have been server muted for **12 hours**.' },
      { name: 'Next Violation', value: '**Permanent ban** (Warning 3/3).' }
    );
  } else if (count >= 3) {
    emb.addFields({ name: 'Action', value: 'You have been **banned** from the server.' });
  }
  return emb;
}
function logEmbed({ title, description, fields = [] }) {
  return new EmbedBuilder()
    .setColor(EMBED_PURPLE)
    .setTitle(title)
    .setDescription(description || null)
    .addFields(fields)
    .setTimestamp();
}

// ---------- CLIENT ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ---------- EVENTS ----------
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Welcome DM + log
client.on('guildMemberAdd', async (member) => {
  try {
    const welcome = new EmbedBuilder()
      .setColor(EMBED_PURPLE)
      .setTitle('🎉 Welcome!')
      .setDescription(
        `Hey **${member.user.username}**, glad to have you here!\n\n` +
        `🛒 Check out our shop: **[Sev Services Shop](${SHOP_LINK})**\n\n` +
        `If you have questions, just reply to this DM or ask in the server.`
      )
      .setTimestamp();

    await member.send({ embeds: [welcome] });
  } catch {
    // ignore if DMs are closed
  }

  const logCh = member.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (logCh) {
    const emb = logEmbed({
      title: '📥 Member Joined',
      description: `**${member.user.tag}** joined.`,
      fields: [{ name: 'User ID', value: member.id }],
    });
    logCh.send({ embeds: [emb] }).catch(() => {});
  }
});

// 3-strike moderation system
client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;

  const reason = violates(message.content);
  if (!reason) return;

  // Delete offending message
  await message.delete().catch(() => {});

  // Add warning
  const count = addWarn(message.guild.id, message.author.id);

  // DM warning
  const dmEmb = warningEmbed({ count, guildName: message.guild.name });
  try {
    await message.author.send({ embeds: [dmEmb] });
  } catch {
    // ignore if DMs closed
  }

  // Punish
  try {
    if (count === 1) {
      await message.member.timeout(3 * 60 * 60 * 1000, 'Warning 1/3 – rule violation');
    } else if (count === 2) {
      await message.member.timeout(12 * 60 * 60 * 1000, 'Warning 2/3 – rule violation');
    } else if (count >= 3) {
      await message.guild.members.ban(message.author.id, { reason: 'Warning 3/3 – rule violation' });
    }
  } catch (err) {
    const logCh = message.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logCh) {
      const emb = logEmbed({
        title: '⚠️ Moderation Action Failed',
        description: `Tried to punish **${message.author.tag}** but failed.`,
        fields: [{ name: 'Error', value: String(err).slice(0, 1000) }],
      });
      logCh.send({ embeds: [emb] }).catch(() => {});
    }
  }

  // Log action
  const logCh = message.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (logCh) {
    const fields = [
      { name: 'User', value: `${message.author.tag} (${message.author.id})` },
      { name: 'Reason', value: reason },
      { name: 'Warnings', value: `${count}/3` },
      { name: 'Channel', value: `<#${message.channel.id}>` },
    ];
    if (count === 1) fields.push({ name: 'Action', value: 'Message deleted • 3h timeout' });
    else if (count === 2) fields.push({ name: 'Action', value: 'Message deleted • 12h timeout' });
    else fields.push({ name: 'Action', value: 'Message deleted • Ban' });

    const emb = logEmbed({ title: '🛡️ Moderation Action', fields });
    logCh.send({ embeds: [emb] }).catch(() => {});
  }
});

// ---------- START ----------
client.login(process.env.token);
