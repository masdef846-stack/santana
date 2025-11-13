// ---------------------------------------------------------
// Santana Event System — SAFE ENV VERSION (GITHUB READY)
// ---------------------------------------------------------

const express = require("express");
const cron = require("node-cron");
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

// --------------------------------------------------
// ENV CONFIG (GITHUB SAFE)
// --------------------------------------------------

const TOKEN = process.env.TOKEN;                 // Bot token
const CHANNEL_ID = process.env.CHANNEL_ID;       // Event atacağı kanal
const ALLOWED_ROLE = process.env.ALLOWED_ROLE;   // Komutu kullanabilecek rol ID

const DEFAULT_LOGO = "https://i.hizliresim.com/sbpz118.png";

// --------------------------------------------------
// CLIENT
// --------------------------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// --------------------------------------------------
// ACTIVE EVENT
// --------------------------------------------------

let activeEvent = null;

// --------------------------------------------------
// EMBED OLUŞTURMA
// --------------------------------------------------

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
      `**<@&${ALLOWED_ROLE}>**\n` +
      "```diff\n+ █▀▀▀▀▀ INFORMAL ROSTER ▀▀▀▀▀█\n```\n" +
      "**Registration is now OPEN!**\n" +
      "Click the buttons below to join or leave the roster.\n\n" +
      "────────────────────────"
    )
    .addFields(
      { name: "__🏆 MAIN ROSTER (10 Slots)__", value: mainList },
      { name: "────────────────────────", value: "\u200b" },
      { name: "__📥 BACKUP ROSTER (5 Slots)__", value: backupList }
    )
    .setFooter({ text: "Santana Family — Event System" })
    .setTimestamp();
}

// --------------------------------------------------
// AUTO :30 — 24/7 ÇALIŞAN EVENT
// --------------------------------------------------

cron.schedule("30 * * * *", async () => {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return;

    console.log("[CRON] Auto :30 event sent.");

    await postPersistentEvent(channel, "AUTO EVENT");

  } catch (e) {
    console.error("Cron error:", e);
  }
});

// --------------------------------------------------
// PERSISTENT EVENT — AUTO 30 İÇİN
// --------------------------------------------------

async function postPersistentEvent(channel, title) {
  if (activeEvent) return;

  let participants = [];
  let backups = [];

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

  activeEvent = {
    message: msg,
    participants,
    backups,
    title,
    embedBase: embed,
    components: [row],
  };

  const collector = msg.createMessageComponentCollector({
    time: 1000 * 60 * 60 * 3, // 3 hours
  });

  collector.on("collect", async (interaction) => {
    if (!interaction.isButton()) return;

    const uid = interaction.user.id;
    const name = interaction.member?.displayName || interaction.user.username;

    if (interaction.customId === "join") {
      if (participants.some(p => p.id === uid) || backups.some(p => p.id === uid)) {
        return interaction.reply({ content: "You are already registered!", ephemeral: true });
      }

      if (participants.length < 10)
        participants.push({ id: uid, name });
      else if (backups.length < 5)
        backups.push({ id: uid, name });
      else
        return interaction.reply({ content: "Rosters are full!", ephemeral: true });
    }

    if (interaction.customId === "leave") {
      participants = participants.filter(p => p.id !== uid);
      backups = backups.filter(p => p.id !== uid);
    }

    const updated = makeEmbed(title, participants, backups);
    await msg.edit({ embeds: [updated], components: [row] });

    interaction.reply({ content: "Updated!", ephemeral: true });
  });

  collector.on("end", async () => {
    try {
      if (!activeEvent) return;

      const final = EmbedBuilder.from(activeEvent.embedBase)
        .setTitle(`⏰ ${title.toUpperCase()} — CLOSED`)
        .setColor("#8b0000")
        .setDescription("This event has ended.");

      await activeEvent.message.edit({ embeds: [final], components: [] });
    } catch {}
    activeEvent = null;
  });
}

// --------------------------------------------------
// !createevent — TEST EVENT (10 saniyede silinir)
// --------------------------------------------------

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith("!createevent")) return;

  if (!msg.member.roles.cache.has(ALLOWED_ROLE)) {
    return msg.reply("❌ You do not have permission to use this command.");
  }

  const title = msg.content.split(" ").slice(1).join(" ") || "TEST EVENT";

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);

    const embed = makeEmbed(title, [], []);
    const joinBtn = new ButtonBuilder()
      .setCustomId("join")
      .setLabel("Join 🟩")
      .setStyle(ButtonStyle.Success);

    const leaveBtn = new ButtonBuilder()
      .setCustomId("leave")
      .setLabel("Leave 🟥")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn);

    const sent = await channel.send({ embeds: [embed], components: [row] });

    msg.reply("📌 Test event sent — will auto-delete in **10 seconds**.");

    setTimeout(() => sent.delete().catch(() => {}), 10000);

  } catch (e) {
    console.error("createevent error:", e);
  }
});

// --------------------------------------------------
// EXPRESS KEEP ALIVE (RENDER / RAILWAY / GITHUB PAGES BOTU)
// --------------------------------------------------

const app = express();
app.get("/", (req, res) => res.send("Bot is running."));
app.listen(process.env.PORT || 3000);

// --------------------------------------------------
// LOGIN
// --------------------------------------------------

client.login(TOKEN);
