// config.js
module.exports = {
  SHOP_LINK: 'https://sevservices.mysellauth.com/',
  LOG_CHANNEL_ID: '1325296163661811735',
  EMBED_PURPLE: 0x9B59B6,
  // tweak these to fit your rules
  BANNED_WORDS: ['badword1', 'badword2'],
  INVITE_REGEX: /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i,
  SCAM_PATTERNS: [
    /free\s*nitro/i,
    /steamcommunity\.com\/gift/i,
    /bit\.ly|tinyurl\.com|t\.co|shorturl/i,
    /claim.*gift/i,
  ],
};
