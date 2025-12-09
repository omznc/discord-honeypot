import { Database } from "bun:sqlite";
import { ChannelType, Client, GatewayIntentBits, MessageFlags, PermissionsBitField, REST, Routes, type TextChannel } from "discord.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
	throw new Error("Set DISCORD_TOKEN env var.");
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
	try {
		await channel.setTopic(topicText);
	} catch (error) {
		console.error("Error setting honeypot topic:", error);
	}

	try {
		await channel.send(disclaimer);
	} catch (error) {
		console.error("Error sending honeypot disclaimer:", error);
	}

	honeypots.add(channel.id);
	insertHoneypot.run(channel.id);
};

const unmarkHoneypot = async (channel: TextChannel) => {
	honeypots.delete(channel.id);
	deleteHoneypot.run(channel.id);
};

client.once("clientReady", async () => {
	const app = await client.application?.fetch().catch((error) => {
		console.error("Error fetching application:", error);
		return null;
	});
	const appId = app?.id ?? client.application?.id;
	if (!appId) {
		console.error("Error registering commands: missing application id");
		return;
	}

	try {
		await rest.put(Routes.applicationCommands(appId), { body: commands });
	} catch (error) {
		console.error("Error registering commands:", error);
		return;
	}

	const perms = new PermissionsBitField([
		PermissionsBitField.Flags.ViewChannel,
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ManageMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.BanMembers,
		PermissionsBitField.Flags.ManageChannels,
	]).bitfield;

	const invite = `https://discord.com/oauth2/authorize?client_id=${client.user?.id ?? ""}&scope=bot%20applications.commands&permissions=${perms.toString()}`;
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

	const owner = await guild.fetchOwner().catch((error) => {
		console.error("Error fetching guild owner:", error);
		return null;
	});
	if (owner) {
		const dm = await owner.createDM().catch((error) => {
			console.error("Error creating DM with owner:", error);
			return null;
		});
		await dm
			?.send(
				[
					`Thanks for adding Honeypot to ${guild.name}.`,
					`Move the bot's highest role above everyone it should ban. Drag its role to the top (below owner).`,
					`Admin doesn't bypass hierarchy; bot role must outrank targets and keep Ban Members.`,
				].join(" "),
			)
			.catch((error) => {
				console.error("Error sending owner DM:", error);
			});
	}
});

client.on("messageCreate", async (message) => {
	if (message.author.bot || !message.guild) return;

	if (!honeypots.has(message.channel.id)) return;

	if (message.channel.type !== ChannelType.GuildText) return;

	const me = message.guild.members.me;
	if (!me) return;

	const target = await message.guild.members.fetch(message.author.id).catch((error) => {
		console.error("Error fetching target member:", error);
		return null;
	});
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

client.login(token).catch((error) => {
	console.error("Error logging in:", error);
});
