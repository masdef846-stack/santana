// ---------------------------------------------------------
// Santana Event System — Prefix !createevent + Role Lock + Auto :30
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
} = require("discord.js");

// ---------- CONFIG ----------
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;  // auto messages + test messages
const ALLOWED_ROLE = process.env.ALLOWED_ROLE; // only this role can use !createevent
const DEFAULT_LOGO = process.env.LOGO_URL || "https://i.hizliresim.com/sbpz118.png";

if (!TOKEN || !CHANNEL_ID || !ALLOWED_ROLE) {
  console.error("Please set TOKEN, CHANNEL_ID, and ALLOWED_ROLE env variables.");
  process.exit(1);
}

// ---------- CLIENT ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// ---------- GLOBAL ----------
let activeEvent = null;

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
      "```diff\n+ █▀▀▀▀▀▀▀▀▀ INFORMAL ROSTER ▀▀▀▀▀▀▀▀▀█\n```\n" +
      "**Registration is now OPEN!**\nClick the buttons below to join or leave the roster.\n\n" +
      "────────────────────────"
    )
    .addFields(
      { name: "__🏆 MAIN ROSTER (10 Slots)__", value: mainList },
      { name: "────────────────────────", value: "\u200b" },
      { name: "__📥 BACKUP ROSTER (5 Slots)__", value: backupList },
    )
    .setFooter({ text: "Santana Family — Event System" })
    .setTimestamp();
}

// ---------- AUTO :30 CRON ----------
cron.schedule("30 * * * *", async () => {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return;

    console.log("[CRON] Auto :30 event sent.");
    await postPersistentEvent(channel, "");
  } catch (e) {
    console.error("Cron error:", e);
  }
});

// ---------- PERSISTENT EVENT (cron uses this) ----------
async function postPersistentEvent(channel, title) {
  if (activeEvent) return;

  const participants = [];
  const backups = [];

  const joinBtn = new ButtonBuilder()
    .setCustomId("join")
    .setLabel("Join 🟩")
    .setStyle(ButtonStyle.Success);

  const leaveBtn = new ButtonBuilder()
    .setCustomId("leave")
    .setLabel("Leave 🟥")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn);

  const embed = makeEmbed(title, participants, backups);
  const msg = await channel.send({ embeds: [embed], components: [row] });

  activeEvent = { message: msg, participants, backups, title, embedBase: embed, components: [row] };

  const collector = msg.createMessageComponentCollector({ time: 1000 * 60 * 60 * 3 }); // 3h

  collector.on("collect", async interaction => {
    if (!interaction.isButton()) return;

    const uid = interaction.user.id;
    const name = interaction.member?.displayName || interaction.user.username;

    try {
      if (interaction.customId === "join") {
        if (activeEvent.participants.some(p => p.id === uid) || activeEvent.backups.some(p => p.id === uid)) {
          return interaction.reply({ content: "You are already registered!", ephemeral: true });
        }

        if (activeEvent.participants.length < 10)
          activeEvent.participants.push({ id: uid, name });
        else if (activeEvent.backups.length < 5)
          activeEvent.backups.push({ id: uid, name });
        else
          return interaction.reply({ content: "Rosters are full!", ephemeral: true });
      }

      if (interaction.customId === "leave") {
        activeEvent.participants = activeEvent.participants.filter(p => p.id !== uid);
        activeEvent.backups = activeEvent.backups.filter(p => p.id !== uid);
      }

      const updated = makeEmbed(activeEvent.title, activeEvent.participants, activeEvent.backups);
      activeEvent.embedBase = updated;
      await activeEvent.message.edit({ embeds: [updated], components: activeEvent.components });

      interaction.reply({ content: "Updated!", ephemeral: true });
    } catch (err) {
      console.error("Collector error:", err);
    }
  });

  collector.on("end", async () => {
    try {
      if (!activeEvent) return;

      const final = EmbedBuilder.from(activeEvent.embedBase)
        .setTitle(`⏰ ${activeEvent.title.toUpperCase()} — CLOSED`)
        .setColor("#8b0000")
        .setDescription("This event has ended.");

      await activeEvent.message.edit({ embeds: [final], components: [] });
    } catch {}
    activeEvent = null;
  });
}

// ---------- PREFIX COMMAND !createevent ----------
client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith("!createevent")) return;

  // ROLE CHECK
  if (!msg.member.roles.cache.has(ALLOWED_ROLE)) {
    return msg.reply("❌ You do not have permission to use this command.");
  }

  const title = msg.content.split(" ").slice(1).join(" ") || "TEST EVENT";

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const participants = [];
    const backups = [];

    const joinBtn = new ButtonBuilder()
      .setCustomId("join")
      .setLabel("Join 🟩")
      .setStyle(ButtonStyle.Success);

    const leaveBtn = new ButtonBuilder()
      .setCustomId("leave")
      .setLabel("Leave 🟥")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn);
    const embed = makeEmbed(title, participants, backups);

    const sent = await channel.send({ embeds: [embed], components: [row] });

    msg.reply("Test event sent — will auto-delete in **10 seconds**.");

    // DELETE AFTER 10s
    setTimeout(() => {
      sent.delete().catch(() => {});
    }, 10000);

  } catch (e) {
    console.error("createevent error:", e);
  }
});

// ---------- EXPRESS KEEP ALIVE ----------
const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
app.listen(process.env.PORT || 3000);

// ---------- LOGIN ----------
client.login(TOKEN);
