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

// ---------- BİTİRME FONKSİYONU ----------
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
  console.log(`${client.user.tag} aktif!`);

  cron.schedule("30 * * * *", async () => {
    const channel = await client.channels.fetch(CHANNEL_ID);
    startEvent(channel, "🚀 Informal Event", "🟩 Katıl — 🟥 Çık");
  });
});

// ---------- MESSAGE COMMANDS ----------
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!")) return;
  const args = message.content.split(" ");
  const command = args.shift().toLowerCase();

  if (command === "!createevent") {
    if (activeEvent) return message.reply("⚠️ Zaten aktif bir etkinlik var!");

    const title = args[0] ? args[0].replaceAll("_", " ") : "🚀 Custom Event";
    const desc = args.slice(1).join(" ") || "🟩 Katıl — 🟥 Çık";

    startEvent(message.channel, title, desc);
    message.reply("✅ Etkinlik oluşturuldu!");
  }

  if (command === "!cancel") {
    if (!activeEvent) return message.reply("❌ Aktif etkinlik yok!");
    await endEvent("🚫 Etkinlik iptal edildi!", "Yönetici tarafından kapatıldı ❌");
    message.reply("🛑 Etkinlik iptal edildi!");
  }
});

// =========================================
//          START EVENT — TASARIMLI
// =========================================
async function startEvent(channel, title, description) {
  if (activeEvent) return;

  const guild = channel.guild;

  // Informal rol ID → 1373714215394873706
  const informalRole = guild.roles.cache.get("1373714215394873706");

  let participants = informalRole
    ? informalRole.members.map(m => ({ id: m.id, name: m.displayName }))
    : [];

  const joinButton = new ButtonBuilder()
    .setCustomId("join")
    .setLabel("Katıl 🟩")
    .setStyle(ButtonStyle.Success);

  const leaveButton = new ButtonBuilder()
    .setCustomId("leave")
    .setLabel("Çık 🟥")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(joinButton, leaveButton);

  const rosterText = participants.length
    ? participants.map((p, i) => `${i + 1}. <@${p.id}>`).join("\n")
    : "_Kimse katılmadı._";

  // ============================================
  //       GELİŞMİŞ TASARIMLI EMBED
  // ============================================

  const embed = new EmbedBuilder()
    .setColor("#2f3136")
    .setThumbnail("https://i.hizliresim.com/sbpz118.png")
    .setAuthor({
      name: "🔥 Informal Event System",
      iconURL: "https://i.hizliresim.com/sbpz118.png",
    })
    .setDescription(
      "```fix\n      ★ INFORMAL EVENT ★\n```\n" +
      `**📢 <@&1373714215394873706>**\n` +
      "──────────────────────────\n" +
      `📌 **Açıklama:** ${description}\n` +
      "──────────────────────────"
    )
    .addFields({
      name: `🏆 Roster (${participants.length}/10)`,
      value:
        participants.length
          ? rosterText
          : "_Henüz kimse katılmadı._",
      inline: false
    })
    .setFooter({
      text: "Santana Family — Event System",
      iconURL: "https://i.hizliresim.com/sbpz118.png"
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
        return interaction.reply({ content: "Zaten listedesin!", ephemeral: true });
      }
      if (activeEvent.participants.length >= 10) {
        return interaction.reply({ content: "Liste dolu!", ephemeral: true });
      }

      activeEvent.participants.push({ id });
    }

    if (interaction.customId === "leave") {
      activeEvent.participants = activeEvent.participants.filter(p => p.id !== id);
    }

    await updateEvent();
    interaction.reply({ content: "Güncellendi!", ephemeral: true });
  });

  collector.on("end", async () => {
    if (activeEvent) await endEvent("⌛ Süre Doldu", "Etkinlik kapatıldı.");
  });

  // ---------- UPDATE ----------
  async function updateEvent() {
    const roster = activeEvent.participants.length
      ? activeEvent.participants.map((p, i) => `${i + 1}. <@${p.id}>`).join("\n")
      : "_Kimse katılmadı._";

    const updatedEmbed = EmbedBuilder.from(activeEvent.baseEmbed)
      .setFields({
        name: `🏆 Roster (${activeEvent.participants.length}/10)`,
        value: roster
      });

    await activeEvent.message.edit({ embeds: [updatedEmbed], components: [row] });
  }
}

// ---------- EXPRESS ----------
const app = express();
app.get("/", (req, res) => res.send("Bot çalışıyor!"));
app.listen(3000, () => console.log("Web server aktif."));

client.login(TOKEN);
