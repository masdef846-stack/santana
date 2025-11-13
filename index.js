// ---------------------------------------------------------
//  Santana Event System — Full Final Version (Slash + Auto 30)
// ---------------------------------------------------------

require("dotenv").config();
const express = require("express");
const cron = require("node-cron");

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
} = require("discord.js");

// ------------------------
//  CLIENT
// ------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

let activeEvent = null;

// --------------------------------------------
//  SLASH COMMAND (ONLY SPECIFIC ROLE CAN USE)
// --------------------------------------------
client.once("ready", async () => {
  console.log(`Bot logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("createevent")
      .setDescription("Creates a one-time event to be sent at a specific time.")
      .addStringOption(opt =>
        opt.setName("title")
          .setDescription("Event title")
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName("time")
          .setDescription("Format: HH:MM")
          .setRequired(true)
      )
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log("Slash commands registered.");
});

// --------------------------------------------------
//  EVERY DAY EVERY HOUR AT :30 (AUTOMATIC EVENT)
// --------------------------------------------------
cron.schedule("30 * * * *", async () => {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    console.log("Automatic 30-minute event sent.");
    sendEventEmbed(channel, "AUTO EVENT");
  } catch (e) {
    console.log("Auto event error:", e);
  }
});

// --------------------------------------------------
//  SLASH COMMAND EXECUTION
// --------------------------------------------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "createevent") return;

  // ROLE CHECK
  const REQUIRED_ROLE = "LEADERS"; // BURAYI DEĞİŞTİR

  if (!interaction.member.roles.cache.some(r => r.name === REQUIRED_ROLE)) {
    return interaction.reply({
      content: "❌ You do not have permission to use this command.",
      ephemeral: true
    });
  }

  const title = interaction.options.getString("title");
  const inputTime = interaction.options.getString("time"); // "23:02"

  if (!/^\d\d:\d\d$/.test(inputTime)) {
    return interaction.reply({ content: "Invalid time format. Use HH:MM", ephemeral: true });
  }

  const [h, m] = inputTime.split(":").map(Number);
  const now = new Date();
  const target = new Date();

  target.setHours(h, m, 0, 0);

  if (target < now) {
    return interaction.reply({ content: "Time already passed today.", ephemeral: true });
  }

  interaction.reply({
    content: `Event scheduled at **${inputTime}**.`,
    ephemeral: true
  });

  setTimeout(async () => {
    const channel = await client.channels.fetch(CHANNEL_ID);
    sendEventEmbed(channel, title);
  }, target - now);
});

// --------------------------------------------------
//  EVENT EMBED SYSTEM
// --------------------------------------------------
async function sendEventEmbed(channel, title) {
  let participants = [];
  let backups = [];

  const joinButton = new ButtonBuilder()
    .setCustomId("join")
    .setLabel("Join 🟩")
    .setStyle(ButtonStyle.Success);

  const leaveButton = new ButtonBuilder()
    .setCustomId("leave")
    .setLabel("Leave 🟥")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(joinButton, leaveButton);

  // -----------------------------
  //  ESPORTS DESIGN EMBED
  // -----------------------------
  const embed = new EmbedBuilder()
    .setColor("#0d0d0d")
    .setThumbnail("https://i.hizliresim.com/sbpz118.png") // LOGO
    .setTitle(`🔥 ${title.toUpperCase()} — INFORMAL EVENT`)
    .setDescription(
`​\`\`\`diff
+ █▀▀▀▀▀▀▀▀▀ EVENT ANNOUNCEMENT ▀▀▀▀▀▀▀▀▀█
\`\`\`

**Registration is now OPEN!**
Click buttons below to join or leave the event roster.

────────────────────────`
    )
    .addFields(
      {
        name: "**🏆 MAIN ROSTER (10 Slots)**",
        value: "_No players yet_",
        inline: false
      },
      {
        name: "────────────────────────",
        value: "\u200b",
        inline: false
      },
      {
        name: "**📥 BACKUP ROSTER (5 Slots)**",
        value: "_Empty_",
        inline: false
      }
    )
    .setFooter({ text: "Santana Family" })
    .setTimestamp();

  const msg = await channel.send({ embeds: [embed], components: [row] });

  activeEvent = {
    message: msg,
    participants,
    backups,
    title,
    embedBase: embed
  };

  const collector = msg.createMessageComponentCollector();

  collector.on("collect", async (interaction) => {
    if (!interaction.isButton()) return;

    const id = interaction.user.id;
    const name = interaction.member.displayName;

    if (interaction.customId === "join") {
      if (participants.some(p => p.id === id) || backups.some(p => p.id === id)) {
        return interaction.reply({ content: "You're already listed.", ephemeral: true });
      }

      if (participants.length < 10) participants.push({ id, name });
      else if (backups.length < 5) backups.push({ id, name });
      else {
        return interaction.reply({ content: "All rosters are full!", ephemeral: true });
      }
    }

    if (interaction.customId === "leave") {
      participants = participants.filter(p => p.id !== id);
      backups = backups.filter(p => p.id !== id);
    }

    updateEmbed();
    interaction.reply({ content: "Updated!", ephemeral: true });
  });

  async function updateEmbed() {
    const mainList = participants.length
      ? participants.map((p, i) => `**${i + 1}.** <@${p.id}>`).join("\n")
      : "_No players yet_";

    const backupList = backups.length
      ? backups.map((p, i) => `**${i + 1}.** <@${p.id}>`).join("\n")
      : "_Empty_";

    const updated = EmbedBuilder.from(embed).setFields(
      {
        name: "**🏆 MAIN ROSTER (10 Slots)**",
        value: mainList
      },
      {
        name: "────────────────────────",
        value: "\u200b"
      },
      {
        name: "**📥 BACKUP ROSTER (5 Slots)**",
        value: backupList
      }
    );

    await msg.edit({ embeds: [updated], components: [row] });
  }
}

// ------------------------------
//  KEEP ALIVE SERVER (FOR HOSTS)
// ------------------------------
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(3000, () => console.log("Keep-alive server on."));

client.login(TOKEN);
