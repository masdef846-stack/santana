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

  const embed = new EmbedBuilder()
    .setColor("#0d0d0d")
    .setThumbnail("https://i.hizliresim.com/sbpz118.png") // LOGO BURAYA!
    .setTitle(`🔥 ${title.toUpperCase()} — INFORMAL EVENT`)
    .setDescription(
      "```diff\n" +
      "+ █▀▀▀▀▀▀▀▀▀ EVENT ANNOUNCEMENT ▀▀▀▀▀▀▀▀▀█\n" +
      "```\n" +
      "**Registration is now OPEN!**\n" +
      "Use the buttons below to join or leave the roster.\n\n" +
      "────────────────────────"
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
    .setFooter({
      text: "Santana Family"
    })
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

    // JOIN
    if (interaction.customId === "join") {
      if (
        activeEvent.participants.some((p) => p.id === id) ||
        activeEvent.backups.some((p) => p.id === id)
      ) {
        return interaction.reply({ content: "You are already listed!", ephemeral: true });
      }

      if (activeEvent.participants.length < 10) {
        activeEvent.participants.push({ id, name });
      } else if (activeEvent.backups.length < 5) {
        activeEvent.backups.push({ id, name });
      } else {
        return interaction.reply({
          content: "Main + Backup rosters are full!",
          ephemeral: true
        });
      }
    }

    // LEAVE
    if (interaction.customId === "leave") {
      activeEvent.participants = activeEvent.participants.filter((p) => p.id !== id);
      activeEvent.backups = activeEvent.backups.filter((p) => p.id !== id);
    }

    updateEmbed();
    interaction.reply({ content: "Updated!", ephemeral: true });
  });

  async function updateEmbed() {
    const mainList =
      activeEvent.participants.length > 0
        ? activeEvent.participants.map((p, i) => `**${i + 1}.** <@${p.id}>`).join("\n")
        : "_No players yet_";

    const backupList =
      activeEvent.backups.length > 0
        ? activeEvent.backups.map((p, i) => `**${i + 1}.** <@${p.id}>`).join("\n")
        : "_Empty_";

    const updated = EmbedBuilder.from(activeEvent.embedBase).setFields(
      {
        name: "**🏆 MAIN ROSTER (10 Slots)**",
        value: mainList,
        inline: false
      },
      {
        name: "────────────────────────",
        value: "\u200b",
        inline: false
      },
      {
        name: "**📥 BACKUP ROSTER (5 Slots)**",
        value: backupList,
        inline: false
      }
    );

    await activeEvent.message.edit({ embeds: [updated] });
  }
}
