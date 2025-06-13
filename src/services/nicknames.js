// ========================================
// FILE: src/services/nicknames.js
// PURPOSE: ARG-themed automatic nickname assignment system
// ========================================

const config = require("../config/environment");
const database = require("../config/database");
const logger = require("../utils/logger");
const deepseekService = require("./deepseek");
const dataCollectionService = require("./dataCollection");
const ValidationUtils = require("../utils/validation");

/**
 * Nickname assignment service for ARG-themed user identification
 * Assigns cryptic nicknames to new members and manages nickname changes
 */
class NicknameService {
  constructor() {
    // ARG-themed nickname pools organized by category
    this.nicknameCategories = {
      cosmic: [
        "Void Walker",
        "Pattern Seeker",
        "Signal Bearer",
        "Echo Chamber",
        "Frequency Drift",
        "Null Entity",
        "Data Ghost",
        "Static Soul",
        "Binary Dreamer",
        "Code Whisper",
        "Digital Phantom",
        "System Anomaly",
        "Network Wraith",
        "Pixel Prophet",
        "Circuit Sage",
      ],
      temporal: [
        "Timeline Glitch",
        "Reality Breach",
        "Dimension Walker",
        "Time Fragment",
        "Loop Escapee",
        "Paradox Child",
        "Quantum Ghost",
        "Parallel Self",
        "Broken Clock",
        "Future Echo",
        "Past Shadow",
        "Present Void",
        "Temporal Drift",
        "Causality Error",
        "Chronos Tear",
      ],
      mysterious: [
        "Unknown Variable",
        "Marked One",
        "Silent Observer",
        "Shadow Figure",
        "Nameless Entity",
        "The Uninvited",
        "Hollow Voice",
        "Empty Vessel",
        "Faceless User",
        "Anonymous Soul",
        "Forgotten Name",
        "Lost Signal",
        "Broken Mirror",
        "Dark Reflection",
        "Hidden Truth",
      ],
      digital: [
        "User.exe",
        "Guest_404",
        "NPC_Protocol",
        "Sim_Entity",
        "Player_Unknown",
        "Avatar_Null",
        "ID_Corrupted",
        "Profile_Error",
        "Account_Void",
        "Login_Failed",
        "Session_Lost",
        "Cache_Cleared",
        "Memory_Leak",
        "Process_Killed",
        "System_Breach",
      ],
      encoded: [
        "Subject_817",
        "Unit_023",
        "Node_156",
        "Agent_404",
        "Entity_999",
        "Signal_101",
        "Trace_773",
        "Echo_212",
        "Ghost_666",
        "Void_000",
        "Error_500",
        "Debug_1337",
        "Null_0xFF",
        "Stack_0x00",
        "Heap_DEAD",
      ],
    };
  }

  // ========================================
  // ENHANCEMENT: Add to src/services/nicknames.js
  // PURPOSE: Auto-protection for manual nickname assignments
  // ========================================

  /**
   * 🔥 ENHANCED: Assigns nickname to new member with AUTO-PROTECTION
   * @param {Object} member - Discord member object
   * @returns {Promise<string|null>} Assigned nickname or null if failed
   */
  async assignNicknameToNewMember(member) {
    logger.argEvent(
      "nickname-assignment",
      `Processing new member: ${member.user.username}`
    );

    try {
      // Validate permissions and hierarchy (existing code)
      const permissionCheck = this.validateNicknamePermissions(member);
      if (!permissionCheck.canAssign) {
        logger.warn(
          `Cannot assign nickname to ${member.user.username}: ${permissionCheck.reason}`
        );
        return null;
      }

      // Generate and assign unique nickname (existing code)
      const assignedNickname = await this.assignUniqueNickname(member);

      if (assignedNickname) {
        // 🔥 NEW: Automatically add to protection system
        global.protectedNicknames = global.protectedNicknames || new Map();
        global.protectedNicknames.set(member.id, {
          guildId: member.guild.id,
          protectedNickname: assignedNickname,
          assignedAt: new Date(),
          userId: member.id,
          username: member.user.username,
          source: "auto-assignment-join",
        });

        console.log(
          `🛡️ AUTO-PROTECTION ADDED: ${member.user.username} → "${assignedNickname}" (join assignment)`
        );

        // Send cryptic welcome message (existing code)
        await this.sendCrypticWelcome(member, assignedNickname);

        logger.argEvent(
          "nickname-assigned-protected",
          `✅ Nickname "${assignedNickname}" assigned to ${member.user.username} with AUTO-PROTECTION`
        );

        return assignedNickname;
      }

      return null;
    } catch (error) {
      logger.error(
        `Error assigning nickname to ${member.user.username}:`,
        error
      );
      return null;
    }
  }

  /**
   * 🔥 ENHANCED: Manually reassigns nickname with AUTO-PROTECTION
   * @param {Object} member - Discord member object
   * @returns {Promise<string|null>} New nickname or null
   */
  async reassignNickname(member) {
    logger.argEvent(
      "nickname-reassign",
      `Manual reassignment for ${member.user.username}`
    );

    const permissionCheck = this.validateNicknamePermissions(member);
    if (!permissionCheck.canAssign) {
      logger.warn(`Cannot reassign nickname: ${permissionCheck.reason}`);
      return null;
    }

    const newNickname = await this.assignUniqueNickname(member);

    if (newNickname) {
      // 🔥 NEW: Automatically add/update protection system
      global.protectedNicknames = global.protectedNicknames || new Map();
      global.protectedNicknames.set(member.id, {
        guildId: member.guild.id,
        protectedNickname: newNickname,
        assignedAt: new Date(),
        userId: member.id,
        username: member.user.username,
        source: "manual-reassignment",
      });

      console.log(
        `🛡️ AUTO-PROTECTION UPDATED: ${member.user.username} → "${newNickname}" (manual reassignment)`
      );

      logger.argEvent(
        "nickname-reassigned-protected",
        `✅ Nickname "${newNickname}" reassigned to ${member.user.username} with AUTO-PROTECTION`
      );
    }

    return newNickname;
  }

  /**
   * Validates if the bot can assign nicknames to a member
   * @param {Object} member - Discord member object
   * @returns {Object} Validation result with canAssign boolean and reason
   */
  validateNicknamePermissions(member) {
    // Don't nickname bots
    if (member.user.bot) {
      return { canAssign: false, reason: "Target is a bot" };
    }

    // Don't nickname the server owner
    if (member.id === member.guild.ownerId) {
      return { canAssign: false, reason: "Target is server owner" };
    }

    const botMember = member.guild.members.me;

    // Check if bot has manage nicknames permission
    if (!botMember.permissions.has("ManageNicknames")) {
      return {
        canAssign: false,
        reason: "Bot lacks Manage Nicknames permission",
      };
    }

    // Check role hierarchy
    if (member.roles.highest.position >= botMember.roles.highest.position) {
      return {
        canAssign: false,
        reason: "Target has higher or equal role hierarchy",
      };
    }

    return { canAssign: true, reason: "All checks passed" };
  }

  /**
   * Assigns a unique nickname with multiple attempts for uniqueness
   * @param {Object} member - Discord member object
   * @param {number} maxAttempts - Maximum assignment attempts
   * @returns {Promise<string|null>} Assigned nickname or null
   */
  async assignUniqueNickname(member, maxAttempts = 5) {
    logger.debug(`Assigning unique nickname to ${member.user.username}...`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Use AI on first attempt, fallback on subsequent attempts
        const useAI = attempt === 1;
        const nickname = await this.generateNickname(member, useAI);

        // Check if nickname is already in use
        if (await this.isNicknameInUse(member.guild, nickname)) {
          logger.debug(
            `"${nickname}" already in use, attempt ${attempt}/${maxAttempts}`
          );
          continue;
        }

        // Sanitize nickname
        const sanitizedNickname = ValidationUtils.sanitizeNickname(nickname);
        if (!sanitizedNickname) {
          logger.debug(
            `Nickname sanitization failed, attempt ${attempt}/${maxAttempts}`
          );
          continue;
        }

        // Try to set the nickname
        await member.setNickname(
          sanitizedNickname,
          "ARG Protocol: Entity Classification"
        );

        logger.argEvent(
          "nickname-assigned",
          `"${sanitizedNickname}" assigned to ${member.user.username}`
        );

        // Log to database
        await this.logNicknameAssignment(member, sanitizedNickname);

        return sanitizedNickname;
      } catch (error) {
        logger.debug(
          `Nickname assignment attempt ${attempt} failed: ${error.message}`
        );

        if (error.code === 50013) {
          // Missing Permissions
          logger.warn(
            `Bot lacks permission to change ${member.user.username}'s nickname`
          );
          return null;
        }

        if (attempt === maxAttempts) {
          logger.warn(
            `Failed to assign nickname after ${maxAttempts} attempts`
          );
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Generates a nickname for a member (AI or fallback)
   * @param {Object} member - Discord member object
   * @param {boolean} useAI - Whether to use AI generation
   * @returns {Promise<string>} Generated nickname
   */
  async generateNickname(member, useAI = false) {
    if (useAI && config.deepseek.apiKey) {
      try {
        // Collect user data for AI context
        const userData = await dataCollectionService.collectEnhancedUserData(
          member,
          member.guild
        );
        return await deepseekService.generateNickname(userData);
      } catch (error) {
        logger.debug(`AI nickname generation failed: ${error.message}`);
      }
    }

    // Fallback: Random selection from pools
    return this.generateRandomNickname();
  }

  /**
   * Generates a random nickname from predefined pools
   * @returns {string} Random nickname with variation
   */
  generateRandomNickname() {
    const categories = Object.keys(this.nicknameCategories);
    const selectedCategory =
      categories[Math.floor(Math.random() * categories.length)];
    const nicknames = this.nicknameCategories[selectedCategory];
    const baseNickname =
      nicknames[Math.floor(Math.random() * nicknames.length)];

    // Add variation to prevent duplicates
    const variations = [
      baseNickname,
      `${baseNickname}.${Math.floor(Math.random() * 100)}`,
      `${baseNickname}_${String.fromCharCode(
        65 + Math.floor(Math.random() * 26)
      )}`,
      `${baseNickname}#${Math.floor(Math.random() * 10)}`,
      `${baseNickname}/${Math.floor(Math.random() * 999)}`,
    ];

    const finalNickname =
      variations[Math.floor(Math.random() * variations.length)];
    logger.debug(
      `Generated random nickname: "${finalNickname}" from ${selectedCategory} category`
    );

    return finalNickname;
  }

  /**
   * Checks if a nickname is already in use in the guild
   * @param {Object} guild - Discord guild object
   * @param {string} nickname - Nickname to check
   * @returns {Promise<boolean>} Whether nickname is in use
   */
  async isNicknameInUse(guild, nickname) {
    if (!nickname) return false;

    const normalizedNickname = nickname.toLowerCase().trim();

    return guild.members.cache.some(
      (member) => member.displayName.toLowerCase().trim() === normalizedNickname
    );
  }

  /**
   * Logs nickname assignment to database
   * @param {Object} member - Discord member object
   * @param {string} nickname - Assigned nickname
   * @returns {Promise<void>}
   */
  async logNicknameAssignment(member, nickname) {
    try {
      await database.executeQuery(
        `
        INSERT INTO nickname_assignments (user_id, guild_id, old_nickname, new_nickname, assigned_at, assignment_reason)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          member.id,
          member.guild.id,
          member.displayName,
          nickname,
          new Date(),
          "Auto-assignment on join",
        ]
      );

      logger.database(
        "insert",
        `Logged nickname assignment: ${member.user.username} -> "${nickname}"`
      );
    } catch (error) {
      logger.error("Failed to log nickname assignment:", error);
      // Don't throw as logging failure shouldn't stop the process
    }
  }

  /**
   * Sends cryptic welcome message for new member
   * @param {Object} member - Discord member object
   * @param {string} nickname - Assigned nickname
   * @returns {Promise<void>}
   */
  async sendCrypticWelcome(member, nickname) {
    const welcomeMessages = [
      `**${nickname}** has entered the system...`,
      `Entity classification complete. Welcome, **${nickname}**.`,
      `**${nickname}** - your designation has been assigned. The pattern recognizes you.`,
      `Signal detected. **${nickname}** is now active in the network.`,
      `**${nickname}** - you have been catalogued. Your journey begins.`,
      `New node **${nickname}** connected to the grid.`,
      `**${nickname}** - the cosmic registry has been updated.`,
    ];

    const selectedMessage =
      welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

    try {
      // Find appropriate welcome channel
      const welcomeChannel = member.guild.channels.cache.find(
        (channel) =>
          (channel.name.includes("welcome") ||
            channel.name.includes("general") ||
            channel.name.includes("lobby")) &&
          channel.permissionsFor(member.guild.members.me)?.has("SendMessages")
      );

      if (welcomeChannel) {
        await welcomeChannel.send(selectedMessage);
        logger.argEvent("welcome-sent", `Sent cryptic welcome for ${nickname}`);
      } else {
        logger.debug("No suitable welcome channel found");
      }
    } catch (error) {
      logger.debug(`Failed to send welcome message: ${error.message}`);
    }
  }

  /**
   * Manually reassigns nickname to a user
   * @param {Object} member - Discord member object
   * @returns {Promise<string|null>} New nickname or null
   */
  async reassignNickname(member) {
    logger.argEvent(
      "nickname-reassign",
      `Manual reassignment for ${member.user.username}`
    );

    const permissionCheck = this.validateNicknamePermissions(member);
    if (!permissionCheck.canAssign) {
      logger.warn(`Cannot reassign nickname: ${permissionCheck.reason}`);
      return null;
    }

    return await this.assignUniqueNickname(member);
  }

  /**
   * Gets nickname assignment statistics for a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Nickname statistics
   */
  async getNicknameStats(guildId) {
    try {
      if (!ValidationUtils.isValidGuildId(guildId)) {
        throw new Error("Invalid guild ID");
      }

      const result = await database.executeQuery(
        `
        SELECT 
          COUNT(*) as total_assignments,
          COUNT(DISTINCT user_id) as unique_users,
          MAX(assigned_at) as last_assignment,
          COUNT(DISTINCT new_nickname) as unique_nicknames
        FROM nickname_assignments 
        WHERE guild_id = $1
      `,
        [guildId]
      );

      const stats = result.rows[0];

      return {
        totalAssignments: parseInt(stats.total_assignments),
        uniqueUsers: parseInt(stats.unique_users),
        lastAssignment: stats.last_assignment
          ? new Date(stats.last_assignment)
          : null,
        uniqueNicknames: parseInt(stats.unique_nicknames),
      };
    } catch (error) {
      logger.error("Error getting nickname stats:", error);
      throw error;
    }
  }

  /**
   * Gets recent nickname assignments
   * @param {string} guildId - Discord guild ID
   * @param {number} limit - Number of assignments to retrieve
   * @returns {Promise<Array>} Recent assignments
   */
  async getRecentAssignments(guildId, limit = 10) {
    try {
      if (!ValidationUtils.isValidGuildId(guildId)) {
        throw new Error("Invalid guild ID");
      }

      const result = await database.executeQuery(
        `
        SELECT user_id, old_nickname, new_nickname, assigned_at, assignment_reason
        FROM nickname_assignments 
        WHERE guild_id = $1
        ORDER BY assigned_at DESC
        LIMIT $2
      `,
        [guildId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error("Error getting recent nickname assignments:", error);
      return [];
    }
  }
}

// Export singleton instance
module.exports = new NicknameService();
