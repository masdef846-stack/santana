// index.js - Santana Event System (Full)
// Requirements: node 18+, discord.js v14, express, node-cron
// Environment variables required: TOKEN, CLIENT_ID, GUILD_ID, CHANNEL_ID (optional)

const express = require("express");
const cron = require("node-cron");
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");
require("dotenv").config();

// ---------- CONFIG ----------
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // bot application id
const GUILD_ID = process.env.GUILD_ID; // optional but recommended for quick registration
const CHANNEL_ID = process.env.CHANNEL_ID || null; // fallback channel id
const DEFAULT_LOGO = "https://i.hizliresim.com/sbpz118.png"; // replace if you want

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Please set TOKEN, CLIENT_ID and GUILD_ID environment variables.");
  process.exit(1);
}

// ---------- CLIENT ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.on("ready", () => {
  console.log(`✅ ${client.user.tag} ready.`);
});

// ---------- GLOBAL STATE ----------
let activeEvent = null; // currently posted event message + rosters
const scheduledEvents = []; // { id, title, hour (0-23), channelId (optional) }

// ---------- REGISTER SLASH COMMANDS ----------
const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("createevent")
      .setDescription("Create an event that triggers daily at HH:30")
      .addStringOption((o) =>
        o.setName("title").setDescription("Event title").setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("time")
          .setDescription("Time format HH:MM (minutes ignored, event fires at HH:30)")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("closeevent")
      .setDescription("Force close the current active event"),
    new SlashCommandBuilder()
      .setName("resetevent")
      .setDescription("Reset the current event rosters (clear participants/backups)"),
    new SlashCommandBuilder()
      .setName("listevents")
      .setDescription("List scheduled events"),
    new SlashCommandBuilder()
      .setName("cancelevent")
      .setDescription("Cancel a scheduled event by id")
      .addStringOption((o) =>
        o.setName("id").setDescription("Scheduled event id").setRequired(true)
      ),
  ].map((c) => c.toJSON());

  try {
    // register to a guild for instant updates (recommended). For global: use applicationCommands route
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("Slash commands registered.");
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
}
registerCommands();

// ---------- HELPERS ----------
function parseHourFromTimeString(ts) {
  // expects "HH:MM" (24h). Return hour number 0-23 or null if invalid.
  if (!ts || typeof ts !== "string") return null;
  const m = ts.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  if (isNaN(hh) || hh < 0 || hh > 23) return null;
  return hh;
}

function makeEmbed(title, participants, backups) {
  const mainList =
    participants && participants.length
      ? participants.map((p, i) => `**${i + 1}.** <@${p.id}>`).join("\n")
      : "_No players yet_";

  const backupList =
    backups && backups.length
      ? backups.map((p, i) => `**${i + 1}.** <@${p.id}>`).join("\n")
      : "_Empty_";

  // Esports-style dark embed with red title and separators
  const embed = new EmbedBuilder()
    .setColor("#0b0b0b")
    .setThumbnail(DEFAULT_LOGO)
    .setTitle(`🔥 ${String(title).toUpperCase()} — INFORMAL EVENT`)
    .setDescription(
      "```diff\n+ █▀▀▀▀▀▀▀▀▀ EVENT ANNOUNCEMENT ▀▀▀▀▀▀▀▀▀█\n```\n" +
        "**Registration is now OPEN!**\n" +
        "Click the buttons below to join or leave the roster.\n\n" +
        "────────────────────────"
    )
    .addFields(
      {
        name: "__🏆 MAIN ROSTER (10 Slots)__",
        value: mainList,
        inline: false,
      },
      {
        name: "────────────────────────",
        value: "\u200b",
        inline: false,
      },
      {
        name: "__📥 BACKUP ROSTER (5 Slots)__",
        value: backupList,
        inline: false,
      }
    )
    .setFooter({ text: "Santana Family — Event System" })
    .setTimestamp();

  return embed;
}

// ---------- SLASH INTERACTIONS ----------
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    const cmd = interaction.commandName;

    // CREATEEVENT
    if (cmd === "createevent") {
      const title = interaction.options.getString("title");
      const time = interaction.options.getString("time"); // "HH:MM"
      const hour = parseHourFromTimeString(time);

      if (hour === null) {
        return interaction.reply({
          content: "Invalid time format. Use `HH:MM` (24-hour). Example: `23:00`.",
          ephemeral: true,
        });
      }

      // create scheduled event
      const id = `${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`;
      const channelId = interaction.channelId || CHANNEL_ID || null;
      scheduledEvents.push({ id, title, hour, channelId });
      await interaction.reply({
        content: `Scheduled event **${title}** daily at **${String(hour).padStart(2, "0")}:30** (id: \`${id}\`).`,
        ephemeral: true,
      });
      return;
    }

    // CLOSEEVENT - closes active posted event
    if (cmd === "closeevent") {
      if (!activeEvent) {
        return interaction.reply({ content: "There is no active event to close.", ephemeral: true });
      }
      // edit embed to closed state and remove components
      const closedEmbed = EmbedBuilder.from(activeEvent.embedBase)
        .setTitle(`🚫 ${activeEvent.title.toUpperCase()} — CLOSED`)
        .setColor("#8b0000")
        .setDescription("This event has been closed by an admin.");
      await activeEvent.message.edit({ embeds: [closedEmbed], components: [] });
      activeEvent = null;
      return interaction.reply({ content: "Active event closed.", ephemeral: true });
    }

    // RESETEVENT - clear rosters but keep message/components
    if (cmd === "resetevent") {
      if (!activeEvent) {
        return interaction.reply({ content: "No active event to reset.", ephemeral: true });
      }
      activeEvent.participants = [];
      activeEvent.backups = [];
      const resetEmbed = makeEmbed(activeEvent.title, [], []);
      // keep components
      await activeEvent.message.edit({ embeds: [resetEmbed] });
      activeEvent.embedBase = resetEmbed;
      return interaction.reply({ content: "Event rosters reset.", ephemeral: true });
    }

    // LISTEVENTS
    if (cmd === "listevents") {
      if (scheduledEvents.length === 0) {
        return interaction.reply({ content: "No scheduled events.", ephemeral: true });
      }
      const lines = scheduledEvents.map((s) => `• id:\`${s.id}\` — **${s.title}** @ **${String(s.hour).padStart(2, "0")}:30**`);
      return interaction.reply({ content: lines.join("\n"), ephemeral: true });
    }

    // CANCELEVENT
    if (cmd === "cancelevent") {
      const id = interaction.options.getString("id");
      const idx = scheduledEvents.findIndex((s) => s.id === id);
      if (idx === -1) {
        return interaction.reply({ content: `No scheduled event found with id \`${id}\`.`, ephemeral: true });
      }
      scheduledEvents.splice(idx, 1);
      return interaction.reply({ content: `Scheduled event \`${id}\` cancelled.`, ephemeral: true });
    }
  } catch (err) {
    console.error("Interaction error:", err);
    if (interaction.replied || interaction.deferred) {
      try { await interaction.followUp({ content: "There was an error processing the command.", ephemeral: true }); } catch {}
    } else {
      try { await interaction.reply({ content: "There was an error processing the command.", ephemeral: true }); } catch {}
    }
  }
});

// ---------- CORE: send event embed when cron triggers ----------
async function postScheduledEvent(sched) {
  // if an activeEvent exists, skip posting to avoid duplicates
  if (activeEvent) {
    console.log("Skipped posting because an active event is already running.");
    return;
  }

  try {
    const channelIdToUse = sched.channelId || CHANNEL_ID;
    if (!channelIdToUse) {
      console.warn("No channelId available for scheduled event:", sched);
      return;
    }
    const channel = await client.channels.fetch(channelIdToUse).catch((e) => {
      console.error("Failed to fetch channel:", e);
      return null;
    });
    if (!channel) return;

    // initial empty rosters
    const participants = [];
    const backups = [];

    const joinButton = new ButtonBuilder().setCustomId("join").setLabel("Join 🟩").setStyle(ButtonStyle.Success);
    const leaveButton = new ButtonBuilder().setCustomId("leave").setLabel("Leave 🟥").setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(joinButton, leaveButton);

    const embedBase = makeEmbed(sched.title, participants, backups);
    const msg = await channel.send({ embeds: [embedBase], components: [row] });

    activeEvent = {
      id: sched.id,
      message: msg,
      participants,
      backups,
      title: sched.title,
      embedBase,
      components: [row],
    };

    // collector
    const collector = msg.createMessageComponentCollector({ time: 1000 * 60 * 60 * 3 }); // 3 hours default
    collector.on("collect", async (interaction) => {
      try {
        if (!interaction.isButton()) return;
        const uid = interaction.user.id;
        const displayName = interaction.member ? interaction.member.displayName : interaction.user.username;

        if (interaction.customId === "join") {
          if (activeEvent.participants.some((p) => p.id === uid) || activeEvent.backups.some((p) => p.id === uid)) {
            return interaction.reply({ content: "You are already registered!", ephemeral: true });
          }
          if (activeEvent.participants.length < 10) {
            activeEvent.participants.push({ id: uid, name: displayName });
          } else if (activeEvent.backups.length < 5) {
            activeEvent.backups.push({ id: uid, name: displayName });
          } else {
            return interaction.reply({ content: "Both main and backup rosters are full!", ephemeral: true });
          }
        }

        if (interaction.customId === "leave") {
          activeEvent.participants = activeEvent.participants.filter((p) => p.id !== uid);
          activeEvent.backups = activeEvent.backups.filter((p) => p.id !== uid);
        }

        // update embed
        const updatedEmbed = makeEmbed(activeEvent.title, activeEvent.participants, activeEvent.backups);
        activeEvent.embedBase = updatedEmbed;
        await activeEvent.message.edit({ embeds: [updatedEmbed], components: activeEvent.components });
        await interaction.reply({ content: "Updated!", ephemeral: true });
      } catch (e) {
        console.error("Collector handling error:", e);
        try { await interaction.reply({ content: "An error occurred.", ephemeral: true }); } catch {}
      }
    });

    collector.on("end", async () => {
      // auto-close after collector time
      if (!activeEvent) return;
      try {
        const finalEmbed = EmbedBuilder.from(activeEvent.embedBase)
          .setTitle(`⏰ ${activeEvent.title.toUpperCase()} — CLOSED`)
          .setColor("#8b0000")
          .setDescription("This event has ended (auto-closed).");
        await activeEvent.message.edit({ embeds: [finalEmbed], components: [] });
      } catch (e) {
        console.error("Error closing event after collector:", e);
      } finally {
        activeEvent = null;
      }
    });
  } catch (e) {
    console.error("Failed to post scheduled event:", e);
  }
}

// Cron: run every minute at 30th second of minute? We need "every hour at :30" so:
cron.schedule("30 * * * *", async () => {
  try {
    const now = new Date();
    const currentHour = now.getHours(); // 0-23
    // for every scheduled event that matches current hour, post it
    const toPost = scheduledEvents.filter((s) => s.hour === currentHour);
    for (const s of toPost) {
      await postScheduledEvent(s);
    }
  } catch (e) {
    console.error("Cron error:", e);
  }
});

// ---------- EXPRESS KEEP-ALIVE ----------
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Keep-alive server listening on ${port}`));

// ---------- SAFE LOGGING ----------
process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
});

// ---------- LOGIN ----------
client.login(TOKEN).catch((e) => {
  console.error("Failed to login:", e);
  process.exit(1);
});


client.login(TOKEN);
