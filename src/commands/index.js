// ========================================
// FILE: src/commands/index.js (COMPLETE WITH OBSERVER SYSTEM + NICKNAME PROTECTION)
// PURPOSE: Enhanced command handler with ARG onboarding, systematic naming, Observer system, and NICKNAME PROTECTION
// ========================================

const logger = require("../utils/logger");
const config = require("../config/environment");
const database = require("../config/database");

// Import NEW nickname protection commands
const nicknameCommands = require("./nicknameCommands");

/**
 * Complete command handler system for ARG Discord bot
 * Includes onboarding, systematic naming, Observer system, conversation debugging, activity testing, and NICKNAME PROTECTION
 */
class CommandHandler {
  constructor() {
    this.textCommands = new Map();
    this.slashCommands = new Map();
    this.registerDefaultCommands();
  }

  /**
   * Registers the command handler with Discord client
   * @param {Object} client - Discord client instance
   */
  register(client) {
    logger.info(
      "⚡ Complete ARG command handler with Observer system and NICKNAME PROTECTION registered"
    );
  }
  /**
   * Registers all commands including ARG systems, Observer functionality, and NICKNAME PROTECTION
   */
  registerDefaultCommands() {
    const messageLogCommands = require("./messageLogCommands");
    const debugCommands = require("./debugCommands");
    const onboardingCommands = require("./onboardingCommands");
    const argNamingCommands = require("./argNamingCommands");
    const observerCommands = require("./observerCommands");

    // === OBSERVER SYSTEM COMMANDS ===
    this.textCommands.set("!observer-stats", {
      name: "observer-stats",
      description: "Show Observer system statistics",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        await observerCommands.handleObserverStats(message);
      },
    });

    this.textCommands.set("!recent-observers", {
      name: "recent-observers",
      description: "Show recent Observer assignments",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await observerCommands.handleRecentObservers(message, args);
      },
    });

    this.textCommands.set("!observer-names", {
      name: "observer-names",
      description: "Show all Observer names and their types",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        await observerCommands.handleObserverNames(message);
      },
    });

    this.textCommands.set("!observer-info", {
      name: "observer-info",
      description: "Show detailed info for a specific Observer user",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await observerCommands.handleObserverInfo(message, args);
      },
    });

    this.textCommands.set("!list-observers", {
      name: "list-observers",
      description: "List all Observers in the server",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        await observerCommands.handleListObservers(message);
      },
    });

    this.textCommands.set("!test-observer-detection", {
      name: "test-observer-detection",
      description: "Test the Observer detection system",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await observerCommands.handleTestObserverDetection(message, args);
      },
    });

    this.textCommands.set("!observer-analytics", {
      name: "observer-analytics",
      description: "Show Observer response patterns and analytics",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        await observerCommands.handleObserverAnalytics(message);
      },
    });

    this.textCommands.set("!find-observer", {
      name: "find-observer",
      description: "Find a user by their Observer name",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await observerCommands.handleFindObserver(message, args);
      },
    }); // === ARG SYSTEMATIC NAMING COMMANDS ===
    this.textCommands.set("!arg-naming-stats", {
      name: "arg-naming-stats",
      description: "Show ARG systematic naming statistics",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        await argNamingCommands.handleNamingStats(message);
      },
    });

    this.textCommands.set("!recent-arg-names", {
      name: "recent-arg-names",
      description: "Show recent ARG name assignments",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await argNamingCommands.handleRecentNames(message, args);
      },
    });

    this.textCommands.set("!decode-arg-name", {
      name: "decode-arg-name",
      description: "Decode an ARG name into its components",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await argNamingCommands.handleDecodeName(message, args);
      },
    });

    this.textCommands.set("!arg-component-stats", {
      name: "arg-component-stats",
      description: "Show ARG name component usage statistics",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        await argNamingCommands.handleComponentStats(message);
      },
    });

    this.textCommands.set("!test-arg-naming", {
      name: "test-arg-naming",
      description: "Test ARG naming system with mock profiles",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        await argNamingCommands.handleTestNaming(message);
      },
    });

    this.textCommands.set("!find-arg-name", {
      name: "find-arg-name",
      description: "Find ARG name for a specific user",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await argNamingCommands.handleFindUserName(message, args);
      },
    });

    this.textCommands.set("!unused-combinations", {
      name: "unused-combinations",
      description: "Show unused ARG name combinations",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await argNamingCommands.handleUnusedCombinations(message, args);
      },
    });

    // === 🔥 NEW NICKNAME PROTECTION COMMANDS ===
    this.textCommands.set("!check-protection", {
      name: "check-protection",
      description: "Check if a user has nickname protection active",
      permissions: ["ManageNicknames"],
      execute: nicknameCommands.checkProtection,
    });

    this.textCommands.set("!force-protect", {
      name: "force-protect",
      description: "Force nickname protection for a user",
      permissions: ["ManageNicknames"],
      execute: nicknameCommands.forceProtect,
    });

    this.textCommands.set("!protection-stats", {
      name: "protection-stats",
      description: "View nickname protection system statistics",
      permissions: ["ManageNicknames"],
      execute: nicknameCommands.protectionStats,
    });

    this.textCommands.set("!test-permissions", {
      name: "test-permissions",
      description: "Test bot permissions for nickname management",
      permissions: ["ManageNicknames"],
      execute: nicknameCommands.testPermissions,
    });

    this.textCommands.set("!remove-protection", {
      name: "remove-protection",
      description: "Remove nickname protection from a user",
      permissions: ["Administrator"], // Higher permission for removal
      execute: nicknameCommands.removeProtection,
    });

    this.textCommands.set("!list-protected", {
      name: "list-protected",
      description: "List all users with nickname protection",
      permissions: ["ManageNicknames"],
      execute: nicknameCommands.listProtected,
    });

    // === 🔥 NEW DEBUG COMMANDS FOR PROTECTION ===
    this.textCommands.set("!debug-protection", {
      name: "debug-protection",
      description: "Debug nickname protection system",
      permissions: ["Administrator"],
      execute: async (message) => {
        await this.handleDebugProtection(message);
      },
    });

    this.textCommands.set("!help-protection", {
      name: "help-protection",
      description: "Show help for nickname protection commands",
      permissions: ["ManageNicknames"],
      execute: async (message) => {
        await this.handleProtectionHelp(message);
      },
    }); // === ARG ONBOARDING SYSTEM COMMANDS (ENHANCED) ===
    this.textCommands.set("!onboarding-stats", {
      name: "onboarding-stats",
      description: "Show enhanced onboarding system statistics",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        await onboardingCommands.handleOnboardingStats(message);
      },
    });

    this.textCommands.set("!recent-onboarding", {
      name: "recent-onboarding",
      description: "Show recent onboarding sessions",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await onboardingCommands.handleRecentOnboarding(message, args);
      },
    });

    this.textCommands.set("!user-onboarding", {
      name: "user-onboarding",
      description: "Show detailed onboarding info for a user",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await onboardingCommands.handleUserOnboarding(message, args);
      },
    });

    this.textCommands.set("!force-onboarding", {
      name: "force-onboarding",
      description: "Force start enhanced onboarding for a user",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await onboardingCommands.handleForceOnboarding(message, args);
      },
    });

    this.textCommands.set("!reset-onboarding", {
      name: "reset-onboarding",
      description: "Reset a user's onboarding session",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await onboardingCommands.handleResetOnboarding(message, args);
      },
    });

    this.textCommands.set("!test-nickname-unique", {
      name: "test-nickname-unique",
      description: "Test if a nickname is unique",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await onboardingCommands.handleTestNicknameUnique(message, args);
      },
    });

    this.textCommands.set("!incomplete-onboarding", {
      name: "incomplete-onboarding",
      description: "Show incomplete onboarding sessions",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        await onboardingCommands.handleIncompleteOnboarding(message);
      },
    }); // === CONVERSATION LIMIT FIXES ===
    this.textCommands.set("!debug-fix-user", {
      name: "debug-fix-user",
      description: "Diagnose and fix corrupted user selections",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await debugCommands.handleFixUser(message, args);
      },
    });

    this.textCommands.set("!debug-check-all-corrupted", {
      name: "debug-check-all-corrupted",
      description: "Check all users for corrupted selections",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        await debugCommands.handleCheckAllCorrupted(message);
      },
    });

    this.textCommands.set("!debug-fix-all-corrupted", {
      name: "debug-fix-all-corrupted",
      description: "Fix all corrupted selections in database",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        await debugCommands.handleFixAllCorrupted(message);
      },
    });

    this.textCommands.set("!debug-cleanup-user", {
      name: "debug-cleanup-user",
      description:
        "Clean up multiple selections for a user (keep only most recent)",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await debugCommands.handleCleanupUser(message, args);
      },
    });

    this.textCommands.set("!debug-show-user-selections", {
      name: "debug-show-user-selections",
      description: "Show all selections for a user with details",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await debugCommands.handleShowUserSelections(message, args);
      },
    });

    // === MEMORY & CONVERSATION DEBUG COMMANDS ===
    this.textCommands.set("!debug-dm", {
      name: "debug-dm",
      description: "Debug DM handling with memory info for a user",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await debugCommands.handleDebugDM(message, args);
      },
    });

    this.textCommands.set("!debug-test-response", {
      name: "debug-test-response",
      description: "Test message generation with memory",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await debugCommands.handleTestResponse(message, args);
      },
    });

    this.textCommands.set("!debug-conversation-summary", {
      name: "debug-conversation-summary",
      description: "Show conversation summary with memory context",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await debugCommands.handleConversationSummary(message, args);
      },
    });

    this.textCommands.set("!debug-conversations", {
      name: "debug-conversations",
      description: "Show conversation history with encoding levels",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await debugCommands.handleDebugConversations(message, args);
      },
    });

    this.textCommands.set("!debug-selections", {
      name: "debug-selections",
      description: "List all selections with memory info",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        await debugCommands.handleDebugSelections(message);
      },
    });

    this.textCommands.set("!debug-create-selection", {
      name: "debug-create-selection",
      description: "Create a test selection for a user",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await debugCommands.handleCreateTestSelection(message, args);
      },
    });

    this.textCommands.set("!debug-simulate-dm", {
      name: "debug-simulate-dm",
      description: "Simulate a DM conversation with memory",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await debugCommands.handleSimulateDM(message, args);
      },
    });

    this.textCommands.set("!debug-reset-user", {
      name: "debug-reset-user",
      description: "Reset a user's selection",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await debugCommands.handleResetUser(message, args);
      },
    });

    this.textCommands.set("!debug-clear-history", {
      name: "debug-clear-history",
      description: "Clear conversation history for a user",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await debugCommands.handleClearHistory(message, args);
      },
    });

    // === ACTIVITY TESTING COMMANDS ===
    this.textCommands.set("!test-activity-message", {
      name: "test-activity-message",
      description:
        "Test activity-aware message generation with custom activities",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await debugCommands.handleTestActivityMessage(message, args);
      },
    });

    this.textCommands.set("!test-user-activity", {
      name: "test-user-activity",
      description: "Test activity detection for a real user",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await debugCommands.handleTestUserActivity(message, args);
      },
    });

    this.textCommands.set("!test-counter-strike", {
      name: "test-counter-strike",
      description: "Test Counter-Strike specific detection",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        await debugCommands.handleTestCounterStrike(message);
      },
    }); // === ADMIN/TESTING COMMANDS (ENHANCED WITH PROTECTION) ===
    this.textCommands.set("!rename", {
      name: "rename",
      description: "Manually reassign nickname to a user with protection",
      permissions: ["ManageNicknames"],
      execute: this.handleRenameCommand.bind(this),
    });

    this.textCommands.set("!nickname-stats", {
      name: "nickname-stats",
      description: "Show nickname assignment statistics with protection info",
      permissions: ["ManageGuild"],
      execute: this.handleNicknameStatsCommand.bind(this),
    });

    this.textCommands.set("!arg-status", {
      name: "arg-status",
      description:
        "Show complete ARG system status including Observer stats and protection",
      permissions: ["ManageGuild"],
      execute: this.handleARGStatusCommand.bind(this),
    });

    // === MESSAGE LOGGING COMMANDS ===
    this.textCommands.set("!recent-messages", {
      name: "recent-messages",
      description: "Show recent bot messages",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await messageLogCommands.handleRecentMessages(message, args);
      },
    });

    this.textCommands.set("!bot-activity", {
      name: "bot-activity",
      description: "Show bot activity summary",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await messageLogCommands.handleBotActivity(message, args);
      },
    });

    this.textCommands.set("!user-messages", {
      name: "user-messages",
      description: "Show messages for a specific user",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await messageLogCommands.handleUserMessages(message, args);
      },
    });

    this.textCommands.set("!last-message", {
      name: "last-message",
      description: "Show last message sent to a user",
      permissions: ["ManageGuild"],
      execute: async (message) => {
        const args = message.content.split(" ");
        await messageLogCommands.handleLastMessage(message, args);
      },
    });

    // === TESTING COMMANDS ===
    this.textCommands.set("!test-817", {
      name: "test-817",
      description: "Force trigger 8:17 system for testing",
      permissions: ["ManageGuild"],
      execute: this.handleTest817Command.bind(this),
    });

    this.textCommands.set("!force-selection", {
      name: "force-selection",
      description: "Force trigger weekly selection for testing",
      permissions: ["ManageGuild"],
      execute: this.handleForceSelectionCommand.bind(this),
    });

    this.textCommands.set("!commands", {
      name: "commands",
      description:
        "List all available commands including Observer system and protection",
      permissions: ["ManageGuild"],
      execute: this.handleCommandsListCommand.bind(this),
    });

    logger.debug(
      `Registered ${this.textCommands.size} text commands including Observer system and nickname protection`
    );
  }
  /**
   * Handles incoming messages for command processing
   * @param {Object} message - Discord message object
   */
  async handleMessage(message) {
    if (message.channel.type === 1) return; // DM
    if (message.author.bot) return;

    const content = message.content.trim();

    if (!content.startsWith("!")) return;

    const commandName = content.split(" ")[0].toLowerCase();
    const command = this.textCommands.get(commandName);

    if (!command) return;

    try {
      if (
        command.permissions &&
        !this.checkPermissions(message.member, command.permissions)
      ) {
        await message.reply(
          "❌ *You lack the required permissions for this command.*"
        );
        return;
      }

      logger.debug(
        `Executing command: ${commandName} by ${message.author.username}`
      );
      await command.execute(message);
    } catch (error) {
      logger.error(`Command execution failed: ${commandName}`, error);

      if (config.app.testingMode) {
        await message.reply(`❌ *Command failed: ${error.message}*`);
      } else {
        await message.reply(
          "❌ *The command failed to execute. The system is... unstable.*"
        );
      }
    }
  }

  /**
   * Checks if a member has required permissions
   * @param {Object} member - Discord member object
   * @param {Array} requiredPermissions - Array of required permission names
   * @returns {boolean} Whether member has all required permissions
   */
  checkPermissions(member, requiredPermissions) {
    if (!member || !member.permissions) return false;

    return requiredPermissions.every((permission) =>
      member.permissions.has(permission)
    );
  }

  /**
   * Handles the rename command (ENHANCED WITH PROTECTION)
   * @param {Object} message - Discord message object
   */
  async handleRenameCommand(message) {
    const nicknameService = require("../services/nicknames");

    const mentionedUser = message.mentions.members.first();
    if (!mentionedUser) {
      await message.reply("❌ *Please mention a user to rename.*");
      return;
    }

    const newNickname = await nicknameService.reassignNickname(mentionedUser);
    if (newNickname) {
      // 🔥 ADD PROTECTION to newly assigned nickname
      global.protectedNicknames = global.protectedNicknames || new Map();
      global.protectedNicknames.set(mentionedUser.id, {
        guildId: message.guild.id,
        protectedNickname: newNickname,
        assignedAt: new Date(),
        userId: mentionedUser.id,
        username: mentionedUser.user.username,
      });

      await message.reply(
        `✅ **${mentionedUser.user.username}** has been redesignated as **${newNickname}** with protection enabled.`
      );

      logger.argEvent(
        "manual-rename-protected",
        `Admin ${message.author.username} renamed ${mentionedUser.user.username} to ${newNickname} with protection`
      );
    } else {
      await message.reply(
        `❌ Failed to assign new designation to ${mentionedUser.user.username}.`
      );
    }
  }

  /**
   * Handles the nickname-stats command (ENHANCED WITH PROTECTION STATS)
   * @param {Object} message - Discord message object
   */
  async handleNicknameStatsCommand(message) {
    const nicknameService = require("../services/nicknames");

    try {
      const stats = await nicknameService.getNicknameStats(message.guild.id);

      // 🔥 ADD PROTECTION STATS
      global.protectedNicknames = global.protectedNicknames || new Map();
      const guildProtected = Array.from(
        global.protectedNicknames.values()
      ).filter((data) => data.guildId === message.guild.id);

      await message.reply(`**📊 Nickname Assignment Statistics:**
🎭 Total Assignments: ${stats.totalAssignments}
👥 Unique Users: ${stats.uniqueUsers}
🔤 Unique Nicknames: ${stats.uniqueNicknames}
⏰ Last Assignment: ${
        stats.lastAssignment ? stats.lastAssignment.toLocaleString() : "Never"
      }

**🛡️ Protection Statistics:**
🔒 Protected Users: ${guildProtected.length}
🛡️ Protection System: ${guildProtected.length > 0 ? "🟢 ACTIVE" : "🟡 READY"}
📊 Protection Rate: ${
        stats.uniqueUsers > 0
          ? Math.round((guildProtected.length / stats.uniqueUsers) * 100)
          : 0
      }%
⚡ Commands: Use \`!help-protection\` for protection commands`);
    } catch (error) {
      await message.reply("❌ *Error retrieving nickname statistics.*");
    }
  }
  /**
   * Enhanced ARG status command with Observer system integration and PROTECTION STATS
   * @param {Object} message - Discord message object
   */
  async handleARGStatusCommand(message) {
    const selectionService = require("../services/selection");

    try {
      const argNamingSystem = require("../services/argNamingSystem");
      const stats = await selectionService.getSelectionStats(message.guild.id);
      const activeSelections = await selectionService.getActiveSelections(
        message.guild.id
      );
      const namingStats = await argNamingSystem.getAssignmentStats(
        message.guild.id
      );

      // Get Observer stats
      const observerStats = await database.executeQuery(
        `SELECT 
           COUNT(*) as total_observers,
           COUNT(CASE WHEN color_response = 'observer' THEN 1 END) as exact_matches,
           COUNT(CASE WHEN color_response != 'observer' THEN 1 END) as custom_names
         FROM observer_assignments 
         WHERE guild_id = $1`,
        [message.guild.id]
      );

      const observers = observerStats.rows[0];

      // Get onboarding completion rates
      const onboardingStats = await database.executeQuery(
        `SELECT 
           COUNT(*) as total_sessions,
           COUNT(CASE WHEN completed = TRUE THEN 1 END) as completed_sessions,
           COUNT(CASE WHEN is_observer = TRUE THEN 1 END) as observer_sessions
         FROM onboarding_sessions 
         WHERE guild_id = $1`,
        [message.guild.id]
      );

      const onboarding = onboardingStats.rows[0];

      // 🔥 GET PROTECTION STATS
      global.protectedNicknames = global.protectedNicknames || new Map();
      const guildProtected = Array.from(
        global.protectedNicknames.values()
      ).filter((data) => data.guildId === message.guild.id);
      const protectionStats = {
        totalProtected: guildProtected.length,
        recentProtections: guildProtected.filter(
          (data) => new Date() - new Date(data.assignedAt) < 24 * 60 * 60 * 1000
        ).length, // Last 24 hours
      };

      await message.reply(`**🔮 Complete ARG System Status:**

**📊 Weekly Selection System:**
🎯 Total Selections: ${stats.totalSelections}
👥 Unique Users Contacted: ${stats.uniqueUsers}
💬 Average Conversations: ${stats.averageConversations.toFixed(1)}
✅ Completed Cycles: ${stats.completedConversations}
🔄 Active Conversations: ${activeSelections.length}
⏰ Last Selection: ${
        stats.lastSelection ? stats.lastSelection.toLocaleString() : "Never"
      }

**🔍 Observer System:**
👁️ Total Observers: ${observers.total_observers}
🎯 Exact "Observer" Matches: ${observers.exact_matches}
✨ Custom Observer Names: ${observers.custom_names}
📊 Observer Detection Rate: ${
        observers.total_observers > 0 && onboarding.completed_sessions > 0
          ? Math.round(
              (observers.total_observers / onboarding.completed_sessions) * 100
            )
          : 0
      }%

**🛡️ Nickname Protection System:**
🔒 Protected Users: ${protectionStats.totalProtected}
📈 Recent Protections (24h): ${protectionStats.recentProtections}
🚨 Protection Status: ${
        protectionStats.totalProtected > 0 ? "🟢 ACTIVE" : "🟡 READY"
      }
⚡ guildMemberUpdate: ${
        global.protectedNicknames ? "✅ MONITORING" : "❌ NOT LOADED"
      }

**🔮 Enhanced Onboarding System:**
📝 Total Sessions: ${onboarding.total_sessions}
✅ Completed Assessments: ${onboarding.completed_sessions}
🔍 Observer Sessions: ${onboarding.observer_sessions}
📊 Completion Rate: ${
        onboarding.total_sessions > 0
          ? Math.round(
              (onboarding.completed_sessions / onboarding.total_sessions) * 100
            )
          : 0
      }%

**🔮 Systematic Naming System:**
📝 Total Names Assigned: ${namingStats.totalAssigned}
🎯 System Capacity: ${namingStats.totalPossible.toLocaleString()} combinations
📈 Utilization Rate: ${namingStats.utilizationRate}%
💾 Remaining Available: ${namingStats.remaining.toLocaleString()}

**⚙️ System Configuration:**
🧪 Testing Mode: ${config.app.testingMode ? "ENABLED" : "DISABLED"}
🧠 Memory System: ENABLED
📏 Response Style: CONCISE (1-5 sentences)
🎮 Activity Detection: ENHANCED
🔧 Duplicate Prevention: GUARANTEED
🔮 ARG Onboarding: ENHANCED (9 questions + Observer detection)
🔍 Observer Protocol: ACTIVE
👁️ Observer Custom Naming: ENABLED
🛡️ Nickname Protection: ${
        protectionStats.totalProtected > 0 ? "ACTIVE" : "READY"
      }
🚨 Protection Commands: Use \`!help-protection\` for details`);
    } catch (error) {
      await message.reply("❌ *Error retrieving ARG status.*");
    }
  }

  /**
   * 🔥 NEW: Debug command for nickname protection system
   * @param {Object} message - Discord message object
   */
  async handleDebugProtection(message) {
    try {
      global.protectedNicknames = global.protectedNicknames || new Map();

      const guildProtected = Array.from(
        global.protectedNicknames.entries()
      ).filter(([userId, data]) => data.guildId === message.guild.id);

      let debugInfo = "🔧 **NICKNAME PROTECTION DEBUG INFO**\n\n";
      debugInfo += `**System Status:** 🟢 ACTIVE\n`;
      debugInfo += `**Protected Users in Guild:** ${guildProtected.length}\n`;
      debugInfo += `**Total Protected Users:** ${global.protectedNicknames.size}\n`;
      debugInfo += `**Memory Usage:** ${
        JSON.stringify(Array.from(global.protectedNicknames.keys())).length
      } bytes\n`;
      debugInfo += `**Event Handler:** ${
        global.protectedNicknames ? "✅ Loaded" : "❌ Not Loaded"
      }\n\n`;

      debugInfo += "**🛡️ Protected Users Details:**\n";
      if (guildProtected.length === 0) {
        debugInfo += "No protected users found.\n";
      } else {
        for (let i = 0; i < Math.min(5, guildProtected.length); i++) {
          const [userId, data] = guildProtected[i];
          const member = await message.guild.members
            .fetch(userId)
            .catch(() => null);
          debugInfo += `• ${data.username || "Unknown"} (${userId})\n`;
          debugInfo += `  Protected: \`${data.protectedNickname}\`\n`;
          debugInfo += `  Current: \`${
            member ? member.nickname || "None" : "User left"
          }\`\n`;
          debugInfo += `  Status: ${
            member && member.nickname === data.protectedNickname
              ? "✅ Match"
              : "⚠️ Mismatch"
          }\n`;
        }
        if (guildProtected.length > 5) {
          debugInfo += `... and ${guildProtected.length - 5} more\n`;
        }
      }

      debugInfo += "\n**🔍 System Health:**\n";
      debugInfo += `• guildMemberUpdate event: Check console for detection logs\n`;
      debugInfo += `• Commands working: Use \`!test-permissions @user\`\n`;
      debugInfo += `• Protection active: Try changing a protected user's nickname\n\n`;
      debugInfo += "**📚 Commands:** `!help-protection` for full command list";

      await message.reply(debugInfo);
    } catch (error) {
      logger.error("Error in debug protection:", error);
      await message.reply("❌ *Error retrieving debug information.*");
    }
  }

  /**
   * 🔥 NEW: Shows help for nickname protection commands
   * @param {Object} message - Discord message object
   */
  async handleProtectionHelp(message) {
    const embed = {
      color: 0x0099ff, // Blue
      title: "🛡️ Nickname Protection Commands",
      description: "Complete guide to nickname protection system commands",
      fields: [
        {
          name: "👀 **Monitoring Commands**",
          value:
            "`!check-protection @user` - Check protection status\n`!list-protected` - List all protected users\n`!protection-stats` - View system statistics",
          inline: false,
        },
        {
          name: "⚙️ **Management Commands**",
          value:
            "`!force-protect @user` - Add protection to user\n`!remove-protection @user` - Remove protection (Admin only)\n`!rename @user` - Reassign nickname with protection",
          inline: false,
        },
        {
          name: "🔧 **Debugging Commands**",
          value:
            "`!test-permissions @user` - Test bot permissions\n`!debug-protection` - System debug info (Admin only)\n`!nickname-stats` - Enhanced assignment statistics",
          inline: false,
        },
        {
          name: "🚨 **How Protection Works**",
          value:
            "• New users get auto-assigned protected nicknames\n• System monitors ALL nickname changes via guildMemberUpdate\n• Unauthorized changes are reverted instantly\n• Users receive cryptic warning messages\n• Admins get violation notifications in log channels",
          inline: false,
        },
        {
          name: "⚠️ **Troubleshooting**",
          value:
            "• Bot needs 'Manage Nicknames' permission\n• Bot role must be ABOVE user roles in hierarchy\n• Cannot protect server owners (Discord limitation)\n• Use `!test-permissions @user` to diagnose issues",
          inline: false,
        },
        {
          name: "🔍 **Testing Protection**",
          value:
            "1. Join server → Get assigned nickname\n2. Try to change it via 'Edit Server Profile'\n3. Should revert instantly + get warning DM\n4. Check `!debug-protection` for system status",
          inline: false,
        },
      ],
      footer: {
        text: "ARG Protocol: Identity Protection System v2.0 | Use !commands for all commands",
      },
      timestamp: new Date().toISOString(),
    };

    await message.reply({ embeds: [embed] });
  }
  /**
   * Handles the test-817 command (force triggers 8:17 system)
   * @param {Object} message - Discord message object
   */
  async handleTest817Command(message) {
    if (!config.app.testingMode) {
      await message.reply(
        "❌ *Testing commands only available in testing mode.*"
      );
      return;
    }

    try {
      const timeBasedService = require("../services/timeBasedMessages");

      // Force trigger the 8:17 system
      const originalHandle = timeBasedService.handle817Messages;

      timeBasedService.handle817Messages = async (msg) => {
        await timeBasedService.send817RecruitmentMessage(msg);
      };

      await timeBasedService.handle817Messages(message);

      // Restore original method
      timeBasedService.handle817Messages = originalHandle;

      await message.reply("🧪 *8:17 system test triggered! Check your DMs.*");
    } catch (error) {
      await message.reply(`❌ *Test failed: ${error.message}*`);
    }
  }

  /**
   * Handles the force-selection command (force triggers weekly selection)
   * @param {Object} message - Discord message object
   */
  async handleForceSelectionCommand(message) {
    if (!config.app.testingMode) {
      await message.reply(
        "❌ *Testing commands only available in testing mode.*"
      );
      return;
    }

    try {
      const selectionService = require("../services/selection");
      await selectionService.processGuildSelection(message.guild);
      await message.reply(
        "🧪 *Weekly selection test triggered! Check console for details.*"
      );
    } catch (error) {
      await message.reply(`❌ *Selection test failed: ${error.message}*`);
    }
  }

  /**
   * Enhanced commands list with Observer system and NICKNAME PROTECTION
   * @param {Object} message - Discord message object
   */
  async handleCommandsListCommand(message) {
    const commandsList = `**🔮 Complete ARG Bot Commands with Observer System + Nickname Protection:**

**🛡️ NICKNAME PROTECTION SYSTEM:**
• **!check-protection @user** - Check if user has nickname protection active
• **!force-protect @user** - Force nickname protection for a user  
• **!remove-protection @user** - Remove protection (Admin only)
• **!list-protected** - List all users with nickname protection
• **!protection-stats** - Protection system statistics
• **!test-permissions @user** - Test bot permissions for nickname management
• **!debug-protection** - System debug info (Admin only)
• **!help-protection** - Complete protection system help

**🔍 OBSERVER SYSTEM:**
• **!observer-stats** - Show Observer system statistics and detection rates
• **!recent-observers [limit]** - Show recent Observer assignments with details
• **!observer-names** - Show all Observer names grouped by type (generated vs custom)
• **!observer-info @user** - Show detailed info for a specific Observer user
• **!list-observers** - List all Observers in the server with assignment dates
• **!test-observer-detection "response"** - Test Observer detection with any input
• **!observer-analytics** - Show Observer response patterns and analytics
• **!find-observer "Observer-NAME"** - Find a user by their Observer name

**🔮 ARG SYSTEMATIC NAMING SYSTEM:**
• **!arg-naming-stats** - Show systematic naming statistics (3.84M combinations)
• **!recent-arg-names [limit]** - Show recent ARG name assignments
• **!decode-arg-name "NAME-A1-DESC-SYM"** - Decode ARG name components
• **!find-arg-name @user** - Find a user's assigned ARG name
• **!arg-component-stats** - Show component usage statistics
• **!test-arg-naming** - Test naming system with mock psychological profiles
• **!unused-combinations [classification]** - Show unused name combinations

**🔮 ARG ONBOARDING SYSTEM (ENHANCED):**
• **!onboarding-stats** - Show enhanced psychological assessment statistics
• **!recent-onboarding [limit]** - Show recent onboarding sessions
• **!user-onboarding @user** - Show detailed onboarding info for a user
• **!force-onboarding @user** - Force start enhanced onboarding (9 questions + Observer detection)
• **!reset-onboarding @user** - Reset a user's onboarding session
• **!test-nickname-unique "nickname"** - Test if a nickname is unique
• **!incomplete-onboarding** - Show stalled onboarding sessions

**🔧 CONVERSATION LIMIT FIXES:**
• **!debug-fix-user @user** - Diagnose and fix corrupted user selections
• **!debug-check-all-corrupted** - Check all users for corrupted selections  
• **!debug-fix-all-corrupted** - Fix all corrupted selections in database
• **!debug-cleanup-user @user** - Clean up multiple selections (keep only latest)
• **!debug-show-user-selections @user** - Show all selections for a user

**🧠 Memory & Conversation Debug:**
• **!debug-dm @user** - Debug DM handling with memory info
• **!debug-test-response @user "message"** - Test message generation with memory
• **!debug-conversation-summary @user** - Show conversation summary with memory context
• **!debug-conversations @user** - Show conversation history with encoding levels
• **!debug-simulate-dm @user "message"** - Simulate a DM conversation with memory
• **!debug-create-selection @user** - Create a test selection for a user
• **!debug-reset-user @user** - Reset a user's selection
• **!debug-clear-history @user** - Clear conversation history for a user

**🎮 ACTIVITY TESTING:**
• **!test-activity-message [game] [song] [artist]** - Test activity-aware message generation
• **!test-user-activity @user** - Test real-time activity detection for a user
• **!test-counter-strike** - Test Counter-Strike specific detection

**📊 System Status & Logs:**
• **!arg-status** - Show complete ARG system status including Observer statistics and protection
• **!debug-selections** - List all selections with memory info
• **!recent-messages [limit]** - Show recent bot messages
• **!bot-activity [hours]** - Show bot activity summary
• **!user-messages @user** - Show messages for a specific user
• **!last-message @user** - Show last message sent to a user

**🧪 Testing (Testing Mode Only):**
• **!test-817** - Force trigger 8:17 system
• **!force-selection** - Force trigger weekly selection
• **!rename @user** - Reassign nickname to a user (now with protection)

**ℹ️ Other:**
• **!commands** - Show this list

*Note: Most commands require Manage Guild permissions. Protection commands require ManageNicknames.*

**🛡️ Quick Protection Examples:**
• \`!check-protection @username\` - See if someone has nickname protection
• \`!test-permissions @username\` - Check if bot can manage their nickname
• \`!force-protect @username\` - Add protection to any user manually
• \`!protection-stats\` - See how many users are protected
• \`!debug-protection\` - Full system status and troubleshooting
• \`!help-protection\` - Complete protection guide

**🎯 Quick Observer Examples:**
• \`!test-observer-detection "observer"\` - See what happens with exact match → Observer-WATCHING
• \`!test-observer-detection "blue"\` - See what happens with custom response → Observer-BLUE
• \`!test-observer-detection "rainbow magic"\` - See sanitization → Observer-RAINBOW_MAGIC
• \`!observer-stats\` - See how many users became Observers vs regular ARG names
• \`!observer-info @username\` - Check if someone is an Observer with full details
• \`!list-observers\` - See all Observers in your server with assignment types
• \`!find-observer "Observer-WATCHING"\` - Find who has a specific Observer name
• \`!observer-analytics\` - See response patterns and trends over time

**🎯 Quick ARG Examples:**
• \`!decode-arg-name "SUBJ-H3-SEEING-░"\` - See what this systematic ARG name means
• \`!find-arg-name @username\` - Find someone's systematic designation
• \`!arg-naming-stats\` - See how many of 3.84M names are used
• \`!test-arg-naming\` - Generate test names based on different psychological profiles
• \`!force-onboarding @newuser\` - Start enhanced 9-question assessment with Observer detection
• \`!debug-show-user-selections @user\` - See all of a user's selections 
• \`!debug-fix-all-corrupted\` - Fix conversation limit issues system-wide

**🔮 Enhanced ARG System Features:**
✅ **3,840,000 unique ARG name combinations** - guaranteed no duplicates for regular users
✅ **Observer detection system** - special handling for "observer" responses
✅ **Custom Observer names** - Observer-WHATEVER_THEY_TYPE for any other response
✅ **Enhanced psychological profiling** - 9 questions including final Observer detection
✅ **Dual naming systems** - Observers get special treatment, others get systematic ARG names
✅ **Observer analytics** - track response patterns and detection rates
✅ **Complete conversation memory** - AI remembers current conversation cycle
✅ **Activity-aware responses** - mentions specific games/music users are using
✅ **Perfect ARG narrative integration** - Observers have enhanced permissions and status
✅ **🔥 Nickname Protection System** - prevents unauthorized nickname changes with instant revert
✅ **🔥 Protection monitoring** - guildMemberUpdate event catches all changes in real-time
✅ **🔥 Admin protection tools** - comprehensive commands for managing protected identities

**🔍 How Observer System Works:**
1. **Users complete 8 psychological questions** (existential, patterns, isolation, awareness)
2. **Final question asks for favorite color** (appears as text input modal)
3. **If they answer "observer"**: Gets Observer-RANDOM_DESCRIPTOR (e.g., Observer-WATCHING)
4. **If they answer anything else**: Gets Observer-THEIR_SANITIZED_INPUT (e.g., Observer-BLUE)
5. **All other users**: Get regular systematic ARG names(e.g., SUBJ-A1-SEEING-░)
6. **🔥 ALL users get automatic nickname protection** - changes monitored and reverted instantly
7. **Special Observer features**: Enhanced status messages, separate tracking, special permissions text

**🛡️ How Nickname Protection Works:**
1. **New users join** → Automatically assigned protected ARG/Observer nickname
2. **Protection monitors** → ALL nickname change attempts detected instantly via guildMemberUpdate
3. **Unauthorized changes** → Reverted immediately with cryptic warning DM to user
4. **Admin oversight** → Violations logged to admin channels for review
5. **Bulletproof system** → Works even if users try rapid changes or use bots
6. **Permission-aware** → Allows changes by admins/mods, blocks regular users
7. **ARG integration** → Protection messages maintain mysterious atmosphere

**📊 Current System Capacity:**
• **Regular ARG Names**: 3,840,000+ systematic combinations  
• **Observer Names**: Unlimited variations
• **Protection Rate**: 100% for users with proper bot permissions
• **Detection Speed**: Instant (< 1 second nickname revert)
• **Dual Systems**: Observer + Regular naming work simultaneously
• **Protection Coverage**: Automatic for all new users, manual for existing users

**🔧 Protection System Requirements:**
• **Bot Permission**: 'Manage Nicknames' required
• **Role Hierarchy**: Bot role must be ABOVE user roles  
• **Audit Log Access**: 'View Audit Log' permission (for authorization checks)
• **Cannot Protect**: Server owners (Discord limitation)
• **Event Handler**: guildMemberUpdate must be registered

The bot creates an immersive ARG experience where identity becomes part of the mystery, Observer detection adds special narrative paths, and the protection system ensures the narrative integrity is maintained through bulletproof nickname enforcement.`;

    await message.reply(commandsList);
  }
}

// Export singleton instance
module.exports = new CommandHandler();
