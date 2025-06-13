// ========================================
// FILE: src/events/index.js
// PURPOSE: Event handler registry and setup - WITH NICKNAME PROTECTION
// ========================================

const ready = require("./ready");
const messageCreate = require("./messageCreate");
const guildMemberAdd = require("./guildMemberAdd");
const guildMemberUpdate = require("./guildMemberUpdate"); // 🔥 NEW - Nickname protection
const interactionCreate = require("./interactionCreate");
const logger = require("../utils/logger");

/**
 * Registers all event handlers with the Discord client
 * @param {Object} client - Discord client instance
 */
function register(client) {
  logger.info("📡 Registering event handlers...");

  // Core event handlers
  client.on("ready", ready);
  client.on("messageCreate", messageCreate);
  client.on("guildMemberAdd", guildMemberAdd);
  client.on("guildMemberUpdate", guildMemberUpdate); // 🔥 NEW - Monitors nickname changes
  client.on("interactionCreate", interactionCreate);

  // Error handling events
  client.on("error", (error) => {
    logger.error("Discord client error:", error);
  });

  client.on("warn", (warning) => {
    logger.warn("Discord client warning:", warning);
  });

  client.on("disconnect", () => {
    logger.info("Bot disconnected from Discord");
  });

  client.on("reconnecting", () => {
    logger.info("Bot is reconnecting to Discord...");
  });

  // Rate limit warning
  client.on("rateLimit", (rateLimitData) => {
    logger.warn("Rate limit hit:", {
      timeout: rateLimitData.timeout,
      limit: rateLimitData.limit,
      method: rateLimitData.method,
      path: rateLimitData.path,
      route: rateLimitData.route,
    });
  });

  // Debug events (only in testing mode)
  if (require("../config/environment").app.testingMode) {
    client.on("debug", (info) => {
      // Only log important debug info to avoid spam
      if (info.includes("heartbeat") || info.includes("gateway")) {
        logger.debug(`Discord debug: ${info}`);
      }
    });
  }

  logger.info("✅ Event handlers registered successfully");
  logger.info("🛡️ Nickname protection system active"); // 🔥 NEW
}

module.exports = { register };
