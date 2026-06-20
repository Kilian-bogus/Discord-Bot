const fs = require("node:fs");
const path = require("node:path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  SlashCommandBuilder
} = require("discord.js");

const configPath = path.join(__dirname, "config.json");
const dataDirectory = path.join(__dirname, "data");
const levelDataPath = path.join(dataDirectory, "level.json");
const BOT_VERSION = "1.2.0";
const OPEN_TICKET_BUTTON_ID = "ticket:create";
const DELETE_TICKET_BUTTON_ID = "ticket:delete";
const CLAIM_TICKET_BUTTON_ID = "ticket:claim";
const SELF_ROLE_BUTTON_PREFIX = "selfrole:";

if (!fs.existsSync(configPath)) {
  console.error("config.json was not found. Create config.json and add your bot token and server settings.");
  process.exit(1);
}

const config = require(configPath);

const requiredConfigKeys = [
  "token",
  "guildId",
  "welcomeChannelId",
  "logChannelId",
  "infoChannelId",
  "joinRoleId",
  "promoteAnnouncementChannelId",
  "ticketPanelChannelId",
  "ticketCategoryId",
  "ticketClaimRoleId",
  "selfRolesChannelId",
  "tempVoiceJoinChannelId",
  "tempVoiceCategoryId",
  "leaderboardChannelId",
  "leaderboardUpdateSeconds",
  "leaderboardLimit",
  "updateIntervalSeconds",
  "channelNameTemplate"
];

for (const key of requiredConfigKeys) {
  if (!config[key]) {
    console.error(`config.json is missing the value for "${key}".`);
    process.exit(1);
  }
}

if (config.token === "DEIN_BOT_TOKEN_HIER") {
  console.error("Please add your real bot token to config.json first.");
  process.exit(1);
}

function getNumberConfig(value, fallback, minimum = 0) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < minimum) {
    return fallback;
  }

  return number;
}

function getEmbedColorConfig(value) {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) {
    return value;
  }

  return "#2f80ed";
}

function getStringArrayConfig(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(String).filter(Boolean);
}

function getLevelRolesConfig(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => ({
      level: Math.floor(getNumberConfig(entry?.level, 0, 1)),
      roleId: String(entry?.roleId ?? "")
    }))
    .filter((entry) => entry.level > 0 && entry.roleId)
    .sort((a, b) => a.level - b.level);
}

function getSelfRolesConfig() {
  if (!Array.isArray(config.selfRoles)) {
    return [];
  }

  return config.selfRoles
    .map((entry) => ({
      label: String(entry?.label ?? "").trim(),
      roleId: String(entry?.roleId ?? "").trim()
    }))
    .filter((entry) => entry.label && entry.roleId);
}

function getLevelSettings() {
  const levelSystem = config.levelSystem ?? {};
  const minMessageXp = Math.floor(getNumberConfig(levelSystem.minMessageXp, 15, 0));
  const maxMessageXp = Math.floor(getNumberConfig(levelSystem.maxMessageXp, 25, minMessageXp));

  return {
    minMessageXp,
    maxMessageXp,
    cooldownMs: getNumberConfig(levelSystem.cooldownSeconds, 60, 0) * 1000,
    baseXp: getNumberConfig(levelSystem.baseXp, 100, 1),
    levelExponent: getNumberConfig(levelSystem.levelExponent, 1.5, 0.1),
    progressBarLength: Math.floor(getNumberConfig(levelSystem.progressBarLength, 10, 1)),
    embedColor: getEmbedColorConfig(levelSystem.embedColor),
    syncExistingMembersOnStart: levelSystem.syncExistingMembersOnStart !== false,
    ignoreBots: levelSystem.ignoreBots !== false,
    ignoredChannelIds: getStringArrayConfig(levelSystem.ignoredChannelIds),
    ignoredRoleIds: getStringArrayConfig(levelSystem.ignoredRoleIds),
    levelRoles: getLevelRolesConfig(levelSystem.levelRoles)
  };
}

const levelSettings = getLevelSettings();
const selfRoles = getSelfRolesConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.GuildMember]
});

let updateTimer = null;
let leaderboardTimer = null;
let isUpdatingChannel = false;
let isUpdatingLeaderboard = false;
const xpCooldowns = new Map();

function ensureLevelDataFile() {
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
  }

  if (!fs.existsSync(levelDataPath)) {
    fs.writeFileSync(levelDataPath, JSON.stringify({ users: {} }, null, 2));
  }
}

function loadLevelData() {
  ensureLevelDataFile();

  try {
    const parsedData = JSON.parse(fs.readFileSync(levelDataPath, "utf8"));
    return {
      users: parsedData.users && typeof parsedData.users === "object" ? parsedData.users : {}
    };
  } catch (error) {
    console.error("Could not read level.json:", error);
    return { users: {} };
  }
}

function saveLevelData(levelData) {
  ensureLevelDataFile();
  fs.writeFileSync(levelDataPath, JSON.stringify(levelData, null, 2));
}

function getOrCreateUserLevelData(levelData, userId, username = "Unbekannt") {
  if (!levelData.users[userId]) {
    levelData.users[userId] = {
      xp: 0,
      username,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    };
  }

  levelData.users[userId].username = username;
  levelData.users[userId].lastSeenAt = new Date().toISOString();

  return levelData.users[userId];
}

function getRequiredXpForLevel(level) {
  return Math.floor(levelSettings.baseXp * Math.pow(level, levelSettings.levelExponent));
}

function getLevelFromXp(xp) {
  let level = 0;

  while (xp >= getRequiredXpForLevel(level + 1)) {
    level += 1;
  }

  return level;
}

function getRandomMessageXp() {
  return Math.floor(Math.random() * (levelSettings.maxMessageXp - levelSettings.minMessageXp + 1)) + levelSettings.minMessageXp;
}

function createProgressBar(currentXp, currentLevel) {
  const currentLevelXp = getRequiredXpForLevel(currentLevel);
  const nextLevelXp = getRequiredXpForLevel(currentLevel + 1);
  const levelProgress = currentXp - currentLevelXp;
  const levelNeeded = nextLevelXp - currentLevelXp;
  const filledBlocks = Math.min(
    levelSettings.progressBarLength,
    Math.max(0, Math.floor((levelProgress / levelNeeded) * levelSettings.progressBarLength))
  );

  return "[" + "#".repeat(filledBlocks) + "-".repeat(levelSettings.progressBarLength - filledBlocks) + "]";
}

function isXpIgnoredChannel(channelId) {
  return levelSettings.ignoredChannelIds.includes(channelId);
}

function hasIgnoredXpRole(member) {
  if (!member || levelSettings.ignoredRoleIds.length === 0) {
    return false;
  }

  return levelSettings.ignoredRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

async function sendLevelUpMessage(message, level, xp) {
  const nextLevelXp = getRequiredXpForLevel(level + 1);
  const embed = new EmbedBuilder()
    .setColor(levelSettings.embedColor)
    .setAuthor({
      name: "Level Up!",
      iconURL: message.author.displayAvatarURL({ size: 128 })
    })
    .setTitle(`${message.author.username} reached level ${level}`)
    .setDescription(`Nice work, <@${message.author.id}>! You now have **${xp} XP**.`)
    .addFields({ name: "Next Level", value: `${nextLevelXp} XP`, inline: true })
    .setTimestamp();

  await message.channel.send({ embeds: [embed] });
}

function getLevelRoleForLevel(level) {
  let selectedLevelRole = null;

  for (const levelRole of levelSettings.levelRoles) {
    if (level >= levelRole.level) {
      selectedLevelRole = levelRole;
    }
  }

  return selectedLevelRole;
}

async function updateMemberLevelRole(member, level) {
  if (!member || levelSettings.levelRoles.length === 0) {
    return;
  }

  try {
    const botMember = await member.guild.members.fetchMe();
    const canManageRoles = botMember.permissions.has(PermissionsBitField.Flags.ManageRoles);

    if (!canManageRoles) {
      console.warn("The bot cannot manage level roles. Check the 'Manage Roles' permission.");
      return;
    }

    const selectedLevelRole = getLevelRoleForLevel(level);
    const configuredRoleIds = levelSettings.levelRoles.map((levelRole) => levelRole.roleId);
    const rolesToRemove = configuredRoleIds.filter((roleId) => roleId !== selectedLevelRole?.roleId && member.roles.cache.has(roleId));

    for (const roleId of rolesToRemove) {
      const role = await member.guild.roles.fetch(roleId);

      if (role && role.position < botMember.roles.highest.position) {
        await member.roles.remove(role, "Old level role removed");
      }
    }

    if (!selectedLevelRole || member.roles.cache.has(selectedLevelRole.roleId)) {
      return;
    }

    const roleToAdd = await member.guild.roles.fetch(selectedLevelRole.roleId);

    if (!roleToAdd) {
      console.warn(`Level role ${selectedLevelRole.roleId} was not found.`);
      return;
    }

    if (roleToAdd.position >= botMember.roles.highest.position) {
      console.warn(`The bot cannot assign level role ${selectedLevelRole.roleId}. Check the role hierarchy.`);
      return;
    }

    await member.roles.add(roleToAdd, `Reached level ${selectedLevelRole.level}`);
  } catch (error) {
    console.error(`Could not update level roles for ${member.user?.tag ?? member.id}:`, error);
  }
}

async function rememberCurrentMembers() {
  try {
    const guild = await fetchConfiguredGuild();
    const members = await guild.members.fetch();
    const levelData = loadLevelData();

    for (const member of members.values()) {
      if (!levelSettings.ignoreBots || !member.user.bot) {
        const userData = getOrCreateUserLevelData(levelData, member.id, member.user.username);
        await updateMemberLevelRole(member, getLevelFromXp(userData.xp));
      }
    }

    saveLevelData(levelData);
    const syncedMemberCount = members.filter((member) => !levelSettings.ignoreBots || !member.user.bot).size;
    console.log(`${syncedMemberCount} members synced to level.json.`);
  } catch (error) {
    console.error("Could not sync members to level.json:", error);
  }
}

async function registerGuildCommands() {
  const levelCommand = new SlashCommandBuilder()
    .setName("level")
    .setDescription("Shows your current level and XP.");

  const promoteCommand = new SlashCommandBuilder()
    .setName("promote")
    .setDescription("Promote a member to a role.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to promote.")
        .setRequired(true)
    )
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("The role to assign.")
        .setRequired(true)
    );

  try {
    const guild = await fetchConfiguredGuild();
    await guild.commands.set([levelCommand.toJSON(), promoteCommand.toJSON()]);
    console.log("/level and /promote were registered.");
  } catch (error) {
    console.error("Could not register slash commands:", error);
  }
}

function getUpdateIntervalMs() {
  const seconds = Number(config.updateIntervalSeconds);

  if (!Number.isFinite(seconds) || seconds < 5) {
    return 60_000;
  }

  return seconds * 1000;
}

function getLeaderboardUpdateIntervalMs() {
  const seconds = Number(config.leaderboardUpdateSeconds);

  if (!Number.isFinite(seconds) || seconds < 1) {
    return 60_000;
  }

  return seconds * 1000;
}

function getLeaderboardLimit() {
  const limit = Number(config.leaderboardLimit);

  if (!Number.isFinite(limit) || limit < 1) {
    return 25;
  }

  return Math.min(50, Math.floor(limit));
}

async function fetchConfiguredGuild() {
  return client.guilds.fetch(config.guildId);
}

async function sendEmbedToChannel(guild, channelId, embed, content = null) {
  try {
    const channel = await guild.channels.fetch(channelId);

    if (!channel || typeof channel.send !== "function") {
      console.warn(`Log channel ${channelId} was not found or is not a text channel.`);
      return;
    }

    await channel.send({
      content,
      embeds: [embed],
      allowedMentions: { parse: ["users", "roles", "everyone"] }
    });
  } catch (error) {
    console.error(`Could not send message to channel ${channelId}:`, error);
  }
}

async function sendWelcomeMessage(member) {
  const embed = new EmbedBuilder()
    .setColor(0x27ae60)
    .setTitle("Welcome!")
    .setDescription(`Welcome to the server, <@${member.id}>.`)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `Member ID: ${member.id}` })
    .setTimestamp();

  await sendEmbedToChannel(member.guild, config.welcomeChannelId, embed, `<@${member.id}>`);
}

async function sendLogMessage(guild, title, description, color = 0x2f80ed, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  await sendEmbedToChannel(guild, config.logChannelId, embed);
}

function getLeaderboardEntries() {
  const levelData = loadLevelData();

  return Object.entries(levelData.users)
    .map(([userId, userData]) => {
      const xp = Number(userData.xp) || 0;
      const level = getLevelFromXp(xp);

      return {
        userId,
        username: userData.username || "Unknown User",
        xp,
        level
      };
    })
    .sort((a, b) => b.level - a.level || b.xp - a.xp || a.username.localeCompare(b.username))
    .slice(0, getLeaderboardLimit());
}

function createLeaderboardEmbed(entries) {
  const description = entries.length > 0
    ? entries
      .map((entry, index) => {
        const rank = index + 1;
        return `**#${rank}** <@${entry.userId}> - Level **${entry.level}** | **${entry.xp} XP**`;
      })
      .join("\n")
    : "No XP data yet.";

  return new EmbedBuilder()
    .setColor(levelSettings.embedColor)
    .setTitle("Level Leaderboard")
    .setDescription(description)
    .setFooter({
      text: `Top ${getLeaderboardLimit()} | Updates every ${Math.round(getLeaderboardUpdateIntervalMs() / 1000)} seconds`
    })
    .setTimestamp();
}

async function updateLeaderboard() {
  if (isUpdatingLeaderboard) {
    return;
  }

  isUpdatingLeaderboard = true;

  try {
    const guild = await fetchConfiguredGuild();
    const leaderboardChannel = await guild.channels.fetch(config.leaderboardChannelId);

    if (!leaderboardChannel || typeof leaderboardChannel.send !== "function") {
      console.warn(`Leaderboard channel ${config.leaderboardChannelId} was not found or is not a text channel.`);
      return;
    }

    const embed = createLeaderboardEmbed(getLeaderboardEntries());
    const recentMessages = await leaderboardChannel.messages.fetch({ limit: 50 });
    const existingLeaderboard = recentMessages.find((message) =>
      message.author.id === client.user.id &&
      message.embeds.some((messageEmbed) => messageEmbed.title === "Level Leaderboard")
    );

    if (existingLeaderboard) {
      await existingLeaderboard.edit({ embeds: [embed] });
      return;
    }

    await leaderboardChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Could not update leaderboard:", error);
  } finally {
    isUpdatingLeaderboard = false;
  }
}

async function updateInfoChannel() {
  if (isUpdatingChannel) {
    return;
  }

  isUpdatingChannel = true;

  try {
    const guild = await fetchConfiguredGuild();
    const channel = await guild.channels.fetch(config.infoChannelId);

    if (!channel) {
      console.warn(`Channel ${config.infoChannelId} was not found.`);
      return;
    }

    if (typeof channel.setName !== "function") {
      console.warn(`Channel ${config.infoChannelId} cannot be renamed. Type: ${channel.type}`);
      return;
    }

    const memberCount = guild.memberCount;
    const nextName = config.channelNameTemplate.replace("{count}", String(memberCount));

    if (channel.name === nextName) {
      return;
    }

    await channel.setName(nextName, "Member count updated");
    console.log(`Info channel updated: ${nextName}`);
  } catch (error) {
    console.error("Could not update info channel:", error);
  } finally {
    isUpdatingChannel = false;
  }
}

async function giveJoinRole(member) {
  if (member.guild.id !== config.guildId) {
    return;
  }

  try {
    const levelData = loadLevelData();
    getOrCreateUserLevelData(levelData, member.id, member.user.username);
    saveLevelData(levelData);

    const role = await member.guild.roles.fetch(config.joinRoleId);

    if (!role) {
      console.warn(`Role ${config.joinRoleId} was not found.`);
      return;
    }

    const botMember = await member.guild.members.fetchMe();
    const canManageRoles = botMember.permissions.has(PermissionsBitField.Flags.ManageRoles);
    const roleIsBelowBot = role.position < botMember.roles.highest.position;

    if (!canManageRoles || !roleIsBelowBot) {
      console.warn("The bot cannot assign the join role. Check the 'Manage Roles' permission and role hierarchy.");
      return;
    }

    await member.roles.add(role, "Automatic join role");
    console.log(`Join role assigned to ${member.user.tag}.`);
  } catch (error) {
    console.error(`Could not assign join role to ${member.user?.tag ?? member.id}:`, error);
  }
}

async function handlePromoteCommand(interaction) {
  if (!interaction.guild || interaction.guild.id !== config.guildId) {
    await interaction.reply({ content: "This command is only available on the configured server.", ephemeral: true });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageRoles)) {
    await interaction.reply({ content: "You need the 'Manage Roles' permission to promote someone.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const targetUser = interaction.options.getUser("user", true);
    const role = interaction.options.getRole("role", true);
    const targetMember = await interaction.guild.members.fetch(targetUser.id);
    const botMember = await interaction.guild.members.fetchMe();

    if (role.id === interaction.guild.id) {
      await interaction.editReply("The @everyone role cannot be assigned.");
      return;
    }

    if (role.managed) {
      await interaction.editReply("This role is managed by Discord or an integration and cannot be assigned manually.");
      return;
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      await interaction.editReply("The bot needs the 'Manage Roles' permission.");
      return;
    }

    if (role.position >= botMember.roles.highest.position) {
      await interaction.editReply("This role is too high. The bot role must be above the role that should be assigned.");
      return;
    }

    if (role.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      await interaction.editReply("You can only assign roles below your highest role.");
      return;
    }

    if (!targetMember.roles.cache.has(role.id)) {
      await targetMember.roles.add(role, `Promoted by ${interaction.user.tag}`);
    }

    const announcementChannel = await interaction.guild.channels.fetch(config.promoteAnnouncementChannelId);

    if (!announcementChannel || typeof announcementChannel.send !== "function") {
      await interaction.editReply("The role was assigned, but the promotion announcement channel was not found or is not a text channel.");
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xf2c94c)
      .setAuthor({
        name: "Promotion",
        iconURL: targetUser.displayAvatarURL({ size: 128 })
      })
      .setTitle("A New Rank Has Been Granted!")
      .setDescription(`<@${targetUser.id}> has been promoted to <@&${role.id}>.`)
      .addFields({ name: "Promoted by", value: `<@${interaction.user.id}>`, inline: true })
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    await announcementChannel.send({
      content: "@everyone",
      embeds: [embed],
      allowedMentions: { parse: ["everyone", "roles", "users"] }
    });

    await sendLogMessage(
      interaction.guild,
      "Promotion Log",
      `<@${targetUser.id}> was promoted to <@&${role.id}> by <@${interaction.user.id}>.`,
      0xf2c94c
    );

    await interaction.editReply(`${targetUser.tag} was promoted to ${role.name} and the announcement was posted.`);
  } catch (error) {
    console.error("Could not run /promote:", error);
    await interaction.editReply("Something went wrong while promoting. Check role hierarchy, permissions, and channel ID.");
  }
}

function createTicketPanelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(OPEN_TICKET_BUTTON_ID)
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

function createTicketDeleteComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(CLAIM_TICKET_BUTTON_ID)
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(DELETE_TICKET_BUTTON_ID)
        .setLabel("Delete Ticket")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

function createTicketChannelName(username) {
  const safeUsername = username
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return `ticket-${safeUsername || "user"}`;
}

async function setupTicketPanel() {
  try {
    const guild = await fetchConfiguredGuild();
    const panelChannel = await guild.channels.fetch(config.ticketPanelChannelId);

    if (!panelChannel || typeof panelChannel.send !== "function") {
      console.warn(`Ticket panel channel ${config.ticketPanelChannelId} was not found or is not a text channel.`);
      return;
    }

    const recentMessages = await panelChannel.messages.fetch({ limit: 50 });
    const existingPanel = recentMessages.find((message) =>
      message.author.id === client.user.id &&
      message.components.some((row) =>
        row.components.some((component) => component.customId === OPEN_TICKET_BUTTON_ID)
      )
    );

    if (existingPanel) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x27ae60)
      .setTitle("Support Ticket")
      .setDescription("Need help? Press the button to create a private ticket.")
      .setFooter({ text: "Please describe your request right after opening the ticket." })
      .setTimestamp();

    await panelChannel.send({
      embeds: [embed],
      components: createTicketPanelComponents()
    });

    console.log("Ticket panel was posted.");
  } catch (error) {
    console.error("Could not set up ticket panel:", error);
  }
}

async function findOpenTicketForUser(guild, userId) {
  const channels = await guild.channels.fetch();

  return channels.find((channel) =>
    channel?.type === ChannelType.GuildText &&
    channel.parentId === config.ticketCategoryId &&
    channel.topic?.split(";").includes(`ticket-owner:${userId}`)
  );
}

async function handleCreateTicket(interaction) {
  if (!interaction.guild || interaction.guild.id !== config.guildId) {
    await interaction.reply({ content: "Tickets can only be created on the configured server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const existingTicket = await findOpenTicketForUser(interaction.guild, interaction.user.id);

    if (existingTicket) {
      await interaction.editReply(`You already have an open ticket: <#${existingTicket.id}>`);
      return;
    }

    const botMember = await interaction.guild.members.fetchMe();

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      await interaction.editReply("The bot needs the 'Manage Channels' permission to create tickets.");
      return;
    }

    const ticketChannel = await interaction.guild.channels.create({
      name: createTicketChannelName(interaction.user.username),
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId,
      topic: `ticket-owner:${interaction.user.id}`,
      reason: `Ticket created by ${interaction.user.tag}`,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.EmbedLinks
          ]
        },
        {
          id: client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels
          ]
        }
      ]
    });

    const embed = new EmbedBuilder()
      .setColor(0x2f80ed)
      .setTitle("Ticket Opened")
      .setDescription(`Welcome <@${interaction.user.id}>. Please describe your request as clearly as possible.`)
      .addFields({ name: "Close Ticket", value: "When everything is done, use the button below." })
      .setTimestamp();

    await ticketChannel.send({
      content: `<@${interaction.user.id}>`,
      embeds: [embed],
      components: createTicketDeleteComponents()
    });

    await sendLogMessage(
      interaction.guild,
      "Ticket Created",
      `<@${interaction.user.id}> created ticket <#${ticketChannel.id}>.`,
      0x27ae60
    );

    await interaction.editReply(`Your ticket has been created: <#${ticketChannel.id}>`);
  } catch (error) {
    console.error("Could not create ticket:", error);
    await interaction.editReply("Could not create ticket. Check category ID and bot permissions.");
  }
}

async function handleDeleteTicket(interaction) {
  if (!interaction.guild || interaction.guild.id !== config.guildId) {
    await interaction.reply({ content: "This button can only be used on the configured server.", ephemeral: true });
    return;
  }

  if (interaction.channel?.parentId !== config.ticketCategoryId || !interaction.channel?.topic?.startsWith("ticket-owner:")) {
    await interaction.reply({ content: "This button can only be used inside a ticket.", ephemeral: true });
    return;
  }

  if (!interaction.member?.roles?.cache?.has(config.ticketClaimRoleId)) {
    await interaction.reply({ content: "Only ticket team members can delete this ticket.", ephemeral: true });
    return;
  }

  await interaction.reply({ content: "Ticket will be deleted in 5 seconds.", ephemeral: true });
  await sendLogMessage(
    interaction.guild,
    "Ticket Deleted",
    `<#${interaction.channel.id}> was deleted by <@${interaction.user.id}>.`,
    0xeb5757
  );

  setTimeout(() => {
    interaction.channel.delete(`Ticket deleted by ${interaction.user.tag}`).catch((error) => {
      console.error("Could not delete ticket:", error);
    });
  }, 5000);
}

async function handleClaimTicket(interaction) {
  if (!interaction.guild || interaction.guild.id !== config.guildId) {
    await interaction.reply({ content: "This button can only be used on the configured server.", ephemeral: true });
    return;
  }

  if (interaction.channel?.parentId !== config.ticketCategoryId || !interaction.channel?.topic?.startsWith("ticket-owner:")) {
    await interaction.reply({ content: "This button can only be used inside a ticket.", ephemeral: true });
    return;
  }

  if (!interaction.member?.roles?.cache?.has(config.ticketClaimRoleId)) {
    await interaction.reply({ content: "You do not have permission to claim tickets.", ephemeral: true });
    return;
  }

  const topicParts = interaction.channel.topic.split(";");

  if (topicParts.some((part) => part === `claimed-by:${interaction.user.id}`)) {
    await interaction.reply({ content: "You already claimed this ticket.", ephemeral: true });
    return;
  }

  const ownerPart = topicParts.find((part) => part.startsWith("ticket-owner:"));
  await interaction.channel.setTopic(`${ownerPart};claimed-by:${interaction.user.id}`, `Ticket claimed by ${interaction.user.tag}`);

  const embed = new EmbedBuilder()
    .setColor(0x27ae60)
    .setTitle("Ticket Claimed")
    .setDescription(`<@${interaction.user.id}> has claimed this ticket.`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
  await sendLogMessage(interaction.guild, "Ticket Claimed", `<@${interaction.user.id}> claimed <#${interaction.channel.id}>.`, 0x27ae60);
}

async function handleTicketButton(interaction) {
  if (interaction.customId === OPEN_TICKET_BUTTON_ID) {
    await handleCreateTicket(interaction);
    return;
  }

  if (interaction.customId === CLAIM_TICKET_BUTTON_ID) {
    await handleClaimTicket(interaction);
    return;
  }

  if (interaction.customId === DELETE_TICKET_BUTTON_ID) {
    await handleDeleteTicket(interaction);
  }
}

function createSelfRoleComponents() {
  const rows = [];

  for (let index = 0; index < selfRoles.length; index += 5) {
    const row = new ActionRowBuilder();
    const group = selfRoles.slice(index, index + 5);

    for (const selfRole of group) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${SELF_ROLE_BUTTON_PREFIX}${selfRole.roleId}`)
          .setLabel(selfRole.label)
          .setStyle(ButtonStyle.Secondary)
      );
    }

    rows.push(row);
  }

  return rows;
}

async function setupSelfRolesPanel() {
  if (selfRoles.length === 0) {
    return;
  }

  try {
    const guild = await fetchConfiguredGuild();
    const selfRolesChannel = await guild.channels.fetch(config.selfRolesChannelId);

    if (!selfRolesChannel || typeof selfRolesChannel.send !== "function") {
      console.warn(`Self roles channel ${config.selfRolesChannelId} was not found or is not a text channel.`);
      return;
    }

    const recentMessages = await selfRolesChannel.messages.fetch({ limit: 50 });
    const existingPanel = recentMessages.find((message) =>
      message.author.id === client.user.id &&
      message.components.some((row) =>
        row.components.some((component) => component.customId?.startsWith(SELF_ROLE_BUTTON_PREFIX))
      )
    );

    if (existingPanel) {
      return;
    }

    const roleList = selfRoles.map((selfRole) => `- ${selfRole.label}`).join("\n");
    const embed = new EmbedBuilder()
      .setColor(0x9b51e0)
      .setTitle("Self Roles")
      .setDescription(`Choose which news updates you want to receive.\n\n${roleList}`)
      .setFooter({ text: "Click a role again to remove it." })
      .setTimestamp();

    await selfRolesChannel.send({
      embeds: [embed],
      components: createSelfRoleComponents()
    });

    console.log("Self roles panel was posted.");
  } catch (error) {
    console.error("Could not set up self roles panel:", error);
  }
}

async function handleSelfRoleButton(interaction) {
  if (!interaction.guild || interaction.guild.id !== config.guildId) {
    await interaction.reply({ content: "Self roles can only be used on the configured server.", ephemeral: true });
    return;
  }

  const roleId = interaction.customId.slice(SELF_ROLE_BUTTON_PREFIX.length);
  const selfRole = selfRoles.find((entry) => entry.roleId === roleId);

  if (!selfRole) {
    await interaction.reply({ content: "This self role is no longer configured.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const role = await interaction.guild.roles.fetch(roleId);
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const botMember = await interaction.guild.members.fetchMe();

    if (!role) {
      await interaction.editReply("This role was not found.");
      return;
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      await interaction.editReply("The bot needs the 'Manage Roles' permission.");
      return;
    }

    if (role.position >= botMember.roles.highest.position) {
      await interaction.editReply("This role is too high. The bot role must be above the self role.");
      return;
    }

    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, "Self role removed");
      await sendLogMessage(interaction.guild, "Self Role Removed", `<@${interaction.user.id}> removed <@&${role.id}>.`, 0xeb5757);
      await interaction.editReply(`${selfRole.label} was removed.`);
      return;
    }

    await member.roles.add(role, "Self role assigned");
    await sendLogMessage(interaction.guild, "Self Role Added", `<@${interaction.user.id}> added <@&${role.id}>.`, 0x27ae60);
    await interaction.editReply(`${selfRole.label} was added.`);
  } catch (error) {
    console.error("Could not update self role:", error);
    await interaction.editReply("Could not update self role. Check bot permissions and role hierarchy.");
  }
}

function createTempVoiceChannelName(username) {
  const safeUsername = username
    .replace(/[^a-zA-Z0-9 -]/g, "")
    .trim()
    .slice(0, 40);

  return `${safeUsername || "User"}'s Voice`;
}

function isTempVoiceChannel(channel) {
  return (
    channel?.type === ChannelType.GuildVoice &&
    channel.parentId === config.tempVoiceCategoryId &&
    channel.name.endsWith("'s Voice")
  );
}

async function createTempVoiceChannel(member) {
  try {
    const guild = member.guild;
    const botMember = await guild.members.fetchMe();

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      console.warn("The bot needs the 'Manage Channels' permission to create temporary voice channels.");
      return;
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.MoveMembers)) {
      console.warn("The bot needs the 'Move Members' permission to move users into temporary voice channels.");
      return;
    }

    const tempVoiceChannel = await guild.channels.create({
      name: createTempVoiceChannelName(member.user.username),
      type: ChannelType.GuildVoice,
      parent: config.tempVoiceCategoryId,
      reason: `Temporary voice channel created for ${member.user.tag}`,
      permissionOverwrites: [
        {
          id: guild.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak
          ]
        },
        {
          id: member.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.MoveMembers
          ]
        },
        {
          id: client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.MoveMembers
          ]
        }
      ]
    });

    await member.voice.setChannel(tempVoiceChannel, "Moved into temporary voice channel");
    await sendLogMessage(guild, "Temp Voice Created", `<@${member.id}> created <#${tempVoiceChannel.id}>.`, 0x2f80ed);
  } catch (error) {
    console.error("Could not create temporary voice channel:", error);
  }
}

async function deleteEmptyTempVoiceChannel(channel) {
  if (!isTempVoiceChannel(channel) || channel.members.size > 0) {
    return;
  }

  try {
    const channelId = channel.id;
    await channel.delete("Temporary voice channel is empty");
    await sendLogMessage(channel.guild, "Temp Voice Deleted", `Temporary voice channel \`${channel.name}\` (${channelId}) was deleted because it was empty.`, 0xeb5757);
  } catch (error) {
    console.error("Could not delete temporary voice channel:", error);
  }
}

async function handleVoiceStateUpdate(oldState, newState) {
  if (newState.guild.id !== config.guildId) {
    return;
  }

  if (newState.channelId === config.tempVoiceJoinChannelId && oldState.channelId !== newState.channelId) {
    await createTempVoiceChannel(newState.member);
  }

  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    await deleteEmptyTempVoiceChannel(oldState.channel);
  }
}

client.once("clientReady", async () => {
  console.log(`Bot version ${BOT_VERSION} is online as ${client.user.tag}.`);
  await registerGuildCommands();
  await setupTicketPanel();
  await setupSelfRolesPanel();
  if (levelSettings.syncExistingMembersOnStart) {
    await rememberCurrentMembers();
  }
  await updateInfoChannel();
  await updateLeaderboard();

  updateTimer = setInterval(updateInfoChannel, getUpdateIntervalMs());
  leaderboardTimer = setInterval(updateLeaderboard, getLeaderboardUpdateIntervalMs());
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.guild.id !== config.guildId) {
    return;
  }

  if (levelSettings.ignoreBots && message.author.bot) {
    return;
  }

  if (isXpIgnoredChannel(message.channel.id) || hasIgnoredXpRole(message.member)) {
    return;
  }

  const cooldownKey = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const lastXpAt = xpCooldowns.get(cooldownKey) ?? 0;

  if (now - lastXpAt < levelSettings.cooldownMs) {
    return;
  }

  xpCooldowns.set(cooldownKey, now);

  const levelData = loadLevelData();
  const userData = getOrCreateUserLevelData(levelData, message.author.id, message.author.username);
  const oldLevel = getLevelFromXp(userData.xp);
  userData.xp += getRandomMessageXp();
  const newLevel = getLevelFromXp(userData.xp);
  saveLevelData(levelData);

  await updateMemberLevelRole(message.member, newLevel);

  if (newLevel > oldLevel) {
    await sendLevelUpMessage(message, newLevel, userData.xp);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith(SELF_ROLE_BUTTON_PREFIX)) {
      await handleSelfRoleButton(interaction);
      return;
    }

    await handleTicketButton(interaction);
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === "promote") {
    await handlePromoteCommand(interaction);
    return;
  }

  if (interaction.commandName !== "level") {
    return;
  }

  if (!interaction.guild || interaction.guild.id !== config.guildId) {
    await interaction.reply({ content: "This command is only available on the configured server.", ephemeral: true });
    return;
  }

  const levelData = loadLevelData();
  const userData = getOrCreateUserLevelData(levelData, interaction.user.id, interaction.user.username);
  saveLevelData(levelData);

  const xp = userData.xp;
  const level = getLevelFromXp(xp);
  const nextLevelXp = getRequiredXpForLevel(level + 1);
  const xpToNextLevel = nextLevelXp - xp;
  const progressBar = createProgressBar(xp, level);

  if (interaction.member) {
    await updateMemberLevelRole(interaction.member, level);
  }

  const embed = new EmbedBuilder()
    .setColor(levelSettings.embedColor)
    .setAuthor({
      name: `${interaction.user.username}'s Level`,
      iconURL: interaction.user.displayAvatarURL({ size: 128 })
    })
    .setTitle(`Level ${level}`)
    .setDescription(`**${progressBar}**`)
    .addFields(
      { name: "XP", value: `${xp}`, inline: true },
      { name: "Next Level", value: `${nextLevelXp} XP`, inline: true },
      { name: "XP Needed", value: `${xpToNextLevel} XP`, inline: true }
    )
    .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
    .setFooter({
      text: `${levelSettings.minMessageXp}-${levelSettings.maxMessageXp} XP per message | ${Math.round(levelSettings.cooldownMs / 1000)} second cooldown`
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
});

client.on("guildMemberAdd", async (member) => {
  await sendWelcomeMessage(member);
  await giveJoinRole(member);

  const levelData = loadLevelData();
  const userData = getOrCreateUserLevelData(levelData, member.id, member.user.username);
  await updateMemberLevelRole(member, getLevelFromXp(userData.xp));
  saveLevelData(levelData);

  await updateInfoChannel();
});

client.on("guildMemberRemove", async (member) => {
  if (member.guild.id === config.guildId) {
    await sendLogMessage(member.guild, "Member Left", `${member.user?.tag ?? member.id} left the server.`, 0xeb5757);
    await updateInfoChannel();
  }
});

client.on("voiceStateUpdate", handleVoiceStateUpdate);

client.on("error", (error) => {
  console.error("Discord client error:", error);
});

process.on("SIGINT", () => {
  if (updateTimer) {
    clearInterval(updateTimer);
  }

  if (leaderboardTimer) {
    clearInterval(leaderboardTimer);
  }

  client.destroy();
  process.exit(0);
});

client.login(config.token);
