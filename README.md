# Discord Honeypot

Turns a Discord bot into a honeypot: it can auto-create a `#honeypot` text channel, lets admins mark any channel with `/sethoneypot`, and bans anyone who posts in honeypot channels while purging the last 24h of messages. Channel IDs are stored in `honeypots.json`.

## Downloads
- [Linux x64](https://github.com/omznc/discord-honeypot/releases/latest/download/discord-honeypot-amd64)
- [Linux arm64](https://github.com/omznc/discord-honeypot/releases/latest/download/discord-honeypot-arm64)
- [Windows x64](https://github.com/omznc/discord-honeypot/releases/latest/download/discord-honeypot-windows)
- [macOS x64](https://github.com/omznc/discord-honeypot/releases/latest/download/discord-honeypot-macos)
- [macOS arm64](https://github.com/omznc/discord-honeypot/releases/latest/download/discord-honeypot-macos-arm64)

## Run a downloaded build
```bash
chmod +x ./discord-honeypot-amd64   # or the binary for your OS/arch
DISCORD_TOKEN=your_bot_token CLIENT_ID=your_application_id ./discord-honeypot-amd64
```

## Requirements
- Discord bot with `Guilds` and `GuildMessages` intents enabled
- Bot permissions: View Channel, Send Messages, Manage Messages, Read Message History, Ban Members, Manage Channels

## Create a Discord bot
- https://discord.com/developers/applications → New Application → Bot.
- Copy the bot token (use it as `DISCORD_TOKEN`).
- Enable Privileged Gateway Intents: `SERVER MEMBERS INTENT` and `MESSAGE CONTENT INTENT` off (not needed); leave `GUILD PRESENCES` off.
- Invite your bot (an invite url gets generated once you start it)

# Development
## Setup
```bash
bun install
export DISCORD_TOKEN=your_bot_token
export CLIENT_ID=your_application_id
```

## Run locally
```bash
bun run src/bot.ts
```

## Slash command
- `/sethoneypot channel:<text channel>` (admins only) marks the channel, sets a topic/disclaimer, and persists the ID.

## Build binaries
```bash
bun run compile:amd64       # linux x64
bun run compile:arm64       # linux arm64
bun run compile:windows     # windows x64
bun run compile:macos       # macOS x64
bun run compile:macos-arm64 # macOS arm64
```

## Lint/format
```bash
bun run check
```

## Release
Pushing a tag matching `v*` triggers the GitHub Actions workflow to build the five platform binaries and attach them to the release.
