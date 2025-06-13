// ========================================
// FILE: src/events/ready.js
// PURPOSE: Bot ready event with initialization and scheduling
// ========================================

const logger = require("../utils/logger");
const selectionService = require("../services/selection");
const config = require("../config/environment");

/**
 * Bot ready event handler
 * Initializes services and starts scheduled tasks
 * @param {Object} client - Discord client instance
 */
module.exports = async (client) => {
  logger.info(`🤖 Bot logged in as ${client.user.tag}`);
  logger.info(`📊 Monitoring ${client.guilds.cache.size} server(s)`);

  // Set bot activity status
  client.user.setActivity("for the marked hour...", { type: 3 });

  // Start weekly selection interval (check every hour during night hours)
  setInterval(async () => {
    try {
      await selectionService.performWeeklySelection();
    } catch (error) {
      logger.error("Error in scheduled selection:", error);
    }
  }, 60 * 60 * 1000); // Every hour

  // Log startup configuration
  logger.info(`🔧 Configuration:`);
  logger.info(`   - Testing Mode: ${config.app.testingMode}`);
  logger.info(`   - Log Level: ${config.app.logLevel}`);
  logger.info(`   - Special Role: ${config.arg.specialRoleName}`);
  logger.info(
    `   - Night Hours: ${config.arg.nightHoursStart}:00 - ${config.arg.nightHoursEnd}:00`
  );

  // Testing mode features
  if (config.app.testingMode) {
    logger.warn("🧪 TESTING MODE ENABLED");
    logger.info("   - Triggering test selection in 10 seconds...");
    logger.info("   - All time constraints bypassed");
    logger.info("   - Enhanced logging enabled");

    setTimeout(async () => {
      try {
        await selectionService.performWeeklySelection();
      } catch (error) {
        logger.error("Test selection failed:", error);
      }
    }, config.arg.testingModeSelectionDelay);
  }

  logger.info("✅ Bot initialization complete and ready for ARG operations");
};
