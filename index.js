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

// GLOBAL END FUNCTION
async function endEvent(endTitle, endDesc) {
  if (!activeEvent) return;

  const finalEmbed = EmbedBuilder.from(activeEvent.baseEmbed)
    .setTitle(endTitle)
    .setDescription(endDesc)
    .setColor("#ff4747");

  await activeEvent.message.edit({ embeds: [finalEmbed], components: [] });
  activeEvent = null;
}

client.once("ready", () => {
  console.log(`${client.user.tag} aktif!`);

  cron.schedule("30 * * * *", async () => {
    const channel = await client.channels.fetch(CHANNEL_ID);
    startEvent(channel, "🔥 Informal Event", "🟩 Join — 🟥 Leave");
  });
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!")) return;
  const args = message.content.split(" ");
  const command = args.shift().toLowerCase();

  if (command === "!createevent") {
    if (activeEvent) return message.reply("⚠️ Already an active event!");

    const title = args[0] ? args[0].replaceAll("_", " ") : "🔥 Informal Event";
    const desc = args.slice(1).join(" ") || "🟩 Join — 🟥 Leave";

    startEvent(message.channel, title, desc);
    message.reply("✅ Event created!");
  }

  if (command === "!cancel") {
    if (!activeEvent) return message.reply("❌ No active event!");
    await endEvent("🚫 Event cancelled!", "Closed by admin ❌");
    message.reply("🛑 Event cancelled!");
  }
});

// ========================================================
// START EVENT  (TASARIM YENİLENDİ)
// ========================================================
async function startEvent(channel, title, description) {
  if (activeEvent) return;

  const guild = channel.guild;
  const informalRole = guild.roles.cache.get("1373714215394873706");

  let participants = [];

  if (informalRole) {
    participants = informalRole.members.map(m => ({
      id: m.id,
      name: m.displayName
    }));
  }

  const joinButton = new ButtonBuilder()
    .setCustomId("join")
    .setLabel("Join 🟩")
    .setStyle(ButtonStyle.Success);

  const leaveButton = new ButtonBuilder()
    .setCustomId("leave")
    .setLabel("Leave 🟥")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(joinButton, leaveButton);

  // ------------------------------------------------------
  // 🆕 YENİ TASARIM EMBED 
  // ------------------------------------------------------
  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setThumbnail("YOUR_LOGO_URL") 
    .setDescription(
`
> ⚔️ **- Informal Event -**  ${participants.length < 10 ? "**OPEN** ✔️" : "**CLOSED** ✔️"}

**Participants:** ${participants.length}/10

━━━━━━━━━━━━━━━━━━━━━━

### 🗡️ **Main Roster:**  
${participants.length > 0 
  ? participants.map((p, i) => `${i + 1}. <@${p.id}>`).join("\n")
  : "> _Waiting for participants..._"}

━━━━━━━━━━━━━━━━━━━━━━

### ⭐ **Subs List:**  
> _Waiting for substitutes..._

━━━━━━━━━━━━━━━━━━━━━━

🎉 **Have fun!**  
🕒 ${new Date().toLocaleTimeString("en-US", { hour12: false })}
`
    )
    .setFooter({ text: "Informal Activity Panel" })
    .setAuthor({
      name: "​",
      iconURL: "https://dummyimage.com/20x600/ff0000/ff0000" // sol kırmızı çizgi
    });

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
    const member = await interaction.guild.members.fetch(id);

    if (interaction.customId === "join") {
      if (activeEvent.participants.find(p => p.id === id)) {
        return interaction.reply({ content: "Already in the list!", ephemeral: true });
      }

      if (activeEvent.participants.length >= 10) {
        return interaction.reply({ content: "Roster is full!", ephemeral: true });
      }

      activeEvent.participants.push({ id, name: member.displayName });
    }

    if (interaction.customId === "leave") {
      activeEvent.participants = activeEvent.participants.filter(p => p.id !== id);
    }

    await updateEventMessage();
    await interaction.reply({ content: "Done!", ephemeral: true });
  });

  collector.on("end", async () => {
    if (activeEvent) {
      await endEvent("⏰ Time is up!", "Event closed automatically ⌛");
    }
  });

  // UPDATE EMBED
  async function updateEventMessage() {
    const roster = activeEvent.participants.length
      ? activeEvent.participants.map((p, i) => `${i + 1}. <@${p.id}>`).join("\n")
      : "> _Waiting for participants..._";

    const updatedEmbed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setThumbnail("https://i.hizliresim.com/sbpz118.png")
      .setDescription(
`
> ⚔️ **- Informal Event -**  ${activeEvent.participants.length < 10 ? "**OPEN** ✔️" : "**CLOSED** ✔️"}

**Participants:** ${activeEvent.participants.length}/10

━━━━━━━━━━━━━━━━━━━━━━

### 🗡️ **Main Roster:**  
${roster}

━━━━━━━━━━━━━━━━━━━━━━

### ⭐ **Subs List:**  
> _Waiting for substitutes..._

━━━━━━━━━━━━━━━━━━━━━━

🎉 **Have fun!**  
🕒 ${new Date().toLocaleTimeString("en-US", { hour12: false })}
`
      )
      .setFooter({ text: "Informal Activity Panel" })
      .setAuthor({
        name: "​",
        iconURL: "https://dummyimage.com/20x600/ff0000/ff0000"
      });

    await activeEvent.message.edit({
      embeds: [updatedEmbed],
      components: [row]
    });
  }
}

// EXPRESS KEEP ALIVE
const app = express();
const port = 3000;
app.get("/", (req, res) => res.send("Bot çalışıyor!"));
app.listen(port, () => console.log(`Web server ${port} portunda aktif.`));

client.login(TOKEN);
