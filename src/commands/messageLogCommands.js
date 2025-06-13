// ========================================
// FILE: src/commands/messageLogCommands.js
// PURPOSE: Admin commands for viewing message logs and bot activity
// ========================================

const messageLogger = require("../services/messageLogger");
const database = require("../config/database");
const logger = require("../utils/logger");
const { EmbedBuilder } = require("discord.js");

/**
 * Admin commands for message logging and monitoring
 */
class MessageLogCommands {
  /**
   * Shows recent bot messages
   * Usage: !recent-messages [limit] [type]
   */
  async handleRecentMessages(message, args) {
    try {
      const limit = parseInt(args[1]) || 10;

      const result = await database.executeQuery(
        `SELECT username, message_type, LEFT(content, 100) as preview, sent_at 
         FROM bot_message_logs 
         ORDER BY sent_at DESC 
         LIMIT $1`,
        [limit]
      );

      if (result.rows.length === 0) {
        await message.reply("📭 No recent messages found.");
        return;
      }

      let response = `**📨 Recent Bot Messages (${result.rows.length}):**\n\n`;

      for (const msg of result.rows) {
        const timestamp = new Date(msg.sent_at).toLocaleString();
        response += `**${msg.message_type}** → ${msg.username}\n`;
        response += `*${timestamp}*\n`;
        response += `\`${msg.preview}${
          msg.preview.length >= 100 ? "..." : ""
        }\`\n\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in recent-messages command:", error);
      await message.reply("❌ Failed to retrieve recent messages.");
    }
  }

  /**
   * Shows messages for a specific user
   * Usage: !user-messages @user [limit]
   */
  async handleUserMessages(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to view their message history."
        );
        return;
      }

      const limit = parseInt(args[2]) || 5;

      const result = await database.executeQuery(
        `SELECT message_type, content, sent_at 
         FROM bot_message_logs 
         WHERE user_id = $1 
         ORDER BY sent_at DESC 
         LIMIT $2`,
        [mentionedUser.id, limit]
      );

      if (result.rows.length === 0) {
        await message.reply(
          `📭 No messages found for ${mentionedUser.username}.`
        );
        return;
      }

      let response = `**📨 Messages for ${mentionedUser.username}:**\n\n`;

      for (const msg of result.rows) {
        const timestamp = new Date(msg.sent_at).toLocaleString();
        response += `**${msg.message_type}** | *${timestamp}*\n`;
        response += `\`\`\`${msg.content.substring(0, 300)}${
          msg.content.length > 300 ? "..." : ""
        }\`\`\`\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in user-messages command:", error);
      await message.reply("❌ Failed to retrieve user messages.");
    }
  }

  /**
   * Shows the last message sent to a specific user with full content
   * Usage: !last-message @user
   */
  async handleLastMessage(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to view their last message."
        );
        return;
      }

      const result = await database.executeQuery(
        `SELECT message_type, content, sent_at, channel_type 
         FROM bot_message_logs 
         WHERE user_id = $1 
         ORDER BY sent_at DESC 
         LIMIT 1`,
        [mentionedUser.id]
      );

      if (result.rows.length === 0) {
        await message.reply(
          `📭 No messages found for ${mentionedUser.username}.`
        );
        return;
      }

      const lastMessage = result.rows[0];
      const timestamp = new Date(lastMessage.sent_at).toLocaleString();

      await message.reply(`**Last message to ${mentionedUser.username}:**
**Type:** ${lastMessage.message_type}
**Time:** ${timestamp}
**Channel:** ${lastMessage.channel_type}
**Content:**
\`\`\`${lastMessage.content}\`\`\``);
    } catch (error) {
      logger.error("Error in last-message command:", error);
      await message.reply("❌ Failed to retrieve last message.");
    }
  }

  /**
   * Shows bot activity summary
   * Usage: !bot-activity [hours]
   */
  async handleBotActivity(message, args) {
    try {
      const hours = parseInt(args[1]) || 24;

      const result = await database.executeQuery(
        `SELECT 
           message_type,
           COUNT(*) as count,
           COUNT(DISTINCT user_id) as unique_users,
           MAX(sent_at) as last_sent
         FROM bot_message_logs 
         WHERE sent_at >= NOW() - INTERVAL '${hours} hours'
         GROUP BY message_type
         ORDER BY count DESC`
      );

      if (result.rows.length === 0) {
        await message.reply(`📊 No bot activity in the last ${hours} hours.`);
        return;
      }

      let response = `📊 **Bot Activity Summary (Last ${hours}h):**\n\n`;

      for (const stat of result.rows) {
        const lastSent = new Date(stat.last_sent).toLocaleString();
        response += `**${stat.message_type.toUpperCase()}:**\n`;
        response += `📨 Messages: ${stat.count}\n`;
        response += `👥 Users: ${stat.unique_users}\n`;
        response += `⏰ Last: ${lastSent}\n\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in bot-activity command:", error);
      await message.reply("❌ Failed to generate activity summary.");
    }
  }
}

// Export singleton instance
module.exports = new MessageLogCommands();
