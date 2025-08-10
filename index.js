const express = require("express");
const app = express();

app.listen(3000, () => {
  console.log("Project is running!");
});

app.get("/", (req, res) => {
  res.send("Hello world!");
});

const Discord = require("discord.js");
const fs = require("fs");
const path = require("path");

// ====== SECURITY STORAGE ======
const userCooldowns = new Map();
const channelCooldowns = new Map();
const processedInteractions = new Map();

const warningsFile = path.join(__dirname, "warnings.json");
let warnings = fs.existsSync(warningsFile)
  ? JSON.parse(fs.readFileSync(warningsFile, "utf8"))
  : {};

function saveWarnings() {
  fs.writeFileSync(warningsFile, JSON.stringify(warnings, null, 2));
}

// ====== SECURITY FILTERS ======
function sanitizeInput(input) {
  if (typeof input !== "string") return "";
  return input.replace(/[<>@&"']/g, "").trim();
}

function isValidUserId(userId) {
  return /^\d{17,19}$/.test(userId);
}

function isValidChannelId(channelId) {
  return /^\d{17,19}$/.test(channelId);
}

const PROMOTION_KEYWORDS = [
  "discord.gg/", "discord.com/invite/", "dsc.gg/", "invite.gg/",
  "free nitro", "free discord", "steam gift", "free robux",
  "click here", "limited time", "hurry up", "act fast",
  "dm me", "private message", "contact me for",
  "selling", "buy from me", "cheap prices", "best deals",
  "telegram", "whatsapp", "instagram follow", "youtube subscribe",
  "check my profile", "visit my", "my server", "join my",
  "crypto", "bitcoin", "nft", "investment", "trading"
];

const SCAM_PATTERNS = [
  /discord\.nitro/i,
  /steamcommunity\.com\/gift/i,
  /steamcommunity\.com\/tradeoffer/i,
  /bit\.ly/i,
  /tinyurl\.com/i,
  /t\.co/i,
  /shorturl/i,
  /giveaway.*nitro/i,
  /free.*steam/i,
  /claim.*gift/i
];

function detectPromotion(content) {
  const lowerContent = content.toLowerCase();

  for (const keyword of PROMOTION_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      return { detected: true, reason: `Promotion keyword: ${keyword}` };
    }
  }

  for (const pattern of SCAM_PATTERNS) {
    if (pattern.test(content)) {
      return { detected: true, reason: `Scam pattern: ${pattern}` };
    }
  }

  const invitePattern = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i;
  if (invitePattern.test(content)) {
    return { detected: true, reason: "Discord invite link detected" };
  }

  const urlPattern = /(https?:\/\/[^\s]+)/gi;
  const urls = content.match(urlPattern);
  if (urls) {
    const suspiciousDomains = [
      "discord-nitro", "steam-gift", "free-nitro", "discord-free",
      "discrod", "steamcomunity", "steamcommuntiy"
    ];
    for (const url of urls) {
      for (const domain of suspiciousDomains) {
        if (url.toLowerCase().includes(domain)) {
          return { detected: true, reason: `Suspicious domain: ${domain}` };
        }
      }
    }
  }

  return { detected: false };
}

function isWhitelistedUser(userId) {
  const whitelistedUsers = [
    "1325295557782278208" // Owner
  ];
  return whitelistedUsers.includes(userId);
}

// ====== RATE LIMITING ======
function checkRateLimit(userId, command, limitMs = 5000) {
  const key = `${userId}-${command}`;
  const now = Date.now();
  const lastUsed = userCooldowns.get(key);

  if (lastUsed && now - lastUsed < limitMs) {
    return false;
  }
  userCooldowns.set(key, now);
  return true;
}

// ====== DISCORD BOT ======
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent,
    Discord.GatewayIntentBits.GuildMembers
  ]
});

client.on("ready", () => {
  console.log(`Bot ready as ${client.user.tag}`);

  setInterval(() => {
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;

    for (const [key, timestamp] of userCooldowns.entries()) {
      if (timestamp < tenMinutesAgo) userCooldowns.delete(key);
    }
    for (const [key, timestamp] of channelCooldowns.entries()) {
      if (timestamp < tenMinutesAgo) channelCooldowns.delete(key);
    }

    const fiveMinutesAgo = now - 5 * 60 * 1000;
    for (const [key, timestamp] of processedInteractions.entries()) {
      if (timestamp < fiveMinutesAgo) processedInteractions.delete(key);
    }
  }, 10 * 60 * 1000);
});

// ====== MESSAGE MONITOR & WARN SYSTEM ======
client.on("messageCreate", async (message) => {
  if (message.author.bot || isWhitelistedUser(message.author.id)) return;

  const check = detectPromotion(message.content);
  if (check.detected) {
    await message.delete().catch(() => {});
    handleWarning(message, check.reason);
  }
});

async function handleWarning(message, reason) {
  const guildId = message.guild.id;
  const userId = message.author.id;

  if (!warnings[guildId]) warnings[guildId] = {};
  if (!warnings[guildId][userId]) warnings[guildId][userId] = 0;

  warnings[guildId][userId]++;
  saveWarnings();

  const count = warnings[guildId][userId];

  try {
    await message.author.send(`⚠️ Warning ${count}/3: ${reason}`);
  } catch {
    console.log(`Could not DM ${message.author.tag}`);
  }

  const muteRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === "muted");

  if (count === 1 && muteRole) {
    await message.member.roles.add(muteRole, "First warning");
    setTimeout(() => message.member.roles.remove(muteRole), 3 * 60 * 60 * 1000);
  } else if (count === 2 && muteRole) {
    await message.member.roles.add(muteRole, "Second warning");
    setTimeout(() => message.member.roles.remove(muteRole), 12 * 60 * 60 * 1000);
  } else if (count >= 3) {
    await message.guild.members.ban(userId, { reason: "3rd warning reached" });
  }
}

client.login(process.env.token);


// Welcome message when someone joins the server
client.on("guildMemberAdd", async (member) => {
  console.log(`🔔 GUILD MEMBER ADD EVENT TRIGGERED for: ${member.user.tag} (${member.user.id})`);
  
  try {
    // Debug: Check if member object is valid
    if (!member || !member.user) {
      console.error('❌ Invalid member object received');
      return;
    }

    console.log(`✅ Processing new member: ${member.user.tag}`);
    securityLog('MEMBER_JOINED', member.user.id, `- User: ${member.user.tag}`);

    // Auto assign role to new members
    const autoRoleId = '1325628922150518907';
    try {
      console.log(`🔍 Looking for auto-role: ${autoRoleId}`);
      const role = member.guild.roles.cache.get(autoRoleId);
      if (role) {
        await member.roles.add(role);
        console.log(`✅ Auto-assigned role ${role.name} to ${member.user.tag}`);
        securityLog('AUTO_ROLE_ASSIGNED', member.user.id, `- Role: ${role.name} (${autoRoleId})`);
      } else {
        console.log(`❌ Auto-role not found: ${autoRoleId}`);
        securityLog('AUTO_ROLE_NOT_FOUND', member.user.id, `- Role ID: ${autoRoleId}`);
      }
    } catch (roleError) {
      console.error('❌ Error assigning auto-role:', roleError);
      securityLog('AUTO_ROLE_ERROR', member.user.id, `- Error: ${roleError.message}`);
    }

    // Use specific welcome channel ID
    const welcomeChannelId = '1325351844507156480';
    console.log(`🔍 Looking for welcome channel: ${welcomeChannelId}`);
    
    let welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);

    // If specific channel not found, try to find any general channel
    if (!welcomeChannel) {
      console.log(`❌ Welcome channel not found: ${welcomeChannelId}`);
      console.log(`🔍 Trying to find any channel with 'welcome' or 'general' in name...`);
      
      // Try to find a welcome or general channel by name
      welcomeChannel = member.guild.channels.cache.find(ch => 
        (ch.name.toLowerCase().includes('welcome') || 
         ch.name.toLowerCase().includes('general') ||
         ch.name.toLowerCase().includes('chat')) && 
        ch.type === Discord.ChannelType.GuildText
      );
      
      // If still no channel found, use the first text channel available
      if (!welcomeChannel) {
        welcomeChannel = member.guild.channels.cache.find(ch => 
          ch.type === Discord.ChannelType.GuildText
        );
      }
      
      if (welcomeChannel) {
        console.log(`✅ Found fallback welcome channel: ${welcomeChannel.name} (${welcomeChannel.id})`);
        securityLog('WELCOME_FALLBACK_CHANNEL', member.user.id, `- Using: ${welcomeChannel.name}`);
      } else {
        console.log(`❌ No text channels found in guild`);
        securityLog('NO_TEXT_CHANNELS', member.user.id, '- Cannot send welcome message');
        return;
      }
    }

    console.log(`✅ Welcome channel found: ${welcomeChannel.name}`);

    // Verify the channel is a text channel
    if (welcomeChannel.type !== Discord.ChannelType.GuildText) {
      console.log(`❌ Welcome channel is not a text channel: ${welcomeChannel.type}`);
      securityLog('WELCOME_CHANNEL_WRONG_TYPE', member.user.id, `- Channel type: ${welcomeChannel.type}`);
      return;
    }

    // Check if bot has permissions to send messages
    console.log('🔍 Checking bot permissions...');
    const botPermissions = welcomeChannel.permissionsFor(client.user);
    
    if (!botPermissions) {
      console.log('❌ Could not check bot permissions');
      securityLog('WELCOME_PERMISSION_CHECK_FAILED', member.user.id, '- Could not check permissions');
      return;
    }

    console.log(`📋 Bot permissions: ${botPermissions.toArray().join(', ')}`);

    if (!botPermissions.has(Discord.PermissionFlagsBits.SendMessages)) {
      console.log('❌ Bot lacks permission to send messages in welcome channel');
      securityLog('WELCOME_PERMISSION_ERROR', member.user.id, '- Missing SendMessages permission');
      return;
    }

    if (!botPermissions.has(Discord.PermissionFlagsBits.EmbedLinks)) {
      console.log('❌ Bot lacks permission to embed links in welcome channel');
      securityLog('WELCOME_EMBED_PERMISSION_ERROR', member.user.id, '- Missing EmbedLinks permission');
      return;
    }

    console.log('✅ Bot has necessary permissions');

    // Send welcome message
    await sendWelcomeMessage(member, welcomeChannel);

  } catch (error) {
    console.error('❌ Error in welcome system:', error);
    console.error('❌ Error stack:', error.stack);
    securityLog('WELCOME_SYSTEM_ERROR', member.user?.id || 'unknown', `- Error: ${error.message}`);
  }
});

// Helper function to send welcome message
async function sendWelcomeMessage(member, channel) {
  try {
    console.log(`📝 Creating welcome embed for ${member.user.tag}...`);

    // Create welcome embed
    const welcomeEmbed = new Discord.EmbedBuilder()
      .setTitle('🎉 Welcome to the Server!')
      .setDescription(`Hey ${member.user}, welcome to **${member.guild.name}**!\n\nWe're glad to have you here. Feel free to explore and have fun!`)
      .setColor(0x00FF00) // Green color
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: '👋 Getting Started',
          value: '• Check out our rules\n• Introduce yourself\n• Have a great time!',
          inline: false
        },
        {
          name: '📊 Server Stats',
          value: `Total Members: **${member.guild.memberCount}**`,
          inline: true
        }
      )
      .setFooter({ text: `User ID: ${member.user.id}` })
      .setTimestamp();

    console.log(`📤 Sending welcome message to ${channel.name}...`);

    // Send the welcome message
    const sentMessage = await channel.send({ embeds: [welcomeEmbed] });
    
    console.log(`✅ Welcome message sent successfully! Message ID: ${sentMessage.id}`);
    securityLog('WELCOME_MESSAGE_SENT', member.user.id, `- Channel: ${channel.name} - Message: ${sentMessage.id}`);

  } catch (sendError) {
    console.error(`❌ Failed to send welcome message: ${sendError.message}`);
    console.error('❌ Send error stack:', sendError.stack);
    securityLog('WELCOME_SEND_ERROR', member.user.id, `- Error: ${sendError.message}`);
    
    // Try sending a simple text message as fallback
    try {
      console.log('🔄 Attempting fallback text message...');
      const fallbackMessage = await channel.send(`🎉 Welcome ${member.user} to **${member.guild.name}**! We're glad to have you here!`);
      console.log(`✅ Fallback message sent! Message ID: ${fallbackMessage.id}`);
      securityLog('WELCOME_FALLBACK_SENT', member.user.id, `- Fallback message: ${fallbackMessage.id}`);
    } catch (fallbackError) {
      console.error(`❌ Fallback message also failed: ${fallbackError.message}`);
      securityLog('WELCOME_FALLBACK_FAILED', member.user.id, `- Error: ${fallbackError.message}`);
    }
  }
}

client.on("messageCreate", async (message) => {
  // Ignore bot messages and DMs
  if (message.author.bot || !message.guild) return;

  try {
    // Check if user is whitelisted (owner role or specific users)
    const ownerRoleId = '1325295557782278208';
    const hasOwnerRole = message.member?.roles?.cache?.has(ownerRoleId);
    const isWhitelisted = isWhitelistedUser(message.author.id);

    if (hasOwnerRole || isWhitelisted) {
      // Handle basic bot commands for whitelisted users
      if(message.content === "ping") {
        message.channel.send("pong");
      }
      if(message.content === "hello") {
        message.channel.send("Hi");
      }
      return; // Skip security checks for whitelisted users
    }

    // Security check for promotion/scam content
    const promotionCheck = detectPromotion(message.content);
    
    if (promotionCheck.detected) {
      try {
        // Delete the message immediately
        await message.delete();

        // Log the violation
        securityLog('PROMOTION_DETECTED', message.author.id, 
          `- Reason: ${promotionCheck.reason} - Content: ${message.content.substring(0, 100)}`);

        // Send warning to user via DM
        try {
          const warningEmbed = new Discord.EmbedBuilder()
            .setTitle('⚠️ Message Removed')
            .setDescription(`Your message in **${message.guild.name}** was removed for violating our anti-promotion policy.`)
            .addFields(
              {
                name: 'Reason',
                value: promotionCheck.reason,
                inline: false
              },
              {
                name: 'Rule Reminder',
                value: 'NO PROMOTING YOUR OWN SERVICES, SERVER, ETC',
                inline: false
              }
            )
            .setColor(0xFF4444)
            .setFooter({ text: 'Repeated violations may result in further action' })
            .setTimestamp();

          await message.author.send({ embeds: [warningEmbed] });
        } catch (dmError) {
          console.log(`Could not DM user ${message.author.tag}: ${dmError.message}`);
        }

        // Send alert to moderation channel
        const logChannelId = '1325296163661811735';
        const logChannel = message.guild.channels.cache.get(logChannelId);
        
        if (logChannel) {
          const alertEmbed = new Discord.EmbedBuilder()
            .setTitle('🚨 Promotion/Scam Detected')
            .setDescription(`Message from ${message.author} was automatically removed.`)
            .addFields(
              {
                name: 'User',
                value: `${message.author.tag} (${message.author.id})`,
                inline: true
              },
              {
                name: 'Channel',
                value: `${message.channel}`,
                inline: true
              },
              {
                name: 'Detection Reason',
                value: promotionCheck.reason,
                inline: false
              },
              {
                name: 'Message Content',
                value: `\`\`\`${message.content.substring(0, 500)}\`\`\``,
                inline: false
              }
            )
            .setColor(0xFF0000)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: 'Automatic Security System' })
            .setTimestamp();

          await logChannel.send({ embeds: [alertEmbed] });
        }

      } catch (error) {
        console.error('Error handling promotion detection:', error);
        securityLog('PROMOTION_HANDLER_ERROR', message.author.id, `- Error: ${error.message}`);
      }
      return;
    }

    // Handle basic bot commands for regular users
    if(message.content === "ping") {
      message.channel.send("pong");
    }
    if(message.content === "hello") {
      message.channel.send("Hi");
    }

  } catch (error) {
    console.error('Error in message security check:', error);
    securityLog('MESSAGE_SECURITY_ERROR', message.author.id, `- Error: ${error.message}`);
  }
});

// Ticket system configuration
const GUILD_ID = "1325295363304853564"; // Your server ID
const CATEGORY_ID = "1333688858638024736"; // Your ticket category ID

// Security: Enhanced logging function with Discord channel logging
async function securityLog(action, userId, details = '') {
  const timestamp = new Date().toISOString();
  const logMessage = `[SECURITY] ${timestamp} - ${action} by ${userId} ${details}`;
  console.log(logMessage);

  // Send to Discord logging channel
  try {
    const logChannelId = '1325296163661811735';
    const logChannel = client.channels.cache.get(logChannelId);

    if (logChannel) {
      const logEmbed = new Discord.EmbedBuilder()
        .setTitle('🔒 Security Log')
        .setDescription(`**Action:** ${action}\n**User ID:** ${userId}\n**Details:** ${details || 'None'}\n**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`)
        .setColor(action.includes('ERROR') || action.includes('UNAUTHORIZED') ? 0xFF0000 : 
                 action.includes('CREATED') || action.includes('ASSIGNED') ? 0x00FF00 : 0x0099FF)
        .setFooter({ text: 'Bot Security Monitor' })
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
    }
  } catch (error) {
    console.error('Failed to send log to Discord channel:', error);
  }
}

client.on("interactionCreate", async (interaction) => {
  try {
    // Security: Input validation for user and guild
    if (!isValidUserId(interaction.user.id) || !interaction.guild) {
      securityLog('INVALID_INTERACTION', interaction.user.id, '- Invalid user ID or missing guild');
      return;
    }

    // Security: Rate limiting check
    if (!checkRateLimit(interaction.user.id, 'command', 3000)) {
      await interaction.reply({ content: "⚠️ Please wait before using another command.", ephemeral: true });
      securityLog('RATE_LIMITED', interaction.user.id, `- Command: ${interaction.commandName || 'unknown'}`);
      return;
    }

    if(interaction.isCommand()) {
      // Security: Check if user has owner role for commands
      const ownerRoleId = '1325295557782278208';

      // More robust role checking
      let hasOwnerRole = false;
      if (interaction.member && interaction.member.roles) {
        hasOwnerRole = interaction.member.roles.cache.has(ownerRoleId);
      }

      if (!hasOwnerRole) {
        // Check if interaction is still valid before responding
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "❌ You need the owner role to use commands.", ephemeral: true });
        }
        securityLog('UNAUTHORIZED_COMMAND', interaction.user.id, `- Command: ${interaction.commandName} - Missing owner role`);
        return;
      }

      securityLog('COMMAND_USED', interaction.user.id, `- Command: ${interaction.commandName}`);

      if(interaction.commandName === "ping") {
        // Check if interaction is still valid
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply("pong");
        }
      } else if(interaction.commandName === "embed") {
      const embed = new Discord.EmbedBuilder()
        .setTitle("💎Premium R6 Lua – $8")
        .setDescription("Upgrade your gameplay with our Premium R6 Lua script, packed with features and unmatched stability.")
        .setFooter({ text: "this is a footer" })
        .setColor(0x3C266C)
        .setAuthor({ name: "Sev Services" })
        .addFields(
          {
            name: "✨Highlights",
            value: "• Supports all operators and guns\n• Built-in config system - easy to set up and use\n• 100% undetected – play safely and confidently\n• Compatible only with Logitech mice",
            inline: false
          },
          {
            name: "💰Price",
            value: "$8 – Lifetime Access",
            inline: false
          },
          {
            name: "📩 How to Buy",
            value: "• Open a ticket to purchase now!",
            inline: false
          }
        );

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ embeds: [embed] });
      }
    } else if(interaction.commandName === "ticket-system") {
      try {
        // Security: Check if user has permission to create ticket system
        if (!interaction.member.permissions.has(Discord.PermissionFlagsBits.ManageChannels)) {
          await interaction.reply({ content: "❌ You need 'Manage Channels' permission to use this command.", ephemeral: true });
          securityLog('UNAUTHORIZED_TICKET_SYSTEM', interaction.user.id, '- Missing permissions');
          return;
        }

        // Create the ticket system embed with purple-blue gradient
        const ticketEmbed = new Discord.EmbedBuilder()
          .setTitle("🎫 Purchase Support System")
          .setDescription("Ready to upgrade your gaming experience? Click the button below to open a purchase ticket and get started!")
          .setColor(0x4B0082) // Indigo (purple-blue mix)
          .addFields(
            {
              name: "💎 What We Offer",
              value: "• **Best Game Services For Multiple Games**\n• **24/7 Support**\n• **Best Services**\n• **Best Prices**\n• **Best Quality**",
              inline: true
            },
            {
              name: "🛡️ Why Choose Us?",
              value: "• **100% Undetected**\n• **Easy Setup**\n• **Professional Support**\n• **Trusted by 100+ Users**",
              inline: true
            },
            {
              name: "💳 Payment Methods",
              value: "• **PayPal**\n• **Credit/Debit Cards**\n• **Gift Cards**",
              inline: false
            },
            {
              name: "🌈 Experience the Difference",
              value: "```\n🟣🔵 PREMIUM QUALITY 🔵🟣\n```",
              inline: false
            }
          )
          .setFooter({ text: "🔥 Limited Time Offer - Get Premium Access Today!" })
          .setThumbnail(interaction.guild.iconURL());

        // Create purchase button
        const purchaseButton = new Discord.ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('💰 Purchase')
          .setStyle(Discord.ButtonStyle.Primary)
          .setEmoji('🛒');

        const row = new Discord.ActionRowBuilder()
          .addComponents(purchaseButton);

        await interaction.channel.send({ embeds: [ticketEmbed], components: [row] });
        await interaction.reply({ content: "✅ Ticket system posted!", ephemeral: true });
        console.log('Ticket system command executed successfully');
      } catch (error) {
        console.error('Error in ticket-system command:', error);
        await interaction.reply({ content: "❌ There was an error executing this command.", ephemeral: true });
      }
    } else if(interaction.commandName === "embed-builder") {
      try {
        // Get user input values with line break support and security checks
        const titleInput = interaction.options.getString('title') || 'Custom Embed';
        const descriptionInput = interaction.options.getString('description') || 'No description provided';
        
        // Security check for promotion content in embed inputs
        const titleCheck = detectPromotion(titleInput);
        const descriptionCheck = detectPromotion(descriptionInput);
        
        if (titleCheck.detected || descriptionCheck.detected) {
          const reason = titleCheck.detected ? titleCheck.reason : descriptionCheck.reason;
          await interaction.reply({ 
            content: `❌ Embed creation blocked: ${reason}`, 
            ephemeral: true 
          });
          securityLog('EMBED_PROMOTION_BLOCKED', interaction.user.id, `- Reason: ${reason}`);
          return;
        }
        
        const title = sanitizeInput(titleInput);
        const description = sanitizeInput(descriptionInput).replace(/\\n/g, '\n');

        // Get optional field values with line break support
        const field1Name = interaction.options.getString('field1_name');
        const field1Value = interaction.options.getString('field1_value') ? 
          interaction.options.getString('field1_value').replace(/\\n/g, '\n') : null;
        const field2Name = interaction.options.getString('field2_name');
        const field2Value = interaction.options.getString('field2_value') ? 
          interaction.options.getString('field2_value').replace(/\\n/g, '\n') : null;
        const field3Name = interaction.options.getString('field3_name');
        const field3Value = interaction.options.getString('field3_value') ? 
          interaction.options.getString('field3_value').replace(/\\n/g, '\n') : null;
        const field4Name = interaction.options.getString('field4_name');
        const field4Value = interaction.options.getString('field4_value') ? 
          interaction.options.getString('field4_value').replace(/\\n/g, '\n') : null;
        const field5Name = interaction.options.getString('field5_name');
        const field5Value = interaction.options.getString('field5_value') ? 
          interaction.options.getString('field5_value').replace(/\\n/g, '\n') : null;
        const field6Name = interaction.options.getString('field6_name');
        const field6Value = interaction.options.getString('field6_value') ? 
          interaction.options.getString('field6_value').replace(/\\n/g, '\n') : null;

        // Get bot's avatar and banner URLs
        const botUser = client.user;
        const botAvatarURL = botUser.displayAvatarURL({ dynamic: true, size: 256 });
        const botBannerURL = botUser.bannerURL({ dynamic: true, size: 1024 });

        // Create the custom embed with user inputs
        const customEmbed = new Discord.EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(0x9932CC) // Purple color matching owner role
          .setThumbnail(botAvatarURL) // Bot pfp in top right corner
          .setFooter({ 
            text: `Created by ${interaction.user.username}`, 
            iconURL: interaction.user.displayAvatarURL() 
          })
          .setTimestamp();

        // Add fields only if both name and value are provided
        const fields = [
          { name: field1Name, value: field1Value },
          { name: field2Name, value: field2Value },
          { name: field3Name, value: field3Value },
          { name: field4Name, value: field4Value },
          { name: field5Name, value: field5Value },
          { name: field6Name, value: field6Value }
        ];

        // Only add fields that have both name and value
        fields.forEach(field => {
          if (field.name && field.value && field.name.trim() !== '' && field.value.trim() !== '') {
            customEmbed.addFields({
              name: sanitizeInput(field.name),
              value: sanitizeInput(field.value),
              inline: false // Set to false for row display
            });
          }
        });

        // Add the SEV SERVICES banner as the footer image
        customEmbed.setImage('https://cdn.discordapp.com/attachments/1339915824273559634/1389881488589459477/standard_8.gif?ex=68663b81&is=6864ea01&hm=e96fd9cbfb5dbb56562ae28c2af18c3deb74dda6bf5ceb4207741dcea44b251f&');

        // Send embed to channel and reply with confirmation
        await interaction.channel.send({ embeds: [customEmbed] });

        // Check if interaction is still valid
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "✅ Embed sent successfully!", ephemeral: true });
        }

        securityLog('EMBED_BUILDER_USED', interaction.user.id, `- Custom embed: ${title}`);
        console.log('Embed builder command executed successfully');
      } catch (error) {
        console.error('Error in embed-builder command:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "❌ There was an error creating the embed.", ephemeral: true });
        }
      }
    } else if(interaction.commandName === "shop-embed-builder") {
      try {
        // Get user input values with paragraph break support and security checks
        const titleInput = interaction.options.getString('title') || 'Custom Embed';
        const descriptionInput = interaction.options.getString('description') || 'No description provided';
        
        // Security check for promotion content in shop embed inputs
        const titleCheck = detectPromotion(titleInput);
        const descriptionCheck = detectPromotion(descriptionInput);
        
        if (titleCheck.detected || descriptionCheck.detected) {
          const reason = titleCheck.detected ? titleCheck.reason : descriptionCheck.reason;
          await interaction.reply({ 
            content: `❌ Shop embed creation blocked: ${reason}`, 
            ephemeral: true 
          });
          securityLog('SHOP_EMBED_PROMOTION_BLOCKED', interaction.user.id, `- Reason: ${reason}`);
          return;
        }
        
        const title = sanitizeInput(titleInput);
        const description = sanitizeInput(descriptionInput).replace(/\\n/g, '\n');

        // Get optional field values with line break support
        const field1Name = interaction.options.getString('field1_name');
        const field1Value = interaction.options.getString('field1_value') ? 
          interaction.options.getString('field1_value').replace(/\\n/g, '\n') : null;
        const field2Name = interaction.options.getString('field2_name');
        const field2Value = interaction.options.getString('field2_value') ? 
          interaction.options.getString('field2_value').replace(/\\n/g, '\n') : null;
        const field3Name = interaction.options.getString('field3_name');
        const field3Value = interaction.options.getString('field3_value') ? 
          interaction.options.getString('field3_value').replace(/\\n/g, '\n') : null;
        const field4Name = interaction.options.getString('field4_name');
        const field4Value = interaction.options.getString('field4_value') ? 
          interaction.options.getString('field4_value').replace(/\\n/g, '\n') : null;
        const field5Name = interaction.options.getString('field5_name');
        const field5Value = interaction.options.getString('field5_value') ? 
          interaction.options.getString('field5_value').replace(/\\n/g, '\n') : null;
        const field6Name = interaction.options.getString('field6_name');
        const field6Value = interaction.options.getString('field6_value') ? 
          interaction.options.getString('field6_value').replace(/\\n/g, '\n') : null;

        // Get bot's avatar and banner URLs
        const botUser = client.user;
        const botAvatarURL = botUser.displayAvatarURL({ dynamic: true, size: 256 });
        const botBannerURL = botUser.bannerURL({ dynamic: true, size: 1024 });

        // Create the custom embed with user inputs
        const customEmbed = new Discord.EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(0x9932CC) // Purple color matching owner role
          .setThumbnail(botAvatarURL) // Bot pfp in top right corner
          .setFooter({ 
            text: `Created by ${interaction.user.username}`, 
            iconURL: interaction.user.displayAvatarURL() 
          })
          .setTimestamp();

        // Add fields only if both name and value are provided
        const fields = [
          { name: field1Name, value: field1Value },
          { name: field2Name, value: field2Value },
          { name: field3Name, value: field3Value },
          { name: field4Name, value: field4Value },
          { name: field5Name, value: field5Value },
          { name: field6Name, value: field6Value }
        ];

        // Only add fields that have both name and value - set to false for rows
        fields.forEach(field => {
          if (field.name && field.value && field.name.trim() !== '' && field.value.trim() !== '') {
            customEmbed.addFields({
              name: sanitizeInput(field.name),
              value: sanitizeInput(field.value),
              inline: false // Set to false for row display
            });
          }
        });

        // Add the SEV SERVICES banner as the footer image
        customEmbed.setImage('https://cdn.discordapp.com/attachments/1339915824273559634/1389881488589459477/standard_8.gif?ex=68663b81&is=6864ea01&hm=e96fd9cbfb5dbb56562ae28c2af18c3deb74dda6bf5ceb4207741dcea44b251f&');

        // Create purchase button with hyperlink
        const purchaseButton = new Discord.ButtonBuilder()
          .setLabel('Click Me To Make a Purchase or Ask a Question!')
          .setStyle(Discord.ButtonStyle.Link)
          .setURL('https://discord.com/channels/1325295363304853564/1333688858638024736');

        const row = new Discord.ActionRowBuilder()
          .addComponents(purchaseButton);

        // Send embed to channel and reply with confirmation
        await interaction.channel.send({ embeds: [customEmbed], components: [row] });

        // Check if interaction is still valid
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "✅ Shop embed sent successfully!", ephemeral: true });
        }

        securityLog('SHOP_EMBED_BUILDER_USED', interaction.user.id, `- Custom shop embed: ${title}`);
        console.log('Shop embed builder command executed successfully');
      } catch (error) {
        console.error('Error in shop-embed-builder command:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "❌ There was an error creating the shop embed.", ephemeral: true });
        }
      }
    } else if(interaction.commandName === "send-rules") {
      try {
        // Create rules embed
        const rulesEmbed = new Discord.EmbedBuilder()
          .setTitle('📋 Server Rules')
          .setDescription('Please follow these rules to maintain a positive environment for everyone.')
          .setColor(0x9932CC) // Purple color for rules
          .addFields(
            {
              name: '🚫 Rule 1',
              value: 'NO PROMOTING YOUR OWN SERVICES, SERVER, ETC',
              inline: false
            },
            {
              name: '💬 Rule 2',
              value: 'Keep conversations respectful and appropriate',
              inline: false
            },
            {
              name: '🔇 Rule 3',
              value: 'No spamming, excessive caps, or repeated messages',
              inline: false
            },
            {
              name: '🎯 Rule 4',
              value: 'Stay on topic in designated channels',
              inline: false
            },
            {
              name: '⚠️ Rule 5',
              value: 'No NSFW content or inappropriate material',
              inline: false
            }
          )
          .setImage('https://cdn.discordapp.com/attachments/1339915824273559634/1389881488589459477/standard_8.gif?ex=68663b81&is=6864ea01&hm=e96fd9cbfb5dbb56562ae28c2af18c3deb74dda6bf5ceb4207741dcea44b251f&')
          .setFooter({ text: 'Violations may result in warnings, mutes, or bans' })
          .setTimestamp();

        // Get the target channel
        const targetChannelId = '1325296163661811732';
        const targetChannel = client.channels.cache.get(targetChannelId);

        if (!targetChannel) {
          await interaction.reply({ content: `❌ Could not find channel with ID: ${targetChannelId}`, ephemeral: true });
          return;
        }

        // Send rules embed to the target channel
        await targetChannel.send({ embeds: [rulesEmbed] });

        // Confirm to the user
        await interaction.reply({ content: `✅ Rules embed sent to ${targetChannel}!`, ephemeral: true });

        securityLog('RULES_SENT', interaction.user.id, `- Target channel: ${targetChannel.name}`);
        console.log('Rules embed sent successfully');
      } catch (error) {
        console.error('Error sending rules embed:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "❌ There was an error sending the rules embed.", ephemeral: true });
        }
      }
    }
  } else if(interaction.isButton()) {
    // Security: Rate limiting for button interactions
    if (!checkRateLimit(interaction.user.id, 'button', 2000)) {
      await interaction.reply({ content: "⚠️ Please wait before clicking buttons again.", ephemeral: true });
      securityLog('BUTTON_RATE_LIMITED', interaction.user.id, `- Button: ${interaction.customId}`);
      return;
    }

    if(interaction.customId === 'create_ticket') {
      try {
        securityLog('TICKET_CREATION_ATTEMPT', interaction.user.id);

        // Reply immediately to prevent timeout
        await interaction.reply({ content: "🎟️ Creating your ticket...", ephemeral: true });

        const guild = interaction.guild;

        // First, let's find any category or create without one
        let category = guild.channels.cache.get(CATEGORY_ID);

        // If category doesn't exist, try to find any category with "ticket" in the name
        if (!category) {
          category = guild.channels.cache.find(channel => 
            channel.type === Discord.ChannelType.GuildCategory && 
            channel.name.toLowerCase().includes('ticket')
          );
        }

        // Security: Sanitize username for channel name
        const sanitizedUsername = sanitizeInput(interaction.user.username).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
        if (!sanitizedUsername) {
          await interaction.reply({ content: "❌ Invalid username for ticket creation.", ephemeral: true });
          securityLog('INVALID_USERNAME', interaction.user.id, '- Ticket creation blocked');
          return;
        }

        // Check if user already has a ticket
        const existingChannel = guild.channels.cache.find(
          channel => channel.name === `ticket-${sanitizedUsername}`.toLowerCase()
        );

        if(existingChannel) {
          securityLog('DUPLICATE_TICKET_ATTEMPT', interaction.user.id);
          await interaction.editReply({ 
            content: `❌ You already have an open ticket: ${existingChannel}` 
          });
          return; // Exit immediately after handling duplicate
        }

        // Security: Check total ticket count to prevent spam
        const totalTickets = guild.channels.cache.filter(channel => 
          channel.name.startsWith('ticket-') && channel.type === Discord.ChannelType.GuildText
        ).size;

        if (totalTickets >= 50) {
          await interaction.editReply({ content: "❌ Maximum ticket limit reached. Please try again later." });
          securityLog('TICKET_LIMIT_REACHED', interaction.user.id);
          return;
        }

        // Create ticket channel (with or without category)
        const channelOptions = {
          name: `ticket-${sanitizedUsername}`.toLowerCase(),
          type: Discord.ChannelType.GuildText,
          topic: `Ticket created by ${interaction.user.tag} (${interaction.user.id})`,
          permissionOverwrites: [
            {
              id: guild.roles.everyone,
              deny: [Discord.PermissionFlagsBits.ViewChannel]
            },
            {
              id: interaction.user.id,
              allow: [
                Discord.PermissionFlagsBits.ViewChannel,
                Discord.PermissionFlagsBits.SendMessages,
                Discord.PermissionFlagsBits.ReadMessageHistory
              ]
            },
            {
              id: client.user.id,
              allow: [
                Discord.PermissionFlagsBits.ViewChannel,
                Discord.PermissionFlagsBits.SendMessages,
                Discord.PermissionFlagsBits.ManageMessages
              ]
            }
          ]
        };

        // Only add parent if we found a valid category
        if (category && category.type === Discord.ChannelType.GuildCategory) {
          channelOptions.parent = category;
        }

        const ticketChannel = await guild.channels.create(channelOptions);

        // Welcome embed for the ticket
        const welcomeEmbed = new Discord.EmbedBuilder()
          .setTitle("🎫 Welcome to your Purchase Ticket")
          .setDescription(`Hello ${interaction.user}!\n\nThank you for your interest in our premium services. Our support team will assist you when available.\n\n**Please describe:**\n• What product you'd like to purchase\n• Any specific questions you have\n• Your payment method preference`)
          .setColor(0x8A2BE2) // Purple
          .setFooter({ text: "Support Team • Response time: Usually within 1 hour" })
          .setThumbnail(interaction.user.displayAvatarURL());

        // Close ticket button
        const closeButton = new Discord.ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('🔒 Close Ticket')
          .setStyle(Discord.ButtonStyle.Danger);

        const closeRow = new Discord.ActionRowBuilder()
          .addComponents(closeButton);

        await ticketChannel.send({ embeds: [welcomeEmbed], components: [closeRow] });
        securityLog('TICKET_CREATED', interaction.user.id, `- Channel: ${ticketChannel.name}`);

        // Update the original response
        await interaction.editReply({ 
          content: `🎟️ Ticket created successfully: ${ticketChannel}` 
        });
      } catch (error) {
        console.error('Error creating ticket:', error);
        securityLog('TICKET_CREATION_ERROR', interaction.user.id, `- Error: ${error.message}`);

        // Handle error response
        try {
          if (!interaction.replied) {
            await interaction.reply({ 
              content: `❌ Failed to create ticket. Please contact an administrator.`, 
              ephemeral: true 
            });
          } else {
            await interaction.editReply({ 
              content: `❌ Failed to create ticket. Please contact an administrator.` 
            });
          }
        } catch (responseError) {
          console.error('Failed to send error response:', responseError);
        }
      }
    } else if(interaction.customId === 'close_ticket') {
      try {
        // Prevent duplicate processing of the same interaction
        if (processedInteractions.has(interaction.id)) {
          console.log('Duplicate close interaction detected, ignoring');
          return;
        }
        processedInteractions.set(interaction.id, Date.now());

        securityLog('TICKET_CLOSE_ATTEMPT', interaction.user.id, `- Channel: ${interaction.channel.name}`);

        // Defer the reply immediately to prevent timeout - this must be first
        await interaction.deferReply();

        // Security: Validate channel name format
        if (!interaction.channel.name.startsWith('ticket-')) {
          await interaction.editReply({ content: "❌ This command can only be used in ticket channels." });
          securityLog('INVALID_CLOSE_ATTEMPT', interaction.user.id, '- Not a ticket channel');
          return;
        }

        // Allow ticket creator or users with manage channels permission to close
        const sanitizedUsername = sanitizeInput(interaction.user.username).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
        const isTicketOwner = interaction.channel.name.includes(sanitizedUsername.toLowerCase());
        const hasPermission = interaction.member.permissions.has(Discord.PermissionFlagsBits.ManageChannels);

        if(!hasPermission && !isTicketOwner) {
          securityLog('UNAUTHORIZED_CLOSE_ATTEMPT', interaction.user.id);
          await interaction.editReply({ 
            content: "❌ You can only close your own tickets or need manage channels permission." 
          });
          return; // Exit immediately after unauthorized attempt
        }

        const closeEmbed = new Discord.EmbedBuilder()
          .setTitle("🔒 Ticket Closed")
          .setDescription(`This ticket has been closed by ${interaction.user}.\nChannel will be deleted in 5 seconds.`)
          .setColor(0xFF0000);

        await interaction.editReply({ embeds: [closeEmbed] });

        setTimeout(async () => {
          try {
            securityLog('TICKET_DELETED', interaction.user.id, `- Channel: ${interaction.channel.name}`);
            await interaction.channel.delete();
          } catch (deleteError) {
            console.error('Error deleting channel:', deleteError);
            securityLog('TICKET_DELETE_ERROR', interaction.user.id, `- Error: ${deleteError.message}`);
          }
        }, 5000);
      } catch (error) {
        console.error('Error closing ticket:', error);
        securityLog('TICKET_CLOSE_ERROR', interaction.user.id, `- Error: ${error.message}`);
        if (!interaction.replied && !interaction.deferred) {
          try {
            await interaction.reply({ 
              content: `❌ Failed to close ticket.`, 
              ephemeral: true 
            });
          } catch (replyError) {
            console.error('Failed to send close ticket error reply:', replyError);
          }
        } else {
          try {
            await interaction.editReply({ 
              content: `❌ Failed to close ticket.` 
            });
          } catch (editError) {
            console.error('Failed to edit close ticket error reply:', editError);
          }
        }
      }
    }
  }
  } catch (globalError) {
    console.error('Global interaction error:', globalError);
    securityLog('GLOBAL_INTERACTION_ERROR', interaction.user?.id || 'unknown', `- Error: ${globalError.message}`);

    // Only try to respond if the interaction is still valid and not already handled
    if (globalError.code !== 10062 && globalError.code !== 40060 && globalError.code !== 10008) {
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        } else if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({ content: "❌ An unexpected error occurred." });
        }
      } catch (errorHandlingError) {
        // Silently log this error to avoid spam
        console.error('Failed to handle interaction error:', errorHandlingError.message);
      }
    }
  }
});

client.login(process.env.token);
