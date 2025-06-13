// ========================================
// FILE: src/services/timeBasedMessages.js
// PURPOSE: Handles time-based ARG events with enhanced logging
// ========================================

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config/environment");
const logger = require("../utils/logger");
const messageLogger = require("./messageLogger");

/**
 * Time-based message service for ARG events
 * Handles special time-triggered events like the 8:17 recruitment system
 */
class TimeBasedMessageService {
  /**
   * Handles the 8:17 recruitment system messages
   * @param {Object} message - Discord message object
   * @returns {Promise<void>}
   */
  async handle817Messages(message) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Check if it's 8:17 AM or 8:17 PM
    if ((hours === 8 || hours === 20) && minutes === 17) {
      logger.argEvent(
        "817-system",
        `8:17 event triggered by ${message.author.username}`
      );
      await this.send817RecruitmentMessage(message);
    }
  }

  /**
   * Sends the 8:17 recruitment message with join button
   * @param {Object} message - Discord message object
   * @returns {Promise<void>}
   */
  async send817RecruitmentMessage(message) {
    try {
      const joinButton = new ButtonBuilder()
        .setCustomId("join_the_marked")
        .setLabel("🔮 Join The Marked")
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(joinButton);

      // ARG cipher/clue - YouTube link or other cryptic content
      const cipherMessage = "https://www.youtube.com/watch?v=P1qW_epFRnc";

      const recruitmentMessage = {
        content: `**The time has come...**\n\n\`\`\`${cipherMessage}\`\`\`\n\n*This will be your last chance to turn away.*`,
        components: [row],
      };

      // Send the DM
      await message.author.send(recruitmentMessage);

      // LOG THE MESSAGE WITH FULL DETAILS
      await messageLogger.logBotMessage(
        message.author.id,
        message.author.username,
        "817-recruitment",
        recruitmentMessage,
        "dm",
        message.guild?.id
      );

      logger.argEvent(
        "817-sent",
        `Sent 8:17 recruitment message to ${message.author.username}`
      );
    } catch (error) {
      logger.warn(
        `Failed to send 8:17 DM to ${message.author.username}: ${error.message}`
      );

      // Log the failed attempt
      await messageLogger.logBotMessage(
        message.author.id,
        message.author.username,
        "817-recruitment-failed",
        `Failed to send: ${error.message}`,
        "dm",
        message.guild?.id
      );

      // Fallback: Send a public message indicating DMs are closed
      try {
        const fallbackMessage =
          "*Something was meant for your eyes only, but your DMs are closed! Please enable DMs from server members.*";

        await message.reply({
          content: fallbackMessage,
        });

        // Log the fallback message
        await messageLogger.logBotMessage(
          message.author.id,
          message.author.username,
          "817-fallback",
          fallbackMessage,
          "guild",
          message.guild?.id
        );
      } catch (replyError) {
        logger.debug("Could not send fallback message either");
      }
    }
  }

  /**
   * Handles join button interaction for "The Marked" role
   * @param {Object} interaction - Discord button interaction
   * @returns {Promise<void>}
   */
  async handleJoinMarkedButton(interaction) {
    logger.argEvent(
      "join-button",
      `${interaction.user.username} clicked join button`
    );

    // Log the button interaction
    await messageLogger.logUserInteraction(
      interaction.user.id,
      interaction.user.username,
      "join-marked-button",
      {
        customId: interaction.customId,
        timestamp: new Date(),
        guild: interaction.guild?.name || "Unknown",
      }
    );

    try {
      // Find the guild (assuming bot is in one main guild for simplicity)
      const guild = interaction.client.guilds.cache.first();

      if (!guild) {
        const errorMessage =
          "❌ Cannot find the server. The ritual has failed...";
        await interaction.reply({
          content: errorMessage,
          ephemeral: true,
        });

        await messageLogger.logBotMessage(
          interaction.user.id,
          interaction.user.username,
          "join-marked-error",
          errorMessage,
          "interaction"
        );
        return;
      }

      // Get the member object
      const member = await guild.members.fetch(interaction.user.id);

      // Find the special role
      const specialRole = guild.roles.cache.find(
        (role) => role.name === config.arg.specialRoleName
      );

      if (!specialRole) {
        const errorMessage = `❌ Role "${config.arg.specialRoleName}" not found! The ritual cannot be completed...`;
        await interaction.reply({
          content: errorMessage,
          ephemeral: true,
        });

        await messageLogger.logBotMessage(
          interaction.user.id,
          interaction.user.username,
          "join-marked-role-not-found",
          errorMessage,
          "interaction"
        );
        return;
      }

      // Check if user already has the role
      if (member.roles.cache.has(specialRole.id)) {
        const alreadyMarkedMessage = `✅ You are already one of **${config.arg.specialRoleName}**. The symbol burns within you...`;
        await interaction.reply({
          content: alreadyMarkedMessage,
          ephemeral: true,
        });

        await messageLogger.logBotMessage(
          interaction.user.id,
          interaction.user.username,
          "join-marked-already-has-role",
          alreadyMarkedMessage,
          "interaction"
        );
        return;
      }

      // Add the role
      await member.roles.add(specialRole, "Joined through 8:17 recruitment");

      const successMessage = `🔮 **You have been Marked...**\n\n*The veil has been lifted. You now see what others cannot. Welcome to the inner circle.*\n\nNew paths have opened to you...`;

      await interaction.reply({
        content: successMessage,
        ephemeral: true,
      });

      // Log the successful role assignment
      await messageLogger.logBotMessage(
        interaction.user.id,
        interaction.user.username,
        "join-marked-success",
        successMessage,
        "interaction"
      );

      logger.argEvent(
        "role-assigned",
        `${member.user.username} joined The Marked via 8:17 button`
      );
    } catch (error) {
      logger.error("Error handling join button click:", error);

      const errorMessage =
        "❌ The ritual has failed... Please contact the administrators.";
      await interaction.reply({
        content: errorMessage,
        ephemeral: true,
      });

      await messageLogger.logBotMessage(
        interaction.user.id,
        interaction.user.username,
        "join-marked-error",
        `Error: ${error.message}`,
        "interaction"
      );
    }
  }

  /**
   * Checks if it's currently within ARG active hours
   * @returns {boolean} Whether it's ARG active time
   */
  isARGActiveTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // 8:17 times
    if ((hours === 8 || hours === 20) && minutes === 17) {
      return true;
    }

    // Night hours for general ARG activity
    if (
      hours >= config.arg.nightHoursStart ||
      hours < config.arg.nightHoursEnd
    ) {
      return true;
    }

    return false;
  }

  /**
   * Schedules next 8:17 event reminder
   * @returns {Date} Next 8:17 occurrence
   */
  getNext817Time() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    let nextEvent = new Date(now);
    nextEvent.setMinutes(17);
    nextEvent.setSeconds(0);
    nextEvent.setMilliseconds(0);

    // If we've passed 8:17 AM today
    if (currentHour > 8 || (currentHour === 8 && currentMinute > 17)) {
      // Set to 8:17 PM today
      nextEvent.setHours(20);
    } else if (currentHour > 20 || (currentHour === 20 && currentMinute > 17)) {
      // Set to 8:17 AM tomorrow
      nextEvent.setDate(nextEvent.getDate() + 1);
      nextEvent.setHours(8);
    } else {
      // Set to 8:17 AM today
      nextEvent.setHours(8);
    }

    return nextEvent;
  }
}

// Export singleton instance
module.exports = new TimeBasedMessageService();
