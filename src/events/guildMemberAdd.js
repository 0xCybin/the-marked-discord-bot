// ========================================
// FILE: src/events/guildMemberAdd.js
// PURPOSE: New member join event handler with nickname protection - ENHANCED VERSION
// ========================================

const onboardingSystem = require("../services/onboardingSystem");
const nicknameService = require("../services/nicknames");
const logger = require("../utils/logger");

/**
 * Guild member add event handler - Enhanced with nickname protection
 * Starts onboarding process and assigns protected nickname when new members join
 * @param {Object} member - Discord member object
 */
module.exports = async (member) => {
  logger.info(`👋 ${member.user.username} joined ${member.guild.name}`);

  // Wait for Discord to fully process the member
  setTimeout(async () => {
    try {
      // 🔥 STEP 1: Start onboarding process FIRST
      logger.argEvent(
        "member-join",
        `Starting onboarding process for ${member.user.username}`
      );

      // Initialize the onboarding system for this new member
      const onboardingSuccess = await onboardingSystem.initiateOnboarding(
        member
      );

      if (onboardingSuccess) {
        logger.argEvent(
          "onboarding-started",
          `✅ Onboarding initiated successfully for ${member.user.username} - they should receive a DM`
        );
      } else {
        // Onboarding failed (likely DM issue) - notify admins
        logger.argEvent(
          "onboarding-failed",
          `❌ Failed to start onboarding for ${member.user.username} - likely DM disabled`
        );

        // Try to notify admins about the failed onboarding
        await notifyAdminsOfFailedOnboarding(member);
      }

      // 🔥 STEP 2: Assign protected nickname after onboarding starts
      logger.argEvent(
        "nickname-assignment-start",
        `Assigning protected nickname to ${member.user.username}`
      );

      const assignedNickname = await nicknameService.assignNicknameToNewMember(
        member
      );

      if (assignedNickname) {
        logger.argEvent(
          "nickname-assigned",
          `✅ Protected nickname "${assignedNickname}" assigned to ${member.user.username}`
        );

        // Add user to nickname protection list
        await addToNicknameProtection(member, assignedNickname);
      } else {
        logger.argEvent(
          "nickname-assignment-failed",
          `❌ Failed to assign protected nickname to ${member.user.username}`
        );

        // Notify admins about nickname assignment failure
        await notifyAdminsOfNicknameFailure(member);
      }
    } catch (error) {
      logger.error(
        `❌ Error processing new member ${member.user.username}:`,
        error
      );

      // Log the error for admin review
      logger.argEvent(
        "member-processing-error",
        `Member processing error for ${member.user.username}: ${error.message}`
      );

      // Try to notify admins about the error
      await notifyAdminsOfProcessingError(member, error);
    }
  }, 2000); // 2 second delay to ensure Discord has processed the member
};

/**
 * Adds a user to the nickname protection system
 * @param {Object} member - Discord member object
 * @param {string} assignedNickname - The nickname assigned to protect
 */
async function addToNicknameProtection(member, assignedNickname) {
  try {
    // Store the protected nickname in memory
    // This will be used by the guildMemberUpdate event to monitor changes
    global.protectedNicknames = global.protectedNicknames || new Map();
    global.protectedNicknames.set(member.id, {
      guildId: member.guild.id,
      protectedNickname: assignedNickname,
      assignedAt: new Date(),
      userId: member.id,
      username: member.user.username,
    });

    logger.debug(
      `🛡️ Added ${member.user.username} to nickname protection with "${assignedNickname}"`
    );

    // Log protection status for debugging
    console.log(
      `🔒 PROTECTION ACTIVE: ${member.user.username} → "${assignedNickname}"`
    );
  } catch (error) {
    logger.error("Failed to add user to nickname protection:", error);
  }
}

/**
 * Notifies admins when onboarding fails due to DM issues
 * @param {Object} member - Discord member object
 */
async function notifyAdminsOfFailedOnboarding(member) {
  try {
    const guild = member.guild;

    // Try to find an admin/log channel
    const logChannel = guild.channels.cache.find(
      (channel) =>
        (channel.name.includes("admin") ||
          channel.name.includes("log") ||
          channel.name.includes("bot")) &&
        channel.isTextBased()
    );

    if (logChannel) {
      const embed = {
        color: 0xff9900, // Orange for warning
        title: "⚠️ Onboarding DM Failed",
        description: `**${member.user.username}** joined but couldn't receive onboarding DM`,
        fields: [
          {
            name: "User Info",
            value: `${member.user.username} (${member.user.id})`,
            inline: true,
          },
          {
            name: "Likely Cause",
            value: "DMs disabled by user",
            inline: true,
          },
          {
            name: "Fix Command",
            value: `\`!force-onboarding @${member.user.username}\``,
            inline: false,
          },
        ],
        footer: {
          text: "User needs to enable DMs from server members first",
        },
        timestamp: new Date().toISOString(),
      };

      await logChannel.send({ embeds: [embed] });

      logger.debug(
        `Notified admins about failed onboarding for ${member.user.username}`
      );
    }
  } catch (notifyError) {
    logger.debug(
      "Could not notify admins about failed onboarding:",
      notifyError.message
    );
  }
}

/**
 * Notifies admins when nickname assignment fails
 * @param {Object} member - Discord member object
 */
async function notifyAdminsOfNicknameFailure(member) {
  try {
    const guild = member.guild;

    const logChannel = guild.channels.cache.find(
      (channel) =>
        (channel.name.includes("admin") ||
          channel.name.includes("log") ||
          channel.name.includes("bot")) &&
        channel.isTextBased()
    );

    if (logChannel) {
      const embed = {
        color: 0xff9900, // Orange for warning
        title: "⚠️ Nickname Assignment Failed",
        description: `**${member.user.username}** joined but couldn't be assigned a protected nickname`,
        fields: [
          {
            name: "User Info",
            value: `${member.user.username} (${member.user.id})`,
            inline: true,
          },
          {
            name: "Possible Causes",
            value:
              "• Bot lacks 'Manage Nicknames' permission\n• User has higher role than bot\n• User is server owner",
            inline: false,
          },
          {
            name: "Fix Commands",
            value: `\`!assign-nickname @${member.user.username}\`\n\`!check-permissions @${member.user.username}\``,
            inline: false,
          },
        ],
        footer: {
          text: "Check bot permissions and role hierarchy",
        },
        timestamp: new Date().toISOString(),
      };

      await logChannel.send({ embeds: [embed] });

      logger.debug(
        `Notified admins about nickname assignment failure for ${member.user.username}`
      );
    }
  } catch (notifyError) {
    logger.debug(
      "Could not notify admins about nickname failure:",
      notifyError.message
    );
  }
}

/**
 * Notifies admins when member processing encounters a system error
 * @param {Object} member - Discord member object
 * @param {Error} error - The error that occurred
 */
async function notifyAdminsOfProcessingError(member, error) {
  try {
    const guild = member.guild;

    // Try to find an admin/log channel
    const logChannel = guild.channels.cache.find(
      (channel) =>
        (channel.name.includes("admin") ||
          channel.name.includes("log") ||
          channel.name.includes("bot")) &&
        channel.isTextBased()
    );

    if (logChannel) {
      const embed = {
        color: 0xff0000, // Red for error
        title: "❌ Member Processing Error",
        description: `**${member.user.username}** joined but processing encountered an error`,
        fields: [
          {
            name: "User Info",
            value: `${member.user.username} (${member.user.id})`,
            inline: true,
          },
          {
            name: "Error Type",
            value: error.name || "Unknown Error",
            inline: true,
          },
          {
            name: "Error Message",
            value: error.message || "No message available",
            inline: false,
          },
          {
            name: "Recommended Action",
            value: `1. Check bot permissions\n2. Try: \`!force-onboarding @${member.user.username}\`\n3. Try: \`!assign-nickname @${member.user.username}\`\n4. Check database connectivity`,
            inline: false,
          },
        ],
        footer: {
          text: "This may require developer attention",
        },
        timestamp: new Date().toISOString(),
      };

      await logChannel.send({ embeds: [embed] });

      logger.debug(
        `Notified admins about processing error for ${member.user.username}`
      );
    }
  } catch (notifyError) {
    logger.debug(
      "Could not notify admins about processing error:",
      notifyError.message
    );
  }
}
