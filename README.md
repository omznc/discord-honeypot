# Discord Honeypot

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/discord-honeypot?referralCode=oBQICw&utm_medium=integration&utm_source=template&utm_campaign=generic)

An easily-deployable Discord bot that automatically bans spammers by creating and managing honeypot channels.

When you invite the bot to any of your servers, it automatically creates a #honeypot channel with a disclaimer in it. You can also mark any channel as a honeypot channel using /sethoneypot.

Discord spammers tend to send messages to every single channel when they spam, so this is an incredibly easy way to automatically handle those issues. All other messages from the user in the last 24 hours get deleted as well. Just deploy, invite, and forget.

You can deploy it on Railway for free, or just run one of the binaries below locally.
Deploy it here https://railway.com/deploy/discord-honeypot


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

## Slash commands
- `/sethoneypot channel:<text channel>` (admins only) marks the channel, sets a topic/disclaimer, and persists the ID.
- `/removehoneypot channel:<text channel>` (admins only) removes the channel from the honeypot list.

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
