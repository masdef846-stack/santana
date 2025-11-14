// INFORMAL EVENT SYSTEM (FINAL VERSION)
// ✔ No automatic players
// ✔ Join = adds to roster
// ✔ First 10 → Main Roster
// ✔ Others → Subs
// ✔ Leave removes user
// ✔ Clean wide UI + red left bar + 🔴 participants emoji

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    Events,
} = require("discord.js");

const express = require("express");


const joinedUsers = new Map(); // Stores users who clicked JOIN

module.exports = {
    name: "informal",
    description: "Create an informal event panel.",
    run: async (client, message) => {
        const eventId = Date.now();
        joinedUsers.set(eventId, new Set());

        const joinBtn = new ButtonBuilder()
            .setCustomId(`join_${eventId}`)
            .setLabel("Join")
            .setStyle(ButtonStyle.Success);

        const leaveBtn = new ButtonBuilder()
            .setCustomId(`leave_${eventId}`)
            .setLabel("Leave")
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn);

        const embed = new EmbedBuilder()
            .setColor("#2f3136")
            .setTitle("⚔️・Informal Event - OPEN ✓")
            .setDescription(
                `🔴 **Participants:** 0/10\n\n` +
                `────────────────────────\n\n` +
                `📝 **Main Roster:**\n` +
                `*Waiting for players...*\n\n` +
                `────────────────────────\n\n` +
                `⭐ **Subs List:**\n` +
                `*Waiting for substitutes...*\n\n` +
                `────────────────────────\n\n` +
                `🎉 **Have fun!**`
            )
            .setThumbnail("https://i.imgur.com/OxN7sX8.png") // Replace with your logo URL
            .setFooter({ text: "Informal Activity Panel" });

        const panel = await message.channel.send({ embeds: [embed], components: [row] });

        const updateEmbed = () => {
            const users = Array.from(joinedUsers.get(eventId));
            const main = users.slice(0, 10);
            const subs = users.slice(10);

            const participantsCount = users.length;

            const mainText = main.length > 0
                ? main
                    .map((u, i) => `${i + 1}. <@${u.id}> | ${u.score}`)
                    .join("\n")
                : "*Waiting for players...*";

            const subsText = subs.length > 0
                ? subs
                    .map((u, i) => `${i + 1}. <@${u.id}> | ${u.score}`)
                    .join("\n")
                : "*Waiting for substitutes...*";

            const updated = new EmbedBuilder()
                .setColor("#2f3136")
                .setTitle(`⚔️・Informal Event - ${participantsCount >= 10 ? "CLOSED" : "OPEN"} ✓`)
                .setThumbnail("https://i.imgur.com/OxN7sX8.png") 
                .setDescription(
                    `🔴 **Participants:** ${participantsCount}/10\n\n` +
                    `────────────────────────\n\n` +
                    `📝 **Main Roster:**\n${mainText}\n\n` +
                    `────────────────────────\n\n` +
                    `⭐ **Subs List:**\n${subsText}\n\n` +
                    `────────────────────────\n\n` +
                    `🎉 **Have fun!**`
                )
                .setFooter({ text: "Informal Activity Panel" });

            panel.edit({ embeds: [updated] });
        };

        client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isButton()) return;

            if (interaction.customId === `join_${eventId}`) {
                const user = {
                    id: interaction.user.id,
                    score: Math.floor(Math.random() * 300000) + 10000, // Example placeholder (you replace with your score system)
                };

                const currentSet = joinedUsers.get(eventId);

                if (currentSet.has(user.id)) {
                    return interaction.reply({ content: "You are already registered!", ephemeral: true });
                }

                currentSet.add(user);

                updateEmbed();

                return interaction.reply({ content: "You joined the event!", ephemeral: true });
            }

            if (interaction.customId === `leave_${eventId}`) {
                const currentSet = joinedUsers.get(eventId);

                const found = Array.from(currentSet).find(u => u.id === interaction.user.id);
                if (!found) {
                    return interaction.reply({ content: "You're not in the event!", ephemeral: true });
                }

                currentSet.delete(found);

                updateEmbed();
                return interaction.reply({ content: "You left the event.", ephemeral: true });
            }
        });
    },
};

// EXPRESS KEEP ALIVE
const app = express();
const port = 3000;
app.get("/", (req, res) => res.send("Bot çalışıyor!"));
app.listen(port, () => console.log(`Web server ${port} portunda aktif.`));

client.login(TOKEN);
