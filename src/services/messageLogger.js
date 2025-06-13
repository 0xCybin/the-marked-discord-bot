// ========================================
// FILE: src/services/messageLogger.js
// PURPOSE: Enhanced logging system for tracking all bot messages
// ========================================

const database = require("../config/database");
const logger = require("../utils/logger");
const ValidationUtils = require("../utils/validation");

/**
 * Enhanced message logging service
 * Tracks all bot messages, user interactions, and ARG events
 */
class MessageLogger {
  /**
   * Initializes the message logging system
   * @returns {Promise<void>}
   */
  async initialize() {
    logger.info("📨 Message logging system initialized");
  }

  /**
   * Logs a message sent by the bot to a user
   * @param {string} userId - Discord user ID
   * @param {string} username - Username for display
   * @param {string} messageType - Type of message (817-recruitment, encoded-response, etc.)
   * @param {string|Object} content - Message content
   * @param {string} channelType - 'dm' or 'guild'
   * @param {string} guildId - Guild ID (if applicable)
   * @returns {Promise<void>}
   */
  async logBotMessage(
    userId,
    username,
    messageType,
    content,
    channelType = "dm",
    guildId = null
  ) {
    try {
      // Validate inputs
      if (!ValidationUtils.isValidUserId(userId)) {
        throw new Error("Invalid user ID");
      }

      // Convert content to string if it's an object
      const contentString =
        typeof content === "object"
          ? JSON.stringify(content, null, 2)
          : content;

      // Log to database
      await database.executeQuery(
        `INSERT INTO bot_message_logs 
         (user_id, username, message_type, content, channel_type, guild_id, sent_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          username,
          messageType,
          contentString,
          channelType,
          guildId,
          new Date(),
        ]
      );

      // Log to console with formatting
      logger.argEvent(
        "message-sent",
        `${messageType.toUpperCase()} → ${username} (${channelType.toUpperCase()})`
      );

      // Log content preview (first 100 chars)
      const preview =
        contentString.length > 100
          ? contentString.substring(0, 100) + "..."
          : contentString;
      logger.debug(`Content preview: "${preview}"`);

      // Console log for immediate visibility
      console.log(`\n📨 MESSAGE LOGGED:`);
      console.log(`   To: ${username} (${userId})`);
      console.log(`   Type: ${messageType}`);
      console.log(`   Channel: ${channelType}`);
      console.log(`   Time: ${new Date().toLocaleString()}`);
      console.log(`   Preview: ${preview}\n`);
    } catch (error) {
      logger.error("Failed to log bot message:", error);
      console.error("❌ Message logging failed:", error.message);
      // Don't throw - logging failure shouldn't stop the bot
    }
  }

  /**
   * Logs a user interaction (button clicks, reactions, etc.)
   * @param {string} userId - Discord user ID
   * @param {string} username - Username for display
   * @param {string} interactionType - Type of interaction
   * @param {Object} interactionData - Interaction details
   * @returns {Promise<void>}
   */
  async logUserInteraction(userId, username, interactionType, interactionData) {
    try {
      if (!ValidationUtils.isValidUserId(userId)) {
        throw new Error("Invalid user ID");
      }

      await database.executeQuery(
        `INSERT INTO user_interaction_logs 
         (user_id, username, interaction_type, interaction_data, occurred_at) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          username,
          interactionType,
          JSON.stringify(interactionData),
          new Date(),
        ]
      );

      logger.argEvent(
        "interaction",
        `${interactionType.toUpperCase()} by ${username}`
      );

      console.log(`\n🔘 INTERACTION LOGGED:`);
      console.log(`   User: ${username} (${userId})`);
      console.log(`   Type: ${interactionType}`);
      console.log(`   Time: ${new Date().toLocaleString()}\n`);
    } catch (error) {
      logger.error("Failed to log user interaction:", error);
    }
  }

  /**
   * Gets recent bot messages for a specific user
   * @param {string} userId - Discord user ID
   * @param {number} limit - Number of messages to retrieve
   * @returns {Promise<Array>} Recent messages
   */
  async getUserMessages(userId, limit = 10) {
    try {
      if (!ValidationUtils.isValidUserId(userId)) {
        throw new Error("Invalid user ID");
      }

      const result = await database.executeQuery(
        `SELECT * FROM bot_message_logs 
         WHERE user_id = $1 
         ORDER BY sent_at DESC 
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error("Failed to get user messages:", error);
      return [];
    }
  }

  /**
   * Gets all recent bot messages across all users
   * @param {number} limit - Number of messages to retrieve
   * @param {string} messageType - Filter by message type (optional)
   * @returns {Promise<Array>} Recent messages
   */
  async getRecentBotMessages(limit = 20, messageType = null) {
    try {
      let query = `SELECT * FROM bot_message_logs`;
      let params = [];

      if (messageType) {
        query += ` WHERE message_type = $1`;
        params.push(messageType);
      }

      query += ` ORDER BY sent_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await database.executeQuery(query, params);
      return result.rows;
    } catch (error) {
      logger.error("Failed to get recent bot messages:", error);
      return [];
    }
  }
}

// Export singleton instance
module.exports = new MessageLogger();
