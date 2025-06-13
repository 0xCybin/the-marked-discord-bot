// ========================================
// FILE: src/events/messageCreate.js
// PURPOSE: Enhanced message handler with detailed DM debugging
// ========================================

const dmHandler = require("../services/messageGeneration");
const timeBasedHandler = require("../services/timeBasedMessages");
const commandHandler = require("../commands/index");
const config = require("../config/environment");
const logger = require("../utils/logger");

/**
 * Message creation event handler with enhanced debugging
 * @param {Object} message - Discord message object
 */
module.exports = async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // ENHANCED LOGGING: Log ALL incoming messages
  console.log(`\n📨 MESSAGE RECEIVED:`);
  console.log(`   From: ${message.author.username} (${message.author.id})`);
  console.log(`   Content: "${message.content}"`);
  console.log(`   Channel Type: ${message.channel.type}`);
  console.log(`   Is DM: ${message.channel.type === 1}`);
  console.log(
    `   Guild: ${message.guild ? message.guild.name : "No Guild (DM)"}`
  );
  console.log(`   Time: ${new Date().toLocaleString()}`);

  try {
    // Check if this is a DM
    const isDM = message.channel.type === 1;

    if (isDM) {
      console.log(`   🔍 PROCESSING AS DM...`);

      // Log that we're about to call the DM handler
      console.log(`   📞 Calling DM handler...`);
      await dmHandler.handleDMResponse(message);
      console.log(`   ✅ DM handler completed`);
      return;
    }

    console.log(`   🏛️ PROCESSING AS GUILD MESSAGE...`);

    // Handle time-based messages (8:17 system) in guild channels
    if (message.guild) {
      console.log(`   ⏰ Checking 8:17 system...`);
      await timeBasedHandler.handle817Messages(message);

      // Handle text commands
      console.log(`   ⚡ Checking for commands...`);
      await commandHandler.handleMessage(message);
    }

    console.log(`   ✅ Guild message processing completed`);
  } catch (error) {
    console.error(`   ❌ ERROR PROCESSING MESSAGE:`, error);
    logger.error("Error handling message:", error);

    // Don't reply with errors in production to maintain ARG immersion
    if (config.app.testingMode) {
      try {
        await message.reply("*Error in the matrix... signal corrupted...*");
      } catch (replyError) {
        logger.debug("Could not send error message");
      }
    }
  }

  console.log(`   📋 Message processing finished\n`);
};
