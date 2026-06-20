# Discord Info Count Bot

Ein Discord Bot fuer deinen Server, der drei Dinge macht:

- aktualisiert automatisch einen Info-Channel mit der aktuellen Mitgliederzahl
- gibt neuen Mitgliedern automatisch eine Rolle
- speichert XP in `data/level.json` und zeigt sie mit `/level` an
- kann Mitglieder per `/promote` zu Rollen promoten und eine Announcement-Nachricht posten
- erstellt private Tickets per Button
- bietet Self Roles fuer News-Benachrichtigungen per Button
- erstellt temporaere Voice-Channels automatisch
- zeigt ein automatisch aktualisiertes Level-Leaderboard

## Funktionen

### Info-Channel

Der Bot benennt den eingestellten Channel automatisch um. Standard:

```text
\u2139\ufe0f\uff65Information | {count}
```

`{count}` wird durch die aktuelle Mitgliederzahl ersetzt.

Beispiel:

```text
ℹ️･Information | 42
```

Der Bot aktualisiert den Channel:

- beim Start
- wenn jemand joint
- wenn jemand den Server verlaesst
- zusaetzlich alle X Sekunden, je nach `updateIntervalSeconds`

Wichtig: Discord begrenzt haeufige Channel-Umbenennungen. Der Bot benennt den Channel nur um, wenn sich der Name wirklich aendert.

### Auto-Rolle

Wenn ein neues Mitglied joint, bekommt es automatisch die Rolle aus `joinRoleId`.

Damit das funktioniert:

- der Bot braucht `Manage Roles`
- die Bot-Rolle muss ueber der Rolle stehen, die vergeben werden soll
- der Bot muss auf dem richtigen Server sein

### Promote-Befehl

Mit `/promote` kannst du ein Mitglied zu einer Rolle promoten.

Der Bot:

- gibt dem ausgewaehlten Mitglied die ausgewaehlte Rolle
- postet danach eine Nachricht in den Promote-Channel `1515132964764254319`
- pingt dabei `@everyone`
- zeigt kurz, wer zu welcher Rolle promotet wurde

Nur Mitglieder mit `Manage Roles` koennen den Befehl nutzen.

### Ticket-System

Der Bot postet im Channel `1515134639596114131` automatisch eine Ticket-Nachricht mit Button.

Wenn jemand auf den Button klickt:

- wird in der Kategorie `1515134484142620732` ein privater Channel erstellt
- der Channel heisst `ticket-username`
- der Ticket-Ersteller bekommt Zugriff
- im Ticket wird eine Nachricht mit einem `Ticket loeschen` Button gepostet
- Teammitglieder mit Rolle `1515313921391595622` koennen Tickets mit `Claim Ticket` uebernehmen

Nur Teammitglieder mit Rolle `1515313921391595622` koennen Tickets schliessen oder loeschen.

### Self Roles

Der Bot postet im Channel `1515115963736002621` automatisch eine Self-Roles-Nachricht mit Buttons.

Verfuegbare Rollen:

- News: Discord `1515140381468004483`
- News: Steam `1515140296386674809`
- News: Webseite `1515140266846326844`
- News: Boardgame `1515140227008565378`

Ein Klick gibt die Rolle. Ein weiterer Klick entfernt sie wieder.

### Temp Voice

Wenn jemand den Voice-Channel `1508582132811956396` joint, erstellt der Bot automatisch einen eigenen Voice-Channel in der Kategorie `1515142823379468449`.

Der User wird direkt in den neuen Channel verschoben. Sobald niemand mehr im Temp-Voice-Channel ist, wird der Channel automatisch geloescht.

### Leaderboard

Der Bot zeigt im Channel `1515301772585996568` ein Level-Leaderboard an.

Standard:

- Top `25` Plaetze
- Aktualisierung alle `60` Sekunden
- Sortierung nach Level, danach XP

Die Anzahl der Plaetze und das Update-Intervall sind in der Config einstellbar.

### Level-System

Der Bot vergibt XP fuer Nachrichten.

Standard:

- XP pro Nachricht: `15` bis `25`
- Cooldown: `60` Sekunden pro User
- Level-Formel: `baseXp * Level^levelExponent`
- Standardformel: `100 * Level^1.5`
- Level-Up-Nachricht: wird in dem Channel gesendet, in dem der User zuletzt geschrieben hat
- Level-Rollen: ab bestimmten Meilensteinen bekommt der User eine Rolle; beim naechsten Meilenstein wird die alte Level-Rolle ersetzt

Die Daten werden hier gespeichert:

```text
data/level.json
```

In dieser Datei steht jedes Mitglied, das der Bot seit seinem Start kennt. Beim Start kann der Bot alle aktuellen Mitglieder automatisch synchronisieren.

## Installation

### 1. Dateien hochladen

Lade diese Dateien und Ordner auf deinen Server hoch:

```text
index.js
server.js
package.json
package-lock.json
config.json
src/
data/
```

`node_modules` musst du nicht hochladen. Pterodactyl installiert die Pakete automatisch mit `npm install`.

### 2. Config einstellen

Oeffne `config.json` und trage deinen Bot-Token ein:

```json
{
  "token": "DEIN_BOT_TOKEN_HIER"
}
```

Der Token gehoert nur dir. Teile ihn nie oeffentlich. Wenn er schon irgendwo sichtbar war, erstelle im Discord Developer Portal einen neuen Token.

### 3. Discord Developer Portal

Oeffne deinen Bot im Discord Developer Portal.

Aktiviere unter `Bot` diese Privileged Gateway Intents:

- `SERVER MEMBERS INTENT`

Der Bot nutzt Mitglieder-Events fuer Auto-Rolle und Mitgliedersynchronisierung.

### 4. Bot einladen

Beim Einladen sollte der Bot mindestens diese Rechte haben:

- `Manage Channels`
- `Manage Roles`
- `Move Members`
- `View Channels`
- `Send Messages`
- `Read Message History`
- `Use Slash Commands`
- `Mention Everyone`

Der OAuth2-Link muss außerdem den Scope enthalten:

```text
applications.commands
```

Sonst erscheint `/level` nicht.

## Pterodactyl

Setze in Pterodactyl bei `MAIN_FILE`:

```text
server.js
```

Dann startet das Egg den Bot mit Node.js.

Nach dem Neustart sollte im Log stehen:

```text
Bot Version 1.2.0 ist online als ...
/level und /promote wurden registriert.
Ticket-Panel wurde gepostet.
Self-Roles-Panel wurde gepostet.
```

Wenn Pterodactyl stattdessen `src/index.js` startet, ist dafuer ebenfalls eine Weiterleitungsdatei vorhanden.

## Lokaler Start

Wenn du den Bot lokal startest:

```powershell
npm install
npm start
```

## Config Erklaerung

Deine `config.json` sollte diese Werte enthalten:

```json
{
  "token": "DEIN_BOT_TOKEN_HIER",
  "guildId": "1508101612965593159",
  "welcomeChannelId": "1515132964764254319",
  "logChannelId": "1515312876749848746",
  "infoChannelId": "1508101613875761395",
  "joinRoleId": "1508109759080042646",
  "promoteAnnouncementChannelId": "1515132964764254319",
  "ticketPanelChannelId": "1515134639596114131",
  "ticketCategoryId": "1515134484142620732",
  "ticketClaimRoleId": "1515313921391595622",
  "selfRolesChannelId": "1515115963736002621",
  "tempVoiceJoinChannelId": "1508582132811956396",
  "tempVoiceCategoryId": "1515142823379468449",
  "leaderboardChannelId": "1515301772585996568",
  "leaderboardUpdateSeconds": 60,
  "leaderboardLimit": 25,
  "selfRoles": [
    { "label": "News: Discord", "roleId": "1515140381468004483" },
    { "label": "News: Steam", "roleId": "1515140296386674809" },
    { "label": "News: Webseite", "roleId": "1515140266846326844" },
    { "label": "News: Boardgame", "roleId": "1515140227008565378" }
  ],
  "updateIntervalSeconds": 60,
  "channelNameTemplate": "\u2139\ufe0f\uff65Information | {count}",
  "levelSystem": {
    "minMessageXp": 15,
    "maxMessageXp": 25,
    "cooldownSeconds": 60,
    "baseXp": 100,
    "levelExponent": 1.5,
    "progressBarLength": 10,
    "embedColor": "#2f80ed",
    "syncExistingMembersOnStart": true,
    "ignoreBots": true,
    "ignoredChannelIds": [],
    "ignoredRoleIds": [
      "1515125166240301097"
    ],
    "levelRoles": [
      { "level": 5, "roleId": "1515126499273998497" },
      { "level": 10, "roleId": "1515126655985651993" },
      { "level": 20, "roleId": "1515126764911857794" },
      { "level": 30, "roleId": "1515126932461850696" },
      { "level": 40, "roleId": "1515127034752274573" },
      { "level": 50, "roleId": "1515127165535125514" },
      { "level": 75, "roleId": "1515127288662986943" },
      { "level": 100, "roleId": "1515127402664165446" }
    ]
  }
}
```

### Hauptwerte

`token`

Dein Discord Bot Token.

`guildId`

Die ID deines Discord Servers.

`welcomeChannelId`

Die ID des Channels fuer Join-/Welcome-Nachrichten. Aktuell: `1515132964764254319`.

`logChannelId`

Die ID des Channels fuer alle anderen Logs wie Leave, Tickets, Promotions, Self Roles und Temp Voice. Aktuell: `1515312876749848746`.

`infoChannelId`

Die ID des Channels, dessen Name automatisch aktualisiert wird.

`joinRoleId`

Die ID der Rolle, die neue Mitglieder automatisch bekommen.

`promoteAnnouncementChannelId`

Die ID des Channels, in den `/promote` die Announcement-Nachricht mit `@everyone` sendet.

`ticketPanelChannelId`

Die ID des Channels, in den der Bot die Ticket-Nachricht mit Button postet.

`ticketCategoryId`

Die ID der Kategorie, in der neue Ticket-Channels erstellt werden.

`ticketClaimRoleId`

Die Rolle, die ein Mitglied haben muss, um ein Ticket mit `Claim Ticket` zu uebernehmen.

`selfRolesChannelId`

Die ID des Channels, in den der Bot die Self-Roles-Nachricht mit Buttons postet.

`tempVoiceJoinChannelId`

Die ID des Voice-Channels, den User joinen, um einen eigenen temporaeren Voice-Channel zu bekommen.

`tempVoiceCategoryId`

Die ID der Kategorie, in der temporaere Voice-Channels erstellt werden.

`leaderboardChannelId`

Die ID des Channels, in den der Bot das Level-Leaderboard postet.

`leaderboardUpdateSeconds`

Wie oft das Leaderboard automatisch aktualisiert wird.

`leaderboardLimit`

Wie viele Plaetze im Leaderboard angezeigt werden. Fuer dein aktuelles Setup ist `25` eingestellt.

`selfRoles`

Liste der Rollen, die User sich selbst geben und entfernen koennen.

`updateIntervalSeconds`

Wie oft der Info-Channel zusaetzlich automatisch aktualisiert wird.

`channelNameTemplate`

Der Name fuer den Info-Channel. `{count}` wird durch die Mitgliederzahl ersetzt.

### Level-Werte

`levelSystem.minMessageXp`

Die kleinste XP-Menge, die ein User pro Nachricht bekommen kann.

`levelSystem.maxMessageXp`

Die groesste XP-Menge, die ein User pro Nachricht bekommen kann.

`levelSystem.cooldownSeconds`

Cooldown pro User in Sekunden. Solange der Cooldown aktiv ist, bekommt der User fuer weitere Nachrichten keine XP.

`levelSystem.baseXp`

Basiswert fuer die Level-Formel.

`levelSystem.levelExponent`

Exponent fuer die Level-Formel. Hoehere Werte machen spaetere Level schwerer.

`levelSystem.progressBarLength`

Laenge des Fortschrittsbalkens im `/level` Embed.

`levelSystem.embedColor`

Farbe des `/level` Embeds als Hex-Code.

`levelSystem.syncExistingMembersOnStart`

Wenn `true`, traegt der Bot beim Start alle aktuellen Servermitglieder in `data/level.json` ein.

`levelSystem.ignoreBots`

Wenn `true`, bekommen Bots keine XP und werden nicht in die Level-Datei synchronisiert.

`levelSystem.ignoredChannelIds`

Channels, in denen keine XP vergeben werden. Trage hier Channel-IDs als Text ein.

Beispiel:

```json
"ignoredChannelIds": [
  "123456789012345678",
  "234567890123456789"
]
```

`levelSystem.ignoredRoleIds`

Rollen, deren Mitglieder keine XP bekommen. Deine No-XP-Rolle ist bereits eingetragen:

```json
"ignoredRoleIds": [
  "1515125166240301097"
]
```

`levelSystem.levelRoles`

Level-Meilensteine mit Rollen. Der User behaelt immer nur die hoechste erreichte Meilensteinrolle. Unter Level 5 werden alle Level-Rollen entfernt.

Beispiel: Bei Level 5 bekommt er die Level-5-Rolle. Bei Level 10 wird die Level-5-Rolle entfernt und die Level-10-Rolle vergeben.

Aktuelle Meilensteine:

```json
"levelRoles": [
  { "level": 5, "roleId": "1515126499273998497" },
  { "level": 10, "roleId": "1515126655985651993" },
  { "level": 20, "roleId": "1515126764911857794" },
  { "level": 30, "roleId": "1515126932461850696" },
  { "level": 40, "roleId": "1515127034752274573" },
  { "level": 50, "roleId": "1515127165535125514" },
  { "level": 75, "roleId": "1515127288662986943" },
  { "level": 100, "roleId": "1515127402664165446" }
]
```

## Slash Commands

Der Bot registriert beim Start automatisch:

```text
/level
/promote
```

Der Befehl zeigt:

- aktuelles Level
- gesamte XP
- benoetigte XP fuer das naechste Level
- fehlende XP bis zum naechsten Level
- Fortschrittsbalken

Wenn ein User durch eine Nachricht ein neues Level erreicht, sendet der Bot automatisch eine Level-Up-Nachricht in denselben Channel.

### `/promote`

Mit `/promote` waehlst du:

- `user`: das Mitglied, das promotet werden soll
- `rolle`: die Rolle, die vergeben werden soll

Danach postet der Bot im Promote-Channel eine Announcement-Nachricht mit `@everyone`.

Wichtig:

- der Ausfuehrende braucht `Manage Roles`
- der Bot braucht `Manage Roles`
- die Bot-Rolle muss ueber der Promote-Rolle stehen
- die Promote-Rolle muss unter der hoechsten Rolle des Ausfuehrenden stehen, außer der Server Owner fuehrt den Befehl aus

## Daten

Die Leveldaten liegen in:

```text
data/level.json
```

Beispiel:

```json
{
  "users": {
    "123456789012345678": {
      "xp": 250,
      "username": "UserName",
      "firstSeenAt": "2026-06-13T00:00:00.000Z",
      "lastSeenAt": "2026-06-13T00:10:00.000Z"
    }
  }
}
```

Du kannst die Datei sichern, wenn du die XP behalten willst.

## Fehlerbehebung

### `/level` erscheint nicht

Pruefe:

- Bot wurde mit `applications.commands` eingeladen
- Bot wurde nach dem Upload neu gestartet
- im Log steht `/level und /promote wurden registriert.`

### `/promote` funktioniert nicht

Pruefe:

- Bot hat `Manage Roles`
- Bot hat `Mention Everyone`, wenn `@everyone` wirklich pingen soll
- Bot-Rolle steht hoeher als die Rolle, die vergeben werden soll
- `promoteAnnouncementChannelId` ist korrekt
- der Promote-Channel erlaubt dem Bot Nachrichten zu senden

### Tickets funktionieren nicht

Pruefe:

- Bot hat `Manage Channels`
- Bot hat im Ticket-Panel-Channel `Send Messages` und `Read Message History`
- `ticketPanelChannelId` ist korrekt
- `ticketCategoryId` ist korrekt
- `ticketClaimRoleId` ist korrekt, wenn Claim nicht funktioniert
- die Kategorie erlaubt dem Bot, Channels zu erstellen

### Self Roles funktionieren nicht

Pruefe:

- Bot hat `Manage Roles`
- Bot-Rolle steht hoeher als alle Self Roles
- Bot hat im Self-Roles-Channel `Send Messages` und `Read Message History`
- `selfRolesChannelId` ist korrekt
- die Role-IDs in `selfRoles` sind korrekt

### Temp Voice funktioniert nicht

Pruefe:

- Bot hat `Manage Channels`
- Bot hat `Move Members`
- `tempVoiceJoinChannelId` ist korrekt
- `tempVoiceCategoryId` ist korrekt
- die Bot-Rolle darf in der Kategorie Channels erstellen

### Leaderboard funktioniert nicht

Pruefe:

- Bot hat im Leaderboard-Channel `Send Messages` und `Read Message History`
- `leaderboardChannelId` ist korrekt
- `leaderboardUpdateSeconds` ist mindestens `1`
- `leaderboardLimit` ist mindestens `1`
- `data/level.json` enthaelt XP-Daten

### Auto-Rolle funktioniert nicht

Pruefe:

- Bot hat `Manage Roles`
- Bot-Rolle steht hoeher als die Join-Rolle
- `joinRoleId` ist korrekt

### Level-Rollen funktionieren nicht

Pruefe:

- Bot hat `Manage Roles`
- Bot-Rolle steht hoeher als alle Level-Rollen
- die Role-IDs in `levelSystem.levelRoles` sind korrekt
- der User hat das benoetigte Level erreicht

### Info-Channel wird nicht umbenannt

Pruefe:

- Bot hat `Manage Channels`
- `infoChannelId` ist korrekt
- der Channel kann von Discord umbenannt werden

### XP steigen nicht

Pruefe:

- du wartest den Cooldown aus
- `levelSystem.ignoreBots` blockiert nur Bots, nicht normale User
- der Channel steht nicht in `levelSystem.ignoredChannelIds`
- der User hat keine Rolle aus `levelSystem.ignoredRoleIds`
- `data/level.json` kann vom Server beschrieben werden

## Wichtige Hinweise

- Lade `config.json` nicht oeffentlich hoch, weil dort dein Token steht.
- Wenn du deinen Token irgendwo gepostet hast, erstelle sofort einen neuen Token im Discord Developer Portal.
