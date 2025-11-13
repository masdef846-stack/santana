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

client.once("ready", () => {
  console.log(`${client.user.tag} aktif!`);
  
  // Her saatin 30. dakikasında otomatik etkinlik başlat
  cron.schedule("30 * * * *", async () => {
    const channel = await client.channels.fetch(CHANNEL_ID);
    startEvent(channel, "🚀 Informal Event", "🟩 Katıl butonuna basarak listeye adını yazdır!\n🟥 Çık butonuyla listeden ayrılabilirsin.");
  });
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!")) return;

  const args = message.content.split(" ");
  const command = args.shift().toLowerCase();

  // 🔹 Manuel event oluşturma komutu
  if (command === "!createevent") {
    if (activeEvent) {
      return message.reply("⚠️ Zaten aktif bir etkinlik var! Önce `!cancel` ile iptal et.");
    }

    const title = args[0] ? args[0].replaceAll("_", " ") : "🚀 Custom Event";
    const description = args.slice(1).join(" ") || "🟩 Katıl butonuna basarak listeye adını yazdır!\n🟥 Çık butonuyla listeden ayrılabilirsin.";

    startEvent(message.channel, title, description);
    message.reply("✅ Etkinlik başarıyla oluşturuldu!");
  }

  // 🔹 Event iptal etme komutu
  if (command === "!cancel") {
    if (!activeEvent) return message.reply("❌ Aktif bir etkinlik yok!");
    
    await endEvent("🚫 Etkinlik iptal edildi!", "Manager tarafından iptal edildi ❌");
    message.reply("🛑 Etkinlik başarıyla iptal edildi!");
  }
});

// 🔧 Etkinlik başlatma fonksiyonu
async function startEvent(channel, title, description) {
  if (activeEvent) return;
  let participants = [];

  const joinButton = new ButtonBuilder()
    .setCustomId("join")
    .setLabel("Katıl 🟩")
    .setStyle(ButtonStyle.Success);

  const leaveButton = new ButtonBuilder()
    .setCustomId("leave")
    .setLabel("Çık 🟥")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(joinButton, leaveButton);

  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle(`${title} — Registration Open!`)
    .setDescription(description)
    .addFields({ name: "🏆 Main Roster (0/10)", value: "_Henüz kimse katılmadı._" })
    .setFooter({ text: "Kayıtlar 10 kişiyle kapanır. İyi oyunlar! 🎉" })
    .setTimestamp();

  const message = await channel.send({ embeds: [embed], components: [row] });
  activeEvent = { message, participants };

  const collector = message.createMessageComponentCollector({ time: 60 * 60 * 1000 }); // 1 saat açık kalır

  collector.on("collect", async (interaction) => {
    if (!interaction.isButton()) return;
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (interaction.customId === "join") {
      if (participants.find(p => p.id === member.id)) {
        await interaction.reply({ content: "Zaten listedesin!", ephemeral: true });
        return;
      }
      if (participants.length >= 10) {
        await interaction.reply({ content: "Liste doldu! Katılım kapandı.", ephemeral: true });
        return;
      }

      participants.push({ id: member.id, name: member.displayName });
      await updateEventMessage();
      await interaction.reply({ content: "Başarıyla listeye eklendin ✅", ephemeral: true });
    }

    if (interaction.customId === "leave") {
      const index = participants.findIndex(p => p.id === member.id);
      if (index === -1) {
        await interaction.reply({ content: "Listede değilsin!", ephemeral: true });
        return;
      }
      participants.splice(index, 1);
      await updateEventMessage();
      await interaction.reply({ content: "Listeden çıktın ❌", ephemeral: true });
    }

    async function updateEventMessage() {
      const rosterText = participants
        .map((p, i) => `${i + 1}. ${p.name}`)
        .join("\n") || "_Henüz kimse katılmadı._";

      const updatedEmbed = EmbedBuilder.from(embed)
        .setFields({ name: `🏆 Informal Roster (${participants.length}/10)`, value: rosterText });

      if (participants.length >= 10) {
        const closedRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(joinButton).setDisabled(true),
          ButtonBuilder.from(leaveButton).setDisabled(false)
        );
        updatedEmbed
          .setTitle(`${title} — CLOSED ✅`)
          .setDescription("🔴 Registration is closed!\nTüm slotlar doldu 🎉");

        await message.edit({ embeds: [updatedEmbed], components: [closedRow] });
      } else {
        await message.edit({ embeds: [updatedEmbed], components: [row] });
      }
    }
  });

  collector.on("end", async () => {
    if (activeEvent) {
      await endEvent("⏰ Süre doldu!", "Etkinlik otomatik olarak kapandı ⌛");
    }
  });

  // event bittiğinde mesajı düzenle
  async function endEvent(endTitle, endDesc) {
    const finalEmbed = EmbedBuilder.from(embed)
      .setTitle(endTitle)
      .setDescription(endDesc)
      .setColor("#ff4747");

    await activeEvent.message.edit({ embeds: [finalEmbed], components: [] });
    activeEvent = null;
  }
}

// Express (aktif tutmak için)
const app = express();
const port = 3000;
app.get("/", (req, res) => res.send("Bot çalışıyor!"));
app.listen(port, () => console.log(`Web server ${port} portunda aktif.`));

client.login(TOKEN);
