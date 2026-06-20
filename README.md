# Black Beacon Games Discord Bot

A multifunctional Discord bot built with **discord.js v14** that provides member count tracking, leveling, ticketing, self-roles, temporary voice channels, and more.

## Features

### 📊 Member Counter
Automatically updates a channel name with the current member count (e.g., `ℹ️･Information | 42`). The name template and update interval are configurable in `config.json`.

### 🎮 Leveling & XP System
- Earn random XP (15–25 per message, configurable) for sending messages in text channels.
- XP cooldown per user to prevent spam (1 second by default).
- Configurable level formula and progress bar display.
- Level roles are automatically assigned/removed as users level up.
- `/level` slash command shows your current level, XP, and progress to next level.
- Leaderboard channel that updates automatically, displaying the top N members by XP and level.
- `ignoredChannelIds` and `ignoredRoleIds` to exclude certain channels or roles from XP gain.

### 🎟️ Ticket System
- A support ticket panel with a "Create Ticket" button.
- Creates a private text channel under a configured category.
- "Claim Ticket" and "Delete Ticket" buttons inside each ticket.
- Claiming assigns a staff member to the ticket and logs it.
- Deleting removes the ticket after a 5-second delay.
- Only users with the configured ticket claim role can delete or claim tickets.

### 👤 Self Roles
- A configurable panel of buttons that users can click to add/remove roles themselves.
- Roles are defined in the `selfRoles` array in `config.json`.
- Up to 5 roles per row (Discord's action row limit).
- Logs role additions and removals.

### 🎤 Temporary Voice Channels
- When a user joins the configured "join to create" voice channel, a temporary voice channel is created for them.
- The channel owner gets `Manage Channels` and `Move Members` permissions.
- Empty temporary voice channels are automatically deleted.

### 👋 Welcome Messages & Join Roles
- Sends a welcome embed when a new member joins.
- Automatically assigns a configured join role.
- Logs member leaves.

### 🚀 Promotion Command
- `/promote <user> <role>` – Assigns a role to a member and posts an @everyone announcement in the configured channel.
- Requires "Manage Roles" permission to use.
- Checks role hierarchy and bot permissions before assigning.

### 📝 Logging
All important events (ticket creation/deletion/claiming, self-role changes, temp voice creation/deletion, member leaves, promotions) are logged to a configurable log channel.

## Requirements

- **Node.js** >= 18
- A Discord Bot Application with the appropriate intents and permissions

## Setup

1. **Clone the repository**

2. **Install dependencies**
   ```
   npm install
   ```

3. **Configure `config.json`**

   | Key | Description |
   |---|---|
   | `token` | Your Discord bot token |
   | `guildId` | The Discord server (guild) ID |
   | `welcomeChannelId` | Channel for welcome messages |
   | `logChannelId` | Channel for log messages |
   | `infoChannelId` | Channel to rename with member count |
   | `joinRoleId` | Role assigned to new members |
   | `promoteAnnouncementChannelId` | Channel for /promote announcements |
   | `ticketPanelChannelId` | Channel containing the ticket panel |
   | `ticketCategoryId` | Category where ticket channels are created |
   | `ticketClaimRoleId` | Role allowed to claim/delete tickets |
   | `selfRolesChannelId` | Channel containing the self-roles panel |
   | `tempVoiceJoinChannelId` | Voice channel users join to create a temp channel |
   | `tempVoiceCategoryId` | Category where temp voice channels are created |
   | `leaderboardChannelId` | Channel for the level leaderboard |
   | `leaderboardUpdateSeconds` | Leaderboard update interval (default: 1) |
   | `leaderboardLimit` | Number of entries in the leaderboard (max: 50) |
   | `updateIntervalSeconds` | Info channel name update interval (min: 5) |
   | `channelNameTemplate` | Template with `{count}` placeholder (e.g., `ℹ️･Info \| {count}`) |
   | `selfRoles` | Array of `{ label, roleId }` for self-assignable roles |
   | `levelSystem` | XP/level configuration (see below) |

   **Level System Options:**

   ```json
   {
     "levelSystem": {
       "minMessageXp": 15,
       "maxMessageXp": 25,
       "cooldownSeconds": 1,
       "baseXp": 100,
       "levelExponent": 1.5,
       "progressBarLength": 10,
       "embedColor": "#2f80ed",
       "syncExistingMembersOnStart": true,
       "ignoreBots": true,
       "ignoredChannelIds": [],
       "ignoredRoleIds": [],
       "levelRoles": []
     }
   }
   ```

4. **Invite the bot to your server**

   Ensure the bot has the following permissions:
   - Manage Roles
   - Manage Channels
   - Move Members
   - Send Messages
   - Read Message History
   - View Channels
   - Embed Links
   - Attach Files

   Required intents: `Guilds`, `GuildMembers`, `GuildMessages`, `GuildVoiceStates` (and `MessageContent` if needed).

5. **Start the bot**
   ```
   npm start
   ```

## Slash Commands

| Command | Description |
|---|---|
| `/level` | Shows your current level, XP, and progress |
| `/promote <user> <role>` | Promotes a user to a role (requires Manage Roles) |

## File Structure

```
├── config.json         # Bot configuration
├── index.js            # Main bot code
├── server.js           # Entry wrapper (require index.js)
├── package.json        # Dependencies
├── data/
│   └── level.json      # Persisted XP/level data (auto-created)
└── README.md
```
