// INFORMAL EVENT SYSTEM — FINAL + CLEAN + ROSTER FIXED + CRON + !createevent
// By ChatGPT ♥ For my king.

// ==================================================
//  IMPORTS
// ==================================================
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Partials,
  Events
} = require("discord.js");

const express = require("express");
const cron = require("node-cron");
require("dotenv").config();

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel],
});


// ==================================================
//  ACTIVE EVENTS MEMORY
// ==================================================
let activeEvent = null; // only 1 panel at a time
let joined = [];        // users who clicked join


// ==================================================
//  CREATE THE EVENT PANEL
// ==================================================
async function createEvent(channel) {
  joined = []; // reset
  activeEvent = true;

  const joinBtn = new ButtonBuilder()
    .setCustomId("join")
    .setLabel("Join")
    .setStyle(ButtonStyle.Success);

  const leaveBtn = new ButtonBuilder()
    .setCustomId("leave")
    .setLabel("Leave")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn);

  const embed = new EmbedBuilder()
    .setColor("#2f3136")
    .setThumbnail("https://i.imgur.com/OxN7sX8.png") // logo sağ üst
    .setTitle("⚔️・Informal Event — OPEN ✓")
    .setDescription(
      `🔴 **Participants:** 0/10\n\n` +

      `> 📝 **Main Roster:**\n` +
      `*Waiting for players...*\n\n` +

      `> ⭐ **Subs List:**\n` +
      `*Waiting for substitutes...*\n\n` +

      `🎉 Enjoy your activity!`
    )
    .setFooter({ text: "Informal Activity Panel" })
    .setTimestamp();

  const panel = await channel.send({ embeds: [embed], components: [row] });
  activeEvent = panel;

  return panel;
}


// ==================================================
//  UPDATE PANEL UI
// ==================================================
async function updateEvent() {
  if (!activeEvent) return;

  const users = joined;

  const main = users.slice(0, 10);
  const subs = users.slice(10);

  const mainText = main.length
    ? main.map((u, i) => `${i + 1}. <@${u}>`).join("\n")
    : "*Waiting for players...*";

  const subsText = subs.length
    ? subs.map((u, i) => `${i + 1}. <@${u}>`).join("\n")
    : "*Waiting for substitutes...*";

  const embed = new EmbedBuilder()
    .setColor("#2f3136")
    .setThumbnail("https://i.imgur.com/OxN7sX8.png")
    .setTitle(`⚔️・Informal Event — ${users.length >= 10 ? "CLOSED" : "OPEN"} ✓`)
    .setDescription(
      `🔴 **Participants:** ${users.length}/10\n\n` +

      `> 📝 **Main Roster:**\n` +
      `${mainText}\n\n` +

      `> ⭐ **Subs List:**\n` +
      `${subsText}\n\n` +

      `🎉 Enjoy your activity!`
    )
    .setFooter({ text: "Informal Activity Panel" })
    .setTimestamp();

  await activeEvent.edit({ embeds: [embed] });
}


// ==================================================
//  INTERACTION HANDLER (JOIN/LEAVE BUTTONS)
// ==================================================
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (!activeEvent) return;

  const id = interaction.user.id;

  if (interaction.customId === "join") {
    if (!joined.includes(id)) {
      joined.push(id);
    }
    await updateEvent();
    return interaction.reply({ content: "You joined the event!", ephemeral: true });
  }

  if (interaction.customId === "leave") {
    joined = joined.filter(u => u !== id);
    await updateEvent();
    return interaction.reply({ content: "You left the event.", ephemeral: true });
  }
});


// ==================================================
//  MESSAGE COMMAND (!createevent)
// ==================================================
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!createevent")) return;
  if (activeEvent) return message.reply("❌ There is already an active event panel.");

  await createEvent(message.channel);

  return message.reply("✅ Event panel created!");
});


// ==================================================
//  CRON (EVERY 30 MINUTES)
// ==================================================
client.once("ready", () => {
  console.log(`${client.user.tag} is online!`);

  cron.schedule("30 * * * *", async () => {
    const channel = await client.channels.fetch(CHANNEL_ID);

    // kill old panel
    activeEvent = null;
    joined = [];

    await createEvent(channel);
  });
});


// ==================================================
//  EXPRESS KEEP-ALIVE
// ==================================================
const app = express();
const port = 3000;
app.get("/", (req, res) => res.send("Bot çalışıyor!"));
app.listen(port, () => console.log(`Web server ${port} portunda aktif.`));


// ==================================================
//  LOGIN
// ==================================================
client.login(TOKEN);
