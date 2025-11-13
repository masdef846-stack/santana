const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Partials
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

let activeEvent = null;

// ---------- END EVENT ----------
async function endEvent(endTitle, endDesc) {
  if (!activeEvent) return;

  const finalEmbed = EmbedBuilder.from(activeEvent.baseEmbed)
    .setTitle(endTitle)
    .setDescription(endDesc)
    .setColor("#ff4747");

  await activeEvent.message.edit({ embeds: [finalEmbed], components: [] });
  activeEvent = null;
}

// ---------- BOT READY ----------
client.once("ready", () => {
  console.log(`${client.user.tag} is online!`);

  cron.schedule("30 * * * *", async () => {
    const channel = await client.channels.fetch(CHANNEL_ID);
    startEvent(channel, "⚡ Informal Activity", "🟢 Join — 🔴 Leave");
  });
});

// ---------- MESSAGE COMMANDS ----------
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!")) return;
  const args = message.content.split(" ");
  const command = args.shift().toLowerCase();

  if (command === "!createevent") {
    if (activeEvent) return message.reply("⚠️ There is already an active event!");

    const title = args[0] ? args[0].replaceAll("_", " ") : "⚡ Custom Activity";
    const desc = args.slice(1).join(" ") || "🟢 Join — 🔴 Leave";

    startEvent(message.channel, title, desc);
    message.reply("✅ Event created!");
  }

  if (command === "!cancel") {
    if (!activeEvent) return message.reply("❌ No active event exists!");
    await endEvent("🚫 Event Cancelled", "Closed by an authorized user.");
    message.reply("🛑 Event cancelled!");
  }
});

// =========================================
//          START EVENT — PREMIUM THEME
// =========================================
async function startEvent(channel, title, description) {
  if (activeEvent) return;

  const guild = channel.guild;

  const informalRole = guild.roles.cache.get("1373714215394873706");

  let participants = informalRole
    ? informalRole.members.map(m => ({ id: m.id, name: m.displayName }))
    : [];

  const joinButton = new ButtonBuilder()
    .setCustomId("join")
    .setLabel("Join 🟢")
    .setStyle(ButtonStyle.Success);

  const leaveButton = new ButtonBuilder()
    .setCustomId("leave")
    .setLabel("Leave 🔴")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(joinButton, leaveButton);

  const rosterText = participants.length
    ? participants.map((p, i) => `${i + 1}. <@${p.id}>`).join("\n")
    : "_No participants yet._";

  // ============================================
  //   ⬇⬇ NEW ULTRA CLEAN & PREMIUM THEME ⬇⬇
  // ============================================

  const embed = new EmbedBuilder()
    .setColor("#2b2d31") // Discord slate grey
    .setThumbnail("https://i.hizliresim.com/sbpz118.png")
    .setAuthor({
      name: "Informal Activity System",
      iconURL: "https://i.hizliresim.com/sbpz118.png"
    })
    .setTitle(`✨ ${title}`)
    .setDescription(
      "```yaml\n   Informal - Activity Panel\n```\n" +
      `**🔔 Notification Role:** <@&1373714215394873706>\n\n` +
      `**📘 Description:**\n${description}\n` +
      "──────────────────────────"
    )
    .addFields({
      name: `🏆 Participant List (${participants.length}/10)`,
      value: rosterText,
      inline: false
    })
    .setFooter({
      text: "Santana Family • Activity System",
      iconURL: "https://i.hizliresim.com/sbpz118.png",
    })
    .setTimestamp();

  const msg = await channel.send({ embeds: [embed], components: [row] });

  activeEvent = {
    message: msg,
    participants,
    baseEmbed: embed
  };

  const collector = msg.createMessageComponentCollector({ time: 60 * 60 * 1000 });

  collector.on("collect", async (interaction) => {
    if (!interaction.isButton()) return;

    const id = interaction.user.id;

    if (interaction.customId === "join") {
      if (activeEvent.participants.find(p => p.id === id)) {
        return interaction.reply({ content: "You are already in the list!", ephemeral: true });
      }
      if (activeEvent.participants.length >= 10) {
        return interaction.reply({ content: "The participant list is full!", ephemeral: true });
      }

      activeEvent.participants.push({ id });
    }

    if (interaction.customId === "leave") {
      activeEvent.participants = activeEvent.participants.filter(p => p.id !== id);
    }

    await updateEvent();
    interaction.reply({ content: "Updated!", ephemeral: true });
  });

  collector.on("end", async () => {
    if (activeEvent) await endEvent("⌛ Time Expired", "The event is now closed.");
  });

  // ---------- UPDATE ----------
  async function updateEvent() {
    const roster = activeEvent.participants.length
      ? activeEvent.participants.map((p, i) => `${i + 1}. <@${p.id}>`).join("\n")
      : "_No participants yet._";

    const updatedEmbed = EmbedBuilder.from(activeEvent.baseEmbed)
      .setFields({
        name: `🏆 Participant List (${activeEvent.participants.length}/10)`,
        value: roster
      });

    await activeEvent.message.edit({ embeds: [updatedEmbed], components: [row] });
  }
}

// ---------- EXPRESS ----------
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(3000, () => console.log("Web server active."));

client.login(TOKEN);
