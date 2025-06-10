// Load environment variables in development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Name of the role to give users
const SPECIAL_ROLE_NAME = "The Marked";

client.on("ready", () => {
  console.log(`[${new Date().toISOString()}] Logged in as ${client.user.tag}!`);
  console.log(`Bot is monitoring ${client.guilds.cache.size} server(s)`);

  // Set bot activity status
  client.user.setActivity("for the marked hour...", { type: 3 }); // Type 3 = Watching
});

client.on("messageCreate", async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Get current time
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Check if it's 8:17 AM (8:17) or PM (20:17)
  if ((hours === 8 || hours === 20) && minutes === 17) {
    try {
      // Create the join button
      const joinButton = new ButtonBuilder()
        .setCustomId("join_the_marked")
        .setLabel("🔮 Join The Marked")
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(joinButton);

      // Cipher message (your original YouTube link)
      const cipherMessage = "https://www.youtube.com/watch?v=P1qW_epFRnc";

      // Send PRIVATE DM with cipher and button
      await message.author.send({
        content: `**The time has come...**\n\n\`\`\`${cipherMessage}\`\`\`\n\n*This will be your last chance to turn away.*`,
        components: [row],
      });

      console.log(
        `[${new Date().toISOString()}] Sent cipher message to ${
          message.author.username
        } for messaging at 8:17`
      );
    } catch (error) {
      console.error("Error sending DM:", error);
      // If DM fails, could optionally try a public ephemeral message instead
      try {
        await message.reply({
          content:
            "*Something was meant for your eyes only, but your DMs are closed! Please enable DMs from server members.*",
        });
      } catch (replyError) {
        console.log("Could not send fallback message either");
      }
    }
  }
});

// Handle button clicks
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // Check if it's our join button
  if (interaction.customId === "join_the_marked") {
    try {
      // Since this is clicked from a DM, we need to find the user in the guild
      // We'll get the first guild the bot is in (since you mentioned it's just 1 server)
      const guild = client.guilds.cache.first();

      if (!guild) {
        await interaction.reply({
          content: "❌ Cannot find the server. The ritual has failed...",
          ephemeral: true,
        });
        return;
      }

      const member = await guild.members.fetch(interaction.user.id);

      // Find the special role
      const specialRole = guild.roles.cache.find(
        (role) => role.name === SPECIAL_ROLE_NAME
      );

      if (!specialRole) {
        await interaction.reply({
          content: `❌ Role "${SPECIAL_ROLE_NAME}" not found! The ritual cannot be completed...`,
          ephemeral: true,
        });
        return;
      }

      // Check if user already has the role
      if (member.roles.cache.has(specialRole.id)) {
        await interaction.reply({
          content: `✅ You are already one of **The Marked**. The symbol burns within you...`,
          ephemeral: true,
        });
        return;
      }

      // Add the role to the user
      await member.roles.add(specialRole);

      // Respond to the button click with mysterious message
      await interaction.reply({
        content: ` **You have been Marked...**\n\n*The veil has been lifted. You now see what others cannot. Welcome to the inner circle.*\n\nNew paths have opened to you...`,
        ephemeral: true,
      });

      console.log(
        `[${new Date().toISOString()}] ${
          member.user.username
        } joined The Marked via button click`
      );
    } catch (error) {
      console.error("Error handling button click:", error);
      await interaction.reply({
        content:
          "❌ The ritual has failed... Please contact the administrators.",
        ephemeral: true,
      });
    }
  }
});

// Enhanced error handling for production
client.on("error", (error) => {
  console.error(`[${new Date().toISOString()}] Discord client error:`, error);
});

client.on("warn", (warning) => {
  console.warn(
    `[${new Date().toISOString()}] Discord client warning:`,
    warning
  );
});

client.on("disconnect", () => {
  console.log(`[${new Date().toISOString()}] Bot disconnected from Discord`);
});

client.on("reconnecting", () => {
  console.log(
    `[${new Date().toISOString()}] Bot is reconnecting to Discord...`
  );
});

// Graceful shutdown handling
process.on("SIGINT", () => {
  console.log(
    `[${new Date().toISOString()}] Received SIGINT, shutting down gracefully...`
  );
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log(
    `[${new Date().toISOString()}] Received SIGTERM, shutting down gracefully...`
  );
  client.destroy();
  process.exit(0);
});

// Keep-alive server for free hosting platforms
const http = require("http");
const server = http.createServer((req, res) => {
  console.log(
    `[${new Date().toISOString()}] HTTP request received: ${req.url}`
  );
  res.writeHead(200, {
    "Content-Type": "text/html",
    "Access-Control-Allow-Origin": "*",
  });

  const status = `
<!DOCTYPE html>
<html>
<head>
    <title>The Marked Bot Status</title>
    <style>
        body { font-family: Arial, sans-serif; background: #1a1a1a; color: #fff; text-align: center; padding: 50px; }
        .status { background: #2a2a2a; padding: 20px; border-radius: 10px; display: inline-block; }
        .online { color: #4CAF50; }
    </style>
</head>
<body>
    <div class="status">
        <h1>🔮 The Marked Bot</h1>
        <p class="online">✅ Bot Status: ${
          client.isReady() ? "Online & Connected" : "Starting..."
        }</p>
        <p>⏱️ Uptime: ${Math.floor(process.uptime())} seconds</p>
        <p>🕐 Last Restart: ${new Date().toISOString()}</p>
        <p>📊 Monitoring: ${
          client.guilds ? client.guilds.cache.size : 0
        } server(s)</p>
        <p>🌐 Server Time: ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;

  res.end(status);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[${new Date().toISOString()}] Keep-alive server running on port ${PORT}`
  );
});

// Self-ping to prevent sleeping (every 14 minutes)
setInterval(() => {
  const url = `https://the-marked-discord-bot.onrender.com`;
  console.log(`[${new Date().toISOString()}] Self-ping to prevent sleeping...`);

  // Simple HTTP request to keep alive
  const https = require("https");
  https
    .get(url, (res) => {
      console.log(
        `[${new Date().toISOString()}] Self-ping successful: ${res.statusCode}`
      );
    })
    .on("error", (err) => {
      console.log(
        `[${new Date().toISOString()}] Self-ping failed:`,
        err.message
      );
    });
}, 14 * 60 * 1000); // 14 minutes

// Login with token from environment variable or fallback
const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
if (!token) {
  console.error(
    "❌ No Discord token found! Please set DISCORD_TOKEN environment variable."
  );
  process.exit(1);
}

client.login(token);
