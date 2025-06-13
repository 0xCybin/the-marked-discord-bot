// ========================================
// FILE: src/events/guildMemberUpdate.js - NEW FILE!
// PURPOSE: Monitor and prevent unauthorized nickname changes - CORE PROTECTION
// ========================================

const logger = require("../utils/logger");

/**
 * Guild member update event handler - THE NICKNAME PROTECTION CORE
 * Monitors nickname changes and reverts unauthorized modifications
 * @param {Object} oldMember - Previous member state
 * @param {Object} newMember - Updated member state
 */
module.exports = async (oldMember, newMember) => {
  try {
    // 🔍 ENHANCED DEBUGGING - Log ALL member updates
    console.log(`\n🔍 MEMBER UPDATE DETECTED:`);
    console.log(`   User: ${newMember.user.username} (${newMember.user.id})`);
    console.log(`   Old Nickname: "${oldMember.nickname || "None"}"`);
    console.log(`   New Nickname: "${newMember.nickname || "None"}"`);
    console.log(
      `   Change Detected: ${
        oldMember.nickname !== newMember.nickname ? "✅ YES" : "❌ NO"
      }`
    );

    // Only process nickname changes
    if (oldMember.nickname === newMember.nickname) {
      console.log(`   🚫 No nickname change - skipping`);
      return; // No nickname change occurred
    }

    console.log(`   🚨 NICKNAME CHANGE DETECTED!`);
    console.log(
      `   📝 Change: "${oldMember.nickname}" → "${newMember.nickname}"`
    );

    // Check if this user has a protected nickname
    const protectedData = getProtectedNickname(
      newMember.id,
      newMember.guild.id
    );

    console.log(
      `   🛡️ Protection Status: ${
        protectedData ? "✅ PROTECTED" : "❌ NOT PROTECTED"
      }`
    );

    if (!protectedData) {
      console.log(`   ℹ️ User not in protection system - allowing change`);
      return; // User doesn't have a protected nickname
    }

    console.log(
      `   🔒 Protected nickname: "${protectedData.protectedNickname}"`
    );

    // Check if the change was authorized (made by bot or admin)
    const isAuthorized = await isAuthorizedChange(oldMember, newMember);
    console.log(
      `   🔐 Authorization Check: ${
        isAuthorized ? "✅ AUTHORIZED" : "❌ UNAUTHORIZED"
      }`
    );

    if (isAuthorized) {
      logger.debug(
        `Authorized nickname change for ${newMember.user.username}: "${oldMember.nickname}" → "${newMember.nickname}"`
      );
      console.log(`   ✅ Change authorized - allowing`);
      return;
    }

    // 🚨 UNAUTHORIZED CHANGE DETECTED - REVERT IT!
    console.log(`   🚨 UNAUTHORIZED CHANGE! REVERTING...`);

    logger.argEvent(
      "nickname-protection-triggered",
      `🛡️ Unauthorized nickname change detected for ${newMember.user.username}: "${oldMember.nickname}" → "${newMember.nickname}"`
    );

    await revertNicknameChange(newMember, protectedData.protectedNickname);
  } catch (error) {
    console.error(`   ❌ ERROR in nickname protection:`, error);
    logger.error("Error in guildMemberUpdate nickname protection:", error);
  }

  console.log(`   📋 Nickname protection check completed\n`);
};

/**
 * Gets protected nickname data for a user
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Object|null} Protected nickname data or null
 */
function getProtectedNickname(userId, guildId) {
  try {
    // Check in-memory protection list
    global.protectedNicknames = global.protectedNicknames || new Map();
    const protectedData = global.protectedNicknames.get(userId);

    if (protectedData && protectedData.guildId === guildId) {
      return protectedData;
    }

    return null;
  } catch (error) {
    logger.error("Error getting protected nickname:", error);
    return null;
  }
}

/**
 * Checks if a nickname change was authorized
 * @param {Object} oldMember - Previous member state
 * @param {Object} newMember - Updated member state
 * @returns {Promise<boolean>} Whether the change was authorized
 */
async function isAuthorizedChange(oldMember, newMember) {
  try {
    console.log(`     🔎 Checking authorization...`);

    // Get recent audit logs to see who made the change
    const auditLogs = await newMember.guild.fetchAuditLogs({
      type: 24, // MEMBER_UPDATE
      limit: 5,
    });

    console.log(
      `     📋 Found ${auditLogs.entries.size} recent audit log entries`
    );

    // Look for recent nickname changes for this user
    const recentLog = auditLogs.entries.find((entry) => {
      const isTargetMatch = entry.target && entry.target.id === newMember.id;
      const hasNickChange =
        entry.changes && entry.changes.find((change) => change.key === "nick");
      const isRecent = Date.now() - entry.createdTimestamp < 10000; // Within last 10 seconds

      console.log(
        `     📝 Audit entry: Target=${isTargetMatch}, HasNick=${!!hasNickChange}, Recent=${isRecent}`
      );

      return isTargetMatch && hasNickChange && isRecent;
    });

    if (recentLog) {
      const executor = recentLog.executor;
      console.log(
        `     👤 Change made by: ${executor.username} (${executor.id})`
      );

      // Allow changes made by:
      // 1. The bot itself
      if (executor.bot && executor.id === newMember.client.user.id) {
        console.log(`     🤖 Bot made the change - AUTHORIZED`);
        return true;
      }

      // 2. Server owner
      if (executor.id === newMember.guild.ownerId) {
        console.log(`     👑 Server owner made the change - AUTHORIZED`);
        return true;
      }

      // 3. Users with admin/manage nicknames permission
      const executorMember = await newMember.guild.members
        .fetch(executor.id)
        .catch(() => null);
      if (
        executorMember &&
        (executorMember.permissions.has("Administrator") ||
          executorMember.permissions.has("ManageNicknames"))
      ) {
        console.log(`     🛡️ Admin/moderator made the change - AUTHORIZED`);
        return true;
      }

      console.log(`     ❌ Regular user made the change - UNAUTHORIZED`);
    } else {
      console.log(`     ⚠️ No recent audit log found - assuming UNAUTHORIZED`);
    }

    return false; // Unauthorized change
  } catch (error) {
    console.log(`     ❌ Error checking authorization:`, error.message);
    logger.debug(
      "Could not check audit logs for authorization:",
      error.message
    );
    // If we can't check audit logs, assume it's unauthorized for safety
    return false;
  }
}

/**
 * Reverts an unauthorized nickname change
 * @param {Object} member - Discord member object
 * @param {string} protectedNickname - The original protected nickname
 */
async function revertNicknameChange(member, protectedNickname) {
  try {
    console.log(
      `     🔄 Reverting to protected nickname: "${protectedNickname}"`
    );

    // Revert to the protected nickname
    await member.setNickname(
      protectedNickname,
      "ARG Protocol: Unauthorized nickname change reverted"
    );

    console.log(`     ✅ Nickname successfully reverted!`);

    logger.argEvent(
      "nickname-reverted",
      `✅ Nickname reverted for ${member.user.username} back to "${protectedNickname}"`
    );

    // Send warning message to the user
    await sendNicknameWarning(member, protectedNickname);

    // Log the incident for admins
    await logNicknameViolation(member, protectedNickname);
  } catch (error) {
    console.log(`     ❌ FAILED to revert nickname:`, error.message);
    logger.error(
      `Failed to revert nickname for ${member.user.username}:`,
      error
    );

    // If revert fails, notify admins immediately
    await notifyAdminsOfRevertFailure(member, protectedNickname, error);
  }
}

/**
 * Sends a warning DM to user about nickname protection
 * @param {Object} member - Discord member object
 * @param {string} protectedNickname - The protected nickname
 */
async function sendNicknameWarning(member, protectedNickname) {
  try {
    const warningMessages = [
      `**${protectedNickname}** - Your designation cannot be altered. The system has restored your identity.`,
      `Nickname modification detected. **${protectedNickname}** has been restored to maintain protocol integrity.`,
      `**${protectedNickname}** - Identity tampering is not permitted. Your designation is locked.`,
      `System alert: **${protectedNickname}** designation restored. Unauthorized changes are monitored.`,
      `**${protectedNickname}** - The network has corrected your identity. Do not attempt further modifications.`,
      `⚠️ **SYSTEM ALERT** ⚠️\n\nDesignation **${protectedNickname}** is protected by the ARG Protocol.\n\nUnauthorized identity modification detected and corrected.\n\n*Further attempts will be logged.*`,
    ];

    const selectedMessage =
      warningMessages[Math.floor(Math.random() * warningMessages.length)];

    await member.send(selectedMessage);

    console.log(`     📨 Sent warning DM to ${member.user.username}`);
    logger.debug(`Sent nickname warning to ${member.user.username}`);
  } catch (error) {
    console.log(`     ❌ Could not send DM warning:`, error.message);
    logger.debug(
      `Could not send nickname warning to ${member.user.username}:`,
      error.message
    );
  }
}

/**
 * Logs nickname violation for admin review
 * @param {Object} member - Discord member object
 * @param {string} protectedNickname - The protected nickname
 */
async function logNicknameViolation(member, protectedNickname) {
  try {
    const guild = member.guild;

    // Find admin/log channel
    const logChannel = guild.channels.cache.find(
      (channel) =>
        (channel.name.includes("admin") ||
          channel.name.includes("log") ||
          channel.name.includes("bot") ||
          channel.name.includes("mod")) &&
        channel.isTextBased()
    );

    if (logChannel) {
      const embed = {
        color: 0xffa500, // Orange for warning
        title: "🛡️ Nickname Protection Triggered",
        description: `**${member.user.username}** attempted to change their protected nickname`,
        fields: [
          {
            name: "User Info",
            value: `${member.user.username} (${member.user.id})`,
            inline: true,
          },
          {
            name: "Protected Nickname",
            value: `\`${protectedNickname}\``,
            inline: true,
          },
          {
            name: "Action Taken",
            value: "✅ Nickname reverted automatically",
            inline: true,
          },
          {
            name: "Status",
            value: "🛡️ Protection system working normally",
            inline: false,
          },
        ],
        footer: {
          text: "ARG Protocol: Identity Protection System",
        },
        timestamp: new Date().toISOString(),
      };

      await logChannel.send({ embeds: [embed] });
      console.log(`     📋 Logged violation to admin channel`);
    }
  } catch (error) {
    console.log(`     ❌ Could not log to admin channel:`, error.message);
    logger.debug("Could not log nickname violation:", error.message);
  }
}

/**
 * Notifies admins when nickname revert fails
 * @param {Object} member - Discord member object
 * @param {string} protectedNickname - The protected nickname
 * @param {Error} error - The error that occurred
 */
async function notifyAdminsOfRevertFailure(member, protectedNickname, error) {
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
        color: 0xff0000, // Red for error
        title: "❌ URGENT: Nickname Protection Failure",
        description: `**${member.user.username}** changed their nickname but automatic revert FAILED`,
        fields: [
          {
            name: "User Info",
            value: `${member.user.username} (${member.user.id})`,
            inline: true,
          },
          {
            name: "Should Be",
            value: `\`${protectedNickname}\``,
            inline: true,
          },
          {
            name: "Error",
            value: error.message || "Unknown error",
            inline: false,
          },
          {
            name: "⚠️ REQUIRED ACTION ⚠️",
            value: `**MANUAL INTERVENTION NEEDED**\n\`!assign-nickname @${member.user.username}\`\nOr manually set nickname to: \`${protectedNickname}\`\n\n**Check bot permissions and role hierarchy!**`,
            inline: false,
          },
        ],
        footer: {
          text: "URGENT: Bot cannot enforce nickname protection for this user",
        },
        timestamp: new Date().toISOString(),
      };

      await logChannel.send({ embeds: [embed] });
    }
  } catch (notifyError) {
    logger.error("Could not notify admins of revert failure:", notifyError);
  }
}
