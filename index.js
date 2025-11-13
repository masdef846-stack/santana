// ---------------------------------------------------------
// Santana Event System — Immediate test /createevent + Auto :30
// ---------------------------------------------------------
require("dotenv").config();
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

// ---------- CONFIG ----------
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID; // required: where automatic and test messages go
const DEFAULT_LOGO = process.env.LOGO_URL || "https://i.hizliresim.com/sbpz118.png";

if (!TOKEN || !CHANNEL_ID) {
  console.error("Please set TOKEN and CHANNEL_ID environment variables.");
  process.exit(1);
}

// ---------- CLIENT ----------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel, Partials.Message],
});

// ---------- GLOBAL ----------
let activeEvent = null; // currently posted event (from cron)
const rest = new REST({ version: "10" }).setToken(TOKEN);

// ---------- HELPERS ----------
function makeEmbed(title, participants = [], backups = []) {
  const mainList = participants.length
    ? participants.map((p, i) => `**${i + 1}.** <@${p.id}>`).join("\n")
    : "_No players yet_";

  const backupList = backups.length
    ? backups.map((p, i) => `**${i + 1}.** <@${p.id}>`).join("\n")
    : "_Empty_";

  return new EmbedBuilder()
    .setColor("#0d0d0d")
    .setThumbnail(DEFAULT_LOGO)
    .setTitle(`🔥 ${String(title).toUpperCase()} — INFORMAL EVENT`)
    .setDescription(
      "```diff\n+ █▀▀▀▀▀▀▀▀▀ EVENT ANNOUNCEMENT ▀▀▀▀▀▀▀▀▀█\n```\n" +
      "**Registration is now OPEN!**\nClick the buttons below to join or leave the roster.\n\n" +
      "────────────────────────"
    )
    .addFields(
      { name: "__🏆 MAIN ROSTER (10 Slots)__", value: mainList, inline: false },
      { name: "────────────────────────", value: "\u200b", inline: false },
      { name: "__📥 BACKUP ROSTER (5 Slots)__", value: backupList, inline: false }
    )
    .setFooter({ text: "Santana Family — Event System" })
    .setTimestamp();
}

// ---------- REGISTER SLASH COMMANDS ----------
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("createevent")
      .setDescription("Instant test event: sends the roster embed immediately (auto-deletes after 10s).")
      .addStringOption(opt => opt.setName("title").setDescription("Optional title").setRequired(false)),
  ].map(c => c.toJSON());

  try {
    // register globally on the application (fast) - or use guild registration if preferred
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("Slash command /createevent registered.");
  } catch (err) {
    console.error("Failed to register slash commands:", err);
  }
});

// ---------- AUTO :30 CRON (every hour at minute 30) ----------
cron.schedule("30 * * * *", async () => {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.warn("CHANNEL_ID invalid or channel not found.");
      return;
    }
    console.log("Posting automatic :30 event.");
    await postPersistentEvent(channel, "AUTO EVENT");
  } catch (e) {
    console.error("Cron error:", e);
  }
});

// ---------- POST PERSISTENT EVENT (the one used by cron) ----------
async function postPersistentEvent(channel, title) {
  if (activeEvent) {
    console.log("There is already an active persistent event. Skipping post.");
    return;
  }

  const participants = [];
  const backups = [];

  const joinBtn = new ButtonBuilder().setCustomId("join").setLabel("Join 🟩").setStyle(ButtonStyle.Success);
  const leaveBtn = new ButtonBuilder().setCustomId("leave").setLabel("Leave 🟥").setStyle(ButtonStyle.Danger);
  const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn);

  const embed = makeEmbed(title, participants, backups);
  const msg = await channel.send({ embeds: [embed], components: [row] });

  activeEvent = { message: msg, participants, backups, title, embedBase: embed, components: [row] };

  const collector = msg.createMessageComponentCollector({ time: 1000 * 60 * 60 * 3 }); // 3 hours

  collector.on("collect", async (interaction) => {
    if (!interaction.isButton()) return;
    const uid = interaction.user.id;
    const displayName = interaction.member ? interaction.member.displayName : interaction.user.username;

    try {
      if (interaction.customId === "join") {
        if (activeEvent.participants.some(p => p.id === uid) || activeEvent.backups.some(p => p.id === uid)) {
          return interaction.reply({ content: "You are already registered!", ephemeral: true });
        }
        if (activeEvent.participants.length < 10) activeEvent.participants.push({ id: uid, name: displayName });
        else if (activeEvent.backups.length < 5) activeEvent.backups.push({ id: uid, name: displayName });
        else return interaction.reply({ content: "Both main and backup rosters are full!", ephemeral: true });
      } else if (interaction.customId === "leave") {
        activeEvent.participants = activeEvent.participants.filter(p => p.id !== uid);
        activeEvent.backups = activeEvent.backups.filter(p => p.id !== uid);
      }

      const updated = makeEmbed(activeEvent.title, activeEvent.participants, activeEvent.backups);
      activeEvent.embedBase = updated;
      await activeEvent.message.edit({ embeds: [updated], components: activeEvent.components });
      await interaction.reply({ content: "Updated!", ephemeral: true });
    } catch (err) {
      console.error("Collector handling error:", err);
      try { await interaction.reply({ content: "An error occurred.", ephemeral: true }); } catch {}
    }
  });

  collector.on("end", async () => {
    try {
      if (!activeEvent) return;
      const final = EmbedBuilder.from(activeEvent.embedBase)
        .setTitle(`⏰ ${activeEvent.title.toUpperCase()} — CLOSED`)
        .setColor("#8b0000")
        .setDescription("This event has ended (auto-closed).");
      await activeEvent.message.edit({ embeds: [final], components: [] });
    } catch (err) {
      console.error("Error closing event:", err);
    } finally {
      activeEvent = null;
    }
  });
}

// ---------- SLASH: createevent (INSTANT TEST POST & AUTO-DELETE 10s) ----------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "createevent") return;

  try {
    const title = interaction.options.getString("title") || "TEST EVENT";
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return interaction.reply({ content: "Target channel not found.", ephemeral: true });

    // Build same embed but as a one-off message
    const participants = [];
    const backups = [];
    const joinBtn = new ButtonBuilder().setCustomId("join").setLabel("Join 🟩").setStyle(ButtonStyle.Success);
    const leaveBtn = new ButtonBuilder().setCustomId("leave").setLabel("Leave 🟥").setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn);
    const embed = makeEmbed(title, participants, backups);

    const msg = await channel.send({ embeds: [embed], components: [row] });

    // reply to the user that it was posted (ephemeral)
    await interaction.reply({ content: `Test event posted (will auto-delete in 10s).`, ephemeral: true });

    // remove the message after 10 seconds
    setTimeout(async () => {
      try {
        await msg.delete().catch(() => {});
      } catch (e) {
        console.error("Failed to delete test event message:", e);
      }
    }, 10000);

  } catch (err) {
    console.error("createevent handling error:", err);
    try { if (!interaction.replied) await interaction.reply({ content: "Error creating event.", ephemeral: true }); } catch {}
  }
});

// ---------- EXPRESS KEEP-ALIVE ----------
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Keep-alive server listening on ${port}`));

// ---------- SAFE LOGGING ----------
process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));

// ---------- LOGIN ----------
client.login(TOKEN).catch(e => {
  console.error("Failed to login:", e);
  process.exit(1);
});
