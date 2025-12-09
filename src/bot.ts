import { Database } from "bun:sqlite";
import { ChannelType, Client, GatewayIntentBits, MessageFlags, PermissionsBitField, REST, Routes, type TextChannel } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
if (!token || !clientId) {
	throw new Error("Set DISCORD_TOKEN and CLIENT_ID env vars.");
}
const dbPath = process.env.HONEYPOT_DB_PATH ?? "honeypots.sqlite";
const db = new Database(dbPath);
db.run("create table if not exists honeypots (id text primary key)");
const insertHoneypot = db.query("insert or ignore into honeypots (id) values (?)");
const deleteHoneypot = db.query("delete from honeypots where id = ?");
const honeypots = new Set<string>();
for (const row of db.query("select id from honeypots").all() as { id: string }[]) {
	honeypots.add(row.id);
}
const topicText = "Honeypot channel. Messages here trigger an automatic ban.";
const disclaimer = "This is a honeypot channel. Do not post here unless you want to be banned.";

const adminPerms = PermissionsBitField.Flags.Administrator;

const commands = [
	{
		name: "sethoneypot",
		description: "Designate a channel as a honeypot",
		default_member_permissions: adminPerms.toString(),
		options: [
			{
				name: "channel",
				description: "Text channel to mark",
				type: 7,
				channel_types: [ChannelType.GuildText],
				required: true,
			},
		],
	},
	{
		name: "removehoneypot",
		description: "Remove a channel from honeypot list",
		default_member_permissions: adminPerms.toString(),
		options: [
			{
				name: "channel",
				description: "Text channel to unmark",
				type: 7,
				channel_types: [ChannelType.GuildText],
				required: true,
			},
		],
	},
];

const rest = new REST({ version: "10" }).setToken(token);
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const markHoneypot = async (channel: TextChannel) => {
	await channel.setTopic(topicText).catch(() => {});
	await channel.send(disclaimer).catch(() => {});

	honeypots.add(channel.id);
	insertHoneypot.run(channel.id);
};

const unmarkHoneypot = async (channel: TextChannel) => {
	honeypots.delete(channel.id);
	deleteHoneypot.run(channel.id);
};

client.once("ready", async () => {
	await rest.put(Routes.applicationCommands(clientId), { body: commands });
	const perms = new PermissionsBitField([
		PermissionsBitField.Flags.ViewChannel,
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ManageMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.BanMembers,
		PermissionsBitField.Flags.ManageChannels,
	]).bitfield;

	const invite = `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=${perms.toString()}`;
	console.log(`Invite: ${invite}`);
	console.log(`Logged in as ${client.user?.tag}`);
});

client.on("interactionCreate", async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
		await interaction.reply({ content: "Need administrator.", flags: MessageFlags.Ephemeral });
		return;
	}

	const channel = interaction.options.getChannel("channel", true, [ChannelType.GuildText]) as TextChannel;

	if (interaction.commandName === "sethoneypot") {
		await markHoneypot(channel);
		await interaction.reply({ content: `${channel} is now a honeypot.`, flags: MessageFlags.Ephemeral });
		return;
	}

	if (interaction.commandName === "removehoneypot") {
		await unmarkHoneypot(channel);
		await interaction.reply({ content: `${channel} removed from honeypots.`, flags: MessageFlags.Ephemeral });
	}
});

client.on("guildCreate", async (guild) => {
	const existing = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === "honeypot") as TextChannel | undefined;

	const channel =
		existing ??
		((await guild.channels
			.create({
				name: "honeypot",
				type: ChannelType.GuildText,
				reason: "Auto-created honeypot channel",
			})
			.catch((error) => {
				console.error("Error creating honeypot channel:", error);
				return null;
			})) as TextChannel | null);

	if (!channel || channel.type !== ChannelType.GuildText) return;

	await markHoneypot(channel);
});

client.on("messageCreate", async (message) => {
	if (message.author.bot || !message.guild) return;

	if (!honeypots.has(message.channel.id)) return;

	if (message.channel.type !== ChannelType.GuildText) return;

	const me = message.guild.members.me;
	if (!me) return;

	const target = await message.guild.members.fetch(message.author.id).catch(() => null);
	if (!target) return;

	if (!me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
		console.error("Error banning user: missing BanMembers permission");
		return;
	}

	if (target.id === message.guild.ownerId) {
		console.error("Error banning user: target is guild owner");
		return;
	}

	const roleGap = me.roles.highest.comparePositionTo(target.roles.highest);
	if (roleGap <= 0) {
		console.error(
			`Error banning user: role hierarchy me=${me.roles.highest?.name ?? "none"}(${me.roles.highest?.position ?? -1}) target=${target.roles.highest?.name ?? "none"}(${target.roles.highest?.position ?? -1})`,
		);
		return;
	}

	await target.ban({ reason: "Honeypot trip", deleteMessageSeconds: 3600 }).catch((e) => {
		console.error("Error banning user:", e);
	});
});

client.login(token);
