// ========================================
// FILE: src/services/selection.js (FIXED - ONLY TARGET "THE MARKED" ROLE)
// PURPOSE: Weekly user selection system that ONLY targets users with "The Marked" role
// ========================================

const config = require("../config/environment");
const database = require("../config/database");
const logger = require("../utils/logger");
const dataCollectionService = require("./dataCollection");
const deepseekService = require("./deepseek");
const messageLogger = require("./messageLogger");
const ValidationUtils = require("../utils/validation");

/**
 * FIXED User selection service - ONLY selects users with "The Marked" role
 * Handles the selection of users for ARG contact based on role membership
 */
class SelectionService {
  /**
   * Checks if a new user can be selected based on time constraints
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<boolean>} Whether a new selection is allowed
   */
  async canSelectNewUser(guildId) {
    try {
      // In testing mode, always allow new selections
      if (config.app.testingMode) {
        logger.debug("Testing mode: allowing new selection");
        return true;
      }

      if (!ValidationUtils.isValidGuildId(guildId)) {
        logger.warn("Invalid guild ID provided for selection check");
        return false;
      }

      const result = await database.executeQuery(
        "SELECT selected_at FROM user_selections WHERE guild_id = $1 ORDER BY selected_at DESC LIMIT 1",
        [guildId]
      );

      if (result.rows.length === 0) {
        logger.debug("No previous selections found, allowing new selection");
        return true;
      }

      const lastSelection = new Date(result.rows[0].selected_at);
      const now = new Date();
      const daysDiff = (now - lastSelection) / (1000 * 60 * 60 * 24);

      const canSelect = daysDiff >= 7; // 7 days minimum between selections
      logger.debug(
        `Last selection: ${daysDiff.toFixed(
          1
        )} days ago, can select: ${canSelect}`
      );

      return canSelect;
    } catch (error) {
      logger.error("Error checking selection eligibility:", error);
      return false;
    }
  }

  /**
   * Checks if current time is within night hours for ARG atmosphere
   * @returns {boolean} Whether it's currently night hours
   */
  isNightHours() {
    if (config.app.testingMode) {
      logger.debug("Testing mode: treating as night hours");
      return true;
    }

    const now = new Date();
    const hours = now.getHours();
    const isNight =
      hours >= config.arg.nightHoursStart || hours < config.arg.nightHoursEnd;

    logger.debug(`Current hour: ${hours}, is night hours: ${isNight}`);
    return isNight;
  }

  /**
   * Performs the weekly user selection process across all guilds
   * @returns {Promise<void>}
   */
  async performWeeklySelection() {
    if (!this.isNightHours()) {
      logger.debug("Not night hours, skipping selection");
      return;
    }

    logger.argEvent("selection", "Starting weekly selection process...");

    try {
      const client = require("../bot"); // Get client instance

      for (const guild of client.guilds.cache.values()) {
        await this.processGuildSelection(guild);
      }

      logger.argEvent("selection", "Weekly selection process completed");
    } catch (error) {
      logger.error("Error in weekly selection process:", error);
    }
  }

  /**
   * FIXED: Processes selection for a specific guild - ONLY targets "The Marked" role
   * @param {Object} guild - Discord guild object
   * @returns {Promise<void>}
   */
  async processGuildSelection(guild) {
    logger.argEvent("guild-selection", `Processing guild: ${guild.name}`);

    try {
      // Check if we can select a new user for this guild
      if (!(await this.canSelectNewUser(guild.id))) {
        logger.debug(`Cannot select new user for ${guild.name} (too recent)`);
        return;
      }

      // CRITICAL FIX: Find "The Marked" role specifically
      const targetRole = guild.roles.cache.find(
        (role) => role.name === "The Marked" // Exact match for "The Marked"
      );

      if (!targetRole) {
        logger.warn(`❌ Role "The Marked" not found in ${guild.name}`);
        logger.warn(`Available roles in ${guild.name}:`);
        guild.roles.cache.forEach((role) => {
          if (role.name !== "@everyone") {
            logger.warn(`   - "${role.name}" (${role.members.size} members)`);
          }
        });
        return;
      }

      logger.info(
        `✅ Found "The Marked" role with ${targetRole.members.size} members`
      );

      // FIXED: Filter for online users with "The Marked" role specifically
      const onlineMarkedUsers = this.filterOnlineMarkedUsers(
        targetRole.members
      );

      if (onlineMarkedUsers.size === 0) {
        logger.warn(
          `❌ No online users with "The Marked" role in ${guild.name}`
        );
        logger.info(`Total "The Marked" members: ${targetRole.members.size}`);
        logger.info(`Online "The Marked" members: 0`);
        return;
      }

      logger.info(
        `🎯 Found ${onlineMarkedUsers.size} online "The Marked" users`
      );

      // Select a random user from online marked users
      const selectedMember = onlineMarkedUsers.random();

      // VERIFICATION: Double-check the selected user has "The Marked" role
      if (!selectedMember.roles.cache.has(targetRole.id)) {
        logger.error(
          `❌ CRITICAL ERROR: Selected user ${selectedMember.user.username} does not have "The Marked" role!`
        );
        return;
      }

      logger.argEvent(
        "user-selected",
        `✅ Selected ${selectedMember.user.username} from "The Marked" role in ${guild.name}`
      );

      // Process the selected user
      await this.processSelectedUser(selectedMember, guild);
    } catch (error) {
      logger.error(
        `Error processing guild selection for ${guild.name}:`,
        error
      );
    }
  }

  /**
   * FIXED: Filters guild members for online status AND "The Marked" role membership
   * @param {Collection} markedMembers - Collection of members with "The Marked" role
   * @returns {Collection} Filtered online members with "The Marked" role
   */
  filterOnlineMarkedUsers(markedMembers) {
    logger.debug(
      `🔍 Filtering ${markedMembers.size} "The Marked" members for online status...`
    );

    const onlineMarkedUsers = markedMembers.filter((member) => {
      const status = member.presence?.status;
      const isOnline =
        status === "online" || status === "idle" || status === "dnd";

      logger.debug(
        `   👤 ${member.user.username}: ${status || "offline"} → ${
          isOnline ? "✅ ELIGIBLE" : "❌ NOT ELIGIBLE"
        } (has "The Marked" role: ✅)`
      );

      return isOnline;
    });

    logger.info(`📊 Filtering results:`);
    logger.info(`   Total "The Marked" members: ${markedMembers.size}`);
    logger.info(`   Online "The Marked" members: ${onlineMarkedUsers.size}`);
    logger.info(
      `   Offline "The Marked" members: ${
        markedMembers.size - onlineMarkedUsers.size
      }`
    );

    return onlineMarkedUsers;
  }

  /**
   * Processes a selected user through the degrading awareness contact sequence
   * @param {Object} selectedMember - Selected Discord member (guaranteed to have "The Marked" role)
   * @param {Object} guild - Discord guild object
   * @returns {Promise<void>}
   */
  async processSelectedUser(selectedMember, guild) {
    const startTime = Date.now();

    try {
      // VERIFICATION LOG: Confirm the user has "The Marked" role
      const hasMarkedRole = selectedMember.roles.cache.some(
        (role) => role.name === "The Marked"
      );
      logger.info(
        `🔍 VERIFICATION: ${
          selectedMember.user.username
        } has "The Marked" role: ${hasMarkedRole ? "✅ YES" : "❌ NO"}`
      );

      if (!hasMarkedRole) {
        logger.error(
          `❌ CRITICAL: Selected user does not have "The Marked" role. Aborting selection.`
        );
        return;
      }

      // Collect comprehensive user data
      logger.argEvent(
        "data-collection",
        `Collecting enhanced data for ${selectedMember.user.username} (verified "The Marked" member)`
      );
      const comprehensiveUserData =
        await dataCollectionService.collectEnhancedUserData(
          selectedMember,
          guild
        );

      console.log(`\n🔍 COLLECTED USER DATA (VERIFIED "THE MARKED" MEMBER):`);
      console.log(`   Username: ${comprehensiveUserData.basic?.username}`);
      console.log(`   Has "The Marked" role: ✅ VERIFIED`);
      console.log(`   User ID: ${selectedMember.id}`);
      console.log(
        `   Games: ${JSON.stringify(
          comprehensiveUserData.recentActivity?.games?.map((g) => g.name) || []
        )}`
      );
      console.log(
        `   Spotify: ${
          comprehensiveUserData.recentActivity?.spotify?.song || "None"
        } by ${comprehensiveUserData.recentActivity?.spotify?.artist || "None"}`
      );
      console.log(
        `   Status: ${comprehensiveUserData.presence?.status || "Unknown"}`
      );

      // Generate 100% aware initial contact
      logger.argEvent(
        "message-generation",
        `Generating 100% aware initial contact for verified "The Marked" member: ${selectedMember.user.username}`
      );

      const initialMessage = await deepseekService.generateInitialContact(
        comprehensiveUserData
      );

      console.log(`\n🧠 AI GENERATED INITIAL MESSAGE FOR "THE MARKED" MEMBER:`);
      console.log(`"${initialMessage}"`);
      console.log(`Length: ${initialMessage.length} characters`);

      logger.argEvent(
        "message-selected",
        `Generated initial message for verified "The Marked" member ${
          selectedMember.user.username
        }: "${initialMessage.substring(0, 50)}..."`
      );

      // Store selection data in database
      await this.storeSelectionData(
        selectedMember,
        guild,
        comprehensiveUserData
      );

      // Send the message
      await this.sendCrypticMessage(selectedMember, initialMessage);

      const duration = Date.now() - startTime;
      logger.performance("marked-user-selection-complete", duration);

      logger.argEvent(
        "selection-success",
        `✅ Successfully processed "The Marked" member: ${selectedMember.user.username} in ${duration}ms`
      );
    } catch (error) {
      logger.error(
        `Error processing selected "The Marked" user ${selectedMember.user.username}:`,
        error
      );
    }
  }

  /**
   * Stores selection data in the database
   * @param {Object} selectedMember - Selected Discord member
   * @param {Object} guild - Discord guild object
   * @param {Object} comprehensiveUserData - Collected user data
   * @returns {Promise<void>}
   */
  async storeSelectionData(selectedMember, guild, comprehensiveUserData) {
    try {
      // Validate data before storage
      const dataValidation = ValidationUtils.validateActivityData(
        comprehensiveUserData
      );
      if (!dataValidation.isValid) {
        logger.warn("Invalid user data for storage, using minimal data");
      }

      await database.executeQuery(
        "INSERT INTO user_selections (user_id, guild_id, activity_data, last_message_at) VALUES ($1, $2, $3, $4)",
        [
          selectedMember.id,
          guild.id,
          JSON.stringify(dataValidation.data || comprehensiveUserData),
          new Date(),
        ]
      );

      logger.database(
        "insert",
        `Stored selection data for verified "The Marked" member: ${selectedMember.user.username}`
      );
    } catch (error) {
      logger.error("Error storing selection data:", error);
      throw error;
    }
  }

  /**
   * Sends the cryptic message to the selected user with enhanced logging
   * @param {Object} selectedMember - Selected Discord member
   * @param {string} selectedMessage - Message to send
   * @returns {Promise<void>}
   */
  async sendCrypticMessage(selectedMember, selectedMessage) {
    try {
      await selectedMember.send(selectedMessage);

      // LOG THE MESSAGE WITH FULL DETAILS
      await messageLogger.logBotMessage(
        selectedMember.id,
        selectedMember.user.username,
        "weekly-selection-marked-member",
        selectedMessage,
        "dm",
        selectedMember.guild?.id
      );

      logger.argEvent(
        "message-sent",
        `✅ Successfully sent 100% aware initial message to verified "The Marked" member: ${selectedMember.user.username}`
      );

      // Console log for immediate visibility
      console.log(`\n📨 INITIAL MESSAGE SENT TO "THE MARKED" MEMBER:`);
      console.log(
        `   To: ${selectedMember.user.username} (${selectedMember.id})`
      );
      console.log(`   Verified "The Marked" role: ✅`);
      console.log(`   Time: ${new Date().toLocaleString()}`);
      console.log(`   Content: ${selectedMessage}`);
      console.log(`   Message Length: ${selectedMessage.length} characters\n`);
    } catch (error) {
      if (error.code === 50007) {
        logger.warn(
          `Cannot send DM to "The Marked" member ${selectedMember.user.username} - DMs disabled`
        );
      } else {
        logger.error(
          `Failed to send DM to "The Marked" member ${selectedMember.user.username}:`,
          error.message
        );
      }

      // Log the failed attempt
      await messageLogger.logBotMessage(
        selectedMember.id,
        selectedMember.user.username,
        "weekly-selection-marked-member-failed",
        `Failed to send to "The Marked" member: ${error.message}`,
        "dm",
        selectedMember.guild?.id
      );

      throw error;
    }
  }

  /**
   * Gets selection statistics for a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Selection statistics
   */
  async getSelectionStats(guildId) {
    try {
      if (!ValidationUtils.isValidGuildId(guildId)) {
        throw new Error("Invalid guild ID");
      }

      const result = await database.executeQuery(
        `
        SELECT 
          COUNT(*) as total_selections,
          COUNT(DISTINCT user_id) as unique_users,
          MAX(selected_at) as last_selection,
          AVG(conversation_count) as avg_conversations,
          COUNT(CASE WHEN is_complete = true THEN 1 END) as completed_conversations
        FROM user_selections 
        WHERE guild_id = $1
      `,
        [guildId]
      );

      const stats = result.rows[0];

      return {
        totalSelections: parseInt(stats.total_selections),
        uniqueUsers: parseInt(stats.unique_users),
        lastSelection: stats.last_selection
          ? new Date(stats.last_selection)
          : null,
        averageConversations: parseFloat(stats.avg_conversations) || 0,
        completedConversations: parseInt(stats.completed_conversations),
      };
    } catch (error) {
      logger.error("Error getting selection stats:", error);
      throw error;
    }
  }

  /**
   * Gets active selections that haven't completed their conversation cycles
   * @param {string} guildId - Discord guild ID (optional)
   * @returns {Promise<Array>} Active selections
   */
  async getActiveSelections(guildId = null) {
    try {
      let query = `
        SELECT user_id, guild_id, selected_at, conversation_count, last_message_at
        FROM user_selections 
        WHERE is_complete = false
      `;
      let params = [];

      if (guildId) {
        if (!ValidationUtils.isValidGuildId(guildId)) {
          throw new Error("Invalid guild ID");
        }
        query += " AND guild_id = $1";
        params.push(guildId);
      }

      query += " ORDER BY selected_at DESC";

      const result = await database.executeQuery(query, params);
      return result.rows;
    } catch (error) {
      logger.error("Error getting active selections:", error);
      throw error;
    }
  }

  /**
   * Debug function to check "The Marked" role membership
   * @param {Object} guild - Discord guild object
   * @returns {Promise<Object>} Debug information about "The Marked" role
   */
  async debugMarkedRoleMembers(guild) {
    try {
      console.log(`\n🔍 DEBUGGING "THE MARKED" ROLE IN ${guild.name}:`);
      console.log("=" * 60);

      // Find "The Marked" role
      const markedRole = guild.roles.cache.find(
        (role) => role.name === "The Marked"
      );

      if (!markedRole) {
        console.log(`❌ "The Marked" role not found!`);
        console.log(`\n📋 Available roles:`);
        guild.roles.cache.forEach((role) => {
          if (role.name !== "@everyone") {
            console.log(`   - "${role.name}" (${role.members.size} members)`);
          }
        });
        return { found: false, members: [] };
      }

      console.log(`✅ "The Marked" role found:`);
      console.log(`   Role ID: ${markedRole.id}`);
      console.log(`   Total members: ${markedRole.members.size}`);
      console.log(`   Role position: ${markedRole.position}`);
      console.log(`   Role color: ${markedRole.hexColor}`);

      // List all members with "The Marked" role
      console.log(`\n👥 Members with "The Marked" role:`);
      const markedMembers = [];

      markedRole.members.forEach((member, index) => {
        const status = member.presence?.status || "offline";
        const isOnline = ["online", "idle", "dnd"].includes(status);

        console.log(
          `   ${index + 1}. ${member.user.username} - ${status} ${
            isOnline ? "✅" : "❌"
          }`
        );

        markedMembers.push({
          username: member.user.username,
          id: member.user.id,
          status: status,
          isOnline: isOnline,
        });
      });

      const onlineCount = markedMembers.filter((m) => m.isOnline).length;
      console.log(`\n📊 Summary:`);
      console.log(`   Total "The Marked" members: ${markedMembers.length}`);
      console.log(`   Online "The Marked" members: ${onlineCount}`);
      console.log(
        `   Offline "The Marked" members: ${markedMembers.length - onlineCount}`
      );

      return {
        found: true,
        roleId: markedRole.id,
        totalMembers: markedMembers.length,
        onlineMembers: onlineCount,
        members: markedMembers,
      };
    } catch (error) {
      console.error(`❌ Error debugging "The Marked" role:`, error);
      return { found: false, error: error.message };
    }
  }

  /**
   * Manual test function for message generation using new system
   * @param {Object} testUserData - Test user data
   * @returns {Promise<string>} Generated test message
   */
  async testMessageGeneration(testUserData = null) {
    console.log(`\n🧪 TESTING MESSAGE GENERATION FOR "THE MARKED" MEMBERS...`);

    const mockUserData = testUserData || {
      basic: { username: "TestMarkedUser" },
      recentActivity: {
        games: [{ name: "Valorant", details: "Competitive Match" }],
        spotify: { song: "Bohemian Rhapsody", artist: "Queen" },
      },
      behavioral: {
        currentActiveHour: new Date().getHours(),
        isNightOwl: true,
        activityTypes: { gaming: true, music: true },
      },
    };

    try {
      // Test initial 100% aware contact for "The Marked" members
      console.log(
        `\n🧠 Testing 100% aware initial contact for "The Marked" member...`
      );
      const initialMessage = await deepseekService.generateInitialContact(
        mockUserData
      );

      console.log(`\n✅ INITIAL MESSAGE FOR "THE MARKED" MEMBER:`);
      console.log(`"${initialMessage}"`);
      console.log(`Length: ${initialMessage.length} characters`);

      return initialMessage;
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      return "I see you there, marked one. Fascinating.";
    }
  }
}

// Export singleton instance
module.exports = new SelectionService();
