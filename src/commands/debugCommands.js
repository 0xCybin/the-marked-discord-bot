// ========================================
// FILE: src/commands/debugCommands.js (ENHANCED WITH CONVERSATION LIMIT DEBUGGING)
// PURPOSE: Enhanced debug commands for conversation limits and data integrity
// ========================================

const database = require("../config/database");
const logger = require("../utils/logger");
const messageGeneration = require("../services/messageGeneration");
const dataCollection = require("../services/dataCollection");
const deepseek = require("../services/deepseek");
const config = require("../config/environment");

/**
 * Enhanced debug commands for ARG Discord bot with conversation limit diagnostics
 */
class DebugCommands {
  /**
   * Enhanced debug DM handling with detailed conversation limit checking
   * Usage: !debug-dm @user
   */
  async handleDebugDM(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to debug their DM handling."
        );
        return;
      }

      console.log(`\n🔧 ENHANCED DEBUG DM for ${mentionedUser.username}...`);

      // Use the enhanced debug function
      const debugInfo = await messageGeneration.debugDMHandling(
        mentionedUser.id
      );

      let response = `**🔧 Enhanced DM Debug for ${mentionedUser.username}:**\n\n`;

      response += `**📊 Selection Status:**\n`;
      response += `• Has Active Selection: ${
        debugInfo.hasActiveSelection ? "✅ Yes" : "❌ No"
      }\n`;
      response += `• Total Selections in DB: ${debugInfo.totalSelections}\n`;

      if (debugInfo.hasActiveSelection) {
        response += `• Selection ID: ${debugInfo.activeSelection.id}\n`;
        response += `• Current Conversations: ${debugInfo.conversationCount}/${debugInfo.maxConversationRounds}\n`;
        response += `• Is Complete: ${
          debugInfo.isComplete ? "✅ Yes" : "❌ No"
        }\n`;
        response += `• Next Count Would Be: ${debugInfo.nextConversationCount}\n`;
        response += `• Can Respond: ${
          debugInfo.canRespond ? "✅ Yes" : "❌ No"
        }\n`;
        response += `• Would Exceed Limit: ${
          debugInfo.wouldExceedLimit ? "⚠️ Yes" : "✅ No"
        }\n`;
      }

      response += `\n**📚 Conversation History:**\n`;
      response += `• Total Messages: ${debugInfo.historyLength}\n`;

      if (debugInfo.allSelections.length > 0) {
        response += `\n**📋 All Selections:**\n`;
        debugInfo.allSelections.slice(0, 5).forEach((sel, i) => {
          const status = sel.is_complete
            ? "✅ Complete"
            : sel.conversation_count >= debugInfo.maxConversationRounds
            ? "🔧 Needs Fix"
            : "🔄 Active";
          response += `${i + 1}. ID: ${sel.id}, Count: ${
            sel.conversation_count
          }, ${status}\n`;
        });
      }

      // Check for data integrity issues
      const corruptedSelections = debugInfo.allSelections.filter(
        (sel) =>
          sel.conversation_count >= debugInfo.maxConversationRounds &&
          !sel.is_complete
      );

      if (corruptedSelections.length > 0) {
        response += `\n**⚠️ Data Integrity Issues:**\n`;
        response += `• Found ${corruptedSelections.length} corrupted selections (count >= max but not marked complete)\n`;
        response += `• Use \`!debug-fix-user @${mentionedUser.username}\` to fix\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in debug-dm command:", error);
      await message.reply(`❌ Debug failed: ${error.message}`);
    }
  }

  /**
   * NEW: Diagnose and fix corrupted user selections
   * Usage: !debug-fix-user @user
   */
  async handleFixUser(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to fix their selections."
        );
        return;
      }

      console.log(
        `\n🔧 FIXING USER SELECTIONS for ${mentionedUser.username}...`
      );

      const diagnostics = await messageGeneration.diagnoseAndFixUserSelections(
        mentionedUser.id
      );

      let response = `**🔧 User Selection Fix Results for ${mentionedUser.username}:**\n\n`;
      response += `**📊 Diagnostics:**\n`;
      response += `• Total Selections: ${diagnostics.totalSelections}\n`;
      response += `• Incomplete Selections: ${diagnostics.incompleteSelections}\n`;
      response += `• Active (Valid) Selections: ${diagnostics.activeSelections}\n`;
      response += `• Corrupted Selections Found: ${diagnostics.corruptedSelections}\n`;
      response += `• Selections Fixed: ${diagnostics.fixedSelections}\n`;

      if (diagnostics.fixedSelections > 0) {
        response += `\n✅ **Fixed ${diagnostics.fixedSelections} corrupted selections!**\n`;
        response += `The user's conversation limits should now work properly.\n`;
      } else if (diagnostics.corruptedSelections === 0) {
        response += `\n✅ **No corruption found!** User's selections are clean.\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in debug-fix-user command:", error);
      await message.reply(`❌ Fix failed: ${error.message}`);
    }
  }

  /**
   * NEW: Check all users for corrupted selections
   * Usage: !debug-check-all-corrupted
   */
  async handleCheckAllCorrupted(message) {
    try {
      console.log(`\n🔍 CHECKING ALL USERS FOR CORRUPTED SELECTIONS...`);

      const result = await database.executeQuery(
        `
        SELECT user_id, COUNT(*) as corrupted_count
        FROM user_selections 
        WHERE conversation_count >= $1 AND is_complete = FALSE
        GROUP BY user_id
        ORDER BY corrupted_count DESC
      `,
        [config.arg.maxConversationRounds]
      );

      if (result.rows.length === 0) {
        await message.reply(
          "✅ **No corrupted selections found!** All user data is clean."
        );
        return;
      }

      let response = `**⚠️ Found Corrupted Selections:**\n\n`;
      response += `Found ${result.rows.length} users with corrupted selection data:\n\n`;

      for (const row of result.rows.slice(0, 10)) {
        // Show first 10
        response += `• User ID: \`${row.user_id}\` - ${row.corrupted_count} corrupted selections\n`;
      }

      if (result.rows.length > 10) {
        response += `\n... and ${result.rows.length - 10} more users.\n`;
      }

      response += `\n**To fix a specific user:** \`!debug-fix-user @username\`\n`;
      response += `**To fix all at once:** \`!debug-fix-all-corrupted\`\n`;

      await message.reply(response);
    } catch (error) {
      logger.error("Error checking corrupted selections:", error);
      await message.reply(`❌ Check failed: ${error.message}`);
    }
  }

  /**
   * NEW: Clean up multiple selections for a user (keep only most recent)
   * Usage: !debug-cleanup-user @user
   */
  async handleCleanupUser(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to clean up their selections."
        );
        return;
      }

      console.log(
        `\n🧹 CLEANING UP SELECTIONS for ${mentionedUser.username}...`
      );

      // Get all selections for user
      const allSelections = await database.executeQuery(
        "SELECT * FROM user_selections WHERE user_id = $1 ORDER BY selected_at DESC",
        [mentionedUser.id]
      );

      if (allSelections.rows.length === 0) {
        await message.reply(
          `✅ **${mentionedUser.username} has no selections to clean up.**`
        );
        return;
      }

      if (allSelections.rows.length === 1) {
        await message.reply(
          `✅ **${mentionedUser.username} has only 1 selection - no cleanup needed.**`
        );
        return;
      }

      const mostRecentSelection = allSelections.rows[0];
      const oldSelections = allSelections.rows.slice(1);

      let response = `**🧹 Cleanup Results for ${mentionedUser.username}:**\n\n`;
      response += `**Found ${allSelections.rows.length} selections:**\n`;
      response += `• **KEEPING**: ID ${mostRecentSelection.id} (${new Date(
        mostRecentSelection.selected_at
      ).toLocaleString()})\n`;
      response += `  - Count: ${mostRecentSelection.conversation_count}/${config.arg.maxConversationRounds}\n`;
      response += `  - Complete: ${mostRecentSelection.is_complete}\n\n`;

      if (oldSelections.length > 0) {
        response += `**Cleaning up ${oldSelections.length} old selections:**\n`;

        for (const oldSel of oldSelections) {
          response += `• ID ${oldSel.id}: Count ${oldSel.conversation_count}, Complete ${oldSel.is_complete}\n`;
        }

        // Mark old selections as complete
        const oldIds = oldSelections.map((s) => s.id);
        await database.executeQuery(
          "UPDATE user_selections SET is_complete = TRUE WHERE id = ANY($1)",
          [oldIds]
        );

        response += `\n✅ **Marked ${oldSelections.length} old selections as complete!**\n`;
        response += `${mentionedUser.username} now has clean conversation state.\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in cleanup-user command:", error);
      await message.reply(`❌ Cleanup failed: ${error.message}`);
    }
  }

  /**
   * NEW: Show all selections for a user with details
   * Usage: !debug-show-user-selections @user
   */
  async handleShowUserSelections(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to show their selections."
        );
        return;
      }

      const allSelections = await database.executeQuery(
        "SELECT * FROM user_selections WHERE user_id = $1 ORDER BY selected_at DESC",
        [mentionedUser.id]
      );

      if (allSelections.rows.length === 0) {
        await message.reply(
          `📭 **${mentionedUser.username} has no selections in the database.**`
        );
        return;
      }

      let response = `**📋 All Selections for ${mentionedUser.username} (${allSelections.rows.length}):**\n\n`;

      allSelections.rows.forEach((sel, i) => {
        const status = sel.is_complete
          ? "✅ Complete"
          : sel.conversation_count >= config.arg.maxConversationRounds
          ? "🔧 Should be Complete"
          : "🔄 Active";

        const isLatest = i === 0 ? " **(LATEST)**" : "";
        const selectedDate = new Date(sel.selected_at).toLocaleString();
        const lastMessage = sel.last_message_at
          ? new Date(sel.last_message_at).toLocaleString()
          : "Never";

        response += `**${i + 1}. Selection ID ${sel.id}${isLatest}**\n`;
        response += `• Status: ${status}\n`;
        response += `• Count: ${sel.conversation_count}/${config.arg.maxConversationRounds}\n`;
        response += `• Selected: ${selectedDate}\n`;
        response += `• Last Message: ${lastMessage}\n\n`;
      });

      // Check for issues
      const activeSelections = allSelections.rows.filter((s) => !s.is_complete);
      const corruptedSelections = allSelections.rows.filter(
        (s) =>
          !s.is_complete &&
          s.conversation_count >= config.arg.maxConversationRounds
      );

      if (activeSelections.length > 1) {
        response += `⚠️ **Issue**: ${activeSelections.length} active selections found!\n`;
        response += `Use \`!debug-cleanup-user @${mentionedUser.username}\` to fix.\n\n`;
      }

      if (corruptedSelections.length > 0) {
        response += `🔧 **Issue**: ${corruptedSelections.length} corrupted selections found!\n`;
        response += `Use \`!debug-fix-user @${mentionedUser.username}\` to fix.\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error showing user selections:", error);
      await message.reply(`❌ Failed to show selections: ${error.message}`);
    }
  }

  /**
   * Fix all corrupted selections in the database
   * Usage: !debug-fix-all-corrupted
   */
  async handleFixAllCorrupted(message) {
    try {
      console.log(`\n🔧 FIXING ALL CORRUPTED SELECTIONS...`);

      // First, count how many need fixing
      const countResult = await database.executeQuery(
        `
        SELECT COUNT(*) as count
        FROM user_selections 
        WHERE conversation_count >= $1 AND is_complete = FALSE
      `,
        [config.arg.maxConversationRounds]
      );

      const corruptedCount = parseInt(countResult.rows[0].count);

      if (corruptedCount === 0) {
        await message.reply(
          "✅ **No corrupted selections found!** Database is clean."
        );
        return;
      }

      // Fix all corrupted selections
      const fixResult = await database.executeQuery(
        `
        UPDATE user_selections 
        SET is_complete = TRUE
        WHERE conversation_count >= $1 AND is_complete = FALSE
        RETURNING user_id
      `,
        [config.arg.maxConversationRounds]
      );

      const fixedCount = fixResult.rows.length;
      const uniqueUsers = [...new Set(fixResult.rows.map((row) => row.user_id))]
        .length;

      let response = `**🔧 Mass Fix Complete!**\n\n`;
      response += `**Results:**\n`;
      response += `• Corrupted selections found: ${corruptedCount}\n`;
      response += `• Selections fixed: ${fixedCount}\n`;
      response += `• Affected users: ${uniqueUsers}\n`;
      response += `\n✅ **All conversation limits should now work properly!**\n`;

      await message.reply(response);

      console.log(
        `✅ Mass fix complete: ${fixedCount} selections fixed for ${uniqueUsers} users`
      );
    } catch (error) {
      logger.error("Error in mass fix:", error);
      await message.reply(`❌ Mass fix failed: ${error.message}`);
    }
  }

  /**
   * Enhanced conversation summary with limit checking
   * Usage: !debug-conversation-summary @user
   */
  async handleConversationSummary(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to show their conversation summary."
        );
        return;
      }

      const summary = await messageGeneration.getConversationSummary(
        mentionedUser.id
      );

      if (!summary) {
        await message.reply(
          `❌ Could not retrieve conversation summary for ${mentionedUser.username}.`
        );
        return;
      }

      let response = `**💬 Conversation Summary for ${mentionedUser.username}:**\n\n`;

      response += `**📊 Overview:**\n`;
      response += `• Has Active Selection: ${
        summary.hasActiveSelection ? "✅ Yes" : "❌ No"
      }\n`;
      response += `• Current Conversations: ${summary.conversationCount}/${config.arg.maxConversationRounds}\n`;
      response += `• Is Complete: ${summary.isComplete ? "✅ Yes" : "❌ No"}\n`;
      response += `• Total Messages: ${summary.totalMessages}\n`;
      response += `• User Messages: ${summary.userMessages}\n`;
      response += `• Bot Messages: ${summary.botMessages}\n`;

      if (summary.lastActivity) {
        response += `• Last Activity: ${new Date(
          summary.lastActivity
        ).toLocaleString()}\n`;
      }

      response += `\n**🧠 Memory Context:**\n`;
      response += `• Current Cycle Messages: ${summary.currentCycleLength}\n`;

      if (summary.recentMessages.length > 0) {
        response += `\n**📝 Recent Messages:**\n`;
        summary.recentMessages.slice(-3).forEach((msg, i) => {
          const sender = msg.is_user_message
            ? "👤 User"
            : `🤖 Bot (Level ${msg.encoding_level})`;
          const preview =
            msg.message_content.length > 50
              ? msg.message_content.substring(0, 50) + "..."
              : msg.message_content;
          response += `${i + 1}. ${sender}: "${preview}"\n`;
        });
      }

      // Check for potential issues
      const hasActiveButComplete =
        summary.hasActiveSelection && summary.isComplete;
      const hasCountButNoActive =
        summary.conversationCount > 0 && !summary.hasActiveSelection;

      if (hasActiveButComplete || hasCountButNoActive) {
        response += `\n**⚠️ Potential Issues Detected:**\n`;
        if (hasActiveButComplete) {
          response += `• Selection marked as complete but still active\n`;
        }
        if (hasCountButNoActive) {
          response += `• Has conversation count but no active selection\n`;
        }
        response += `Use \`!debug-fix-user @${mentionedUser.username}\` to resolve\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in conversation summary:", error);
      await message.reply(
        `❌ Failed to get conversation summary: ${error.message}`
      );
    }
  }

  /**
   * Test response generation with limit checking
   * Usage: !debug-test-response @user "test message"
   */
  async handleTestResponse(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to test response generation."
        );
        return;
      }

      const testMessage =
        args.slice(2).join(" ") || "Hello, this is a test message.";

      console.log(
        `\n🧪 TESTING RESPONSE GENERATION for ${mentionedUser.username}...`
      );
      console.log(`Test message: "${testMessage}"`);

      try {
        const response =
          await messageGeneration.testMessageGenerationWithMemory(
            mentionedUser.id,
            testMessage
          );

        let replyMessage = `**🧪 Test Response for ${mentionedUser.username}:**\n\n`;
        replyMessage += `**Input:** "${testMessage}"\n\n`;
        replyMessage += `**Generated Response:**\n\`\`\`${response}\`\`\`\n`;
        replyMessage += `**Length:** ${response.length} characters\n`;

        await message.reply(replyMessage);
      } catch (testError) {
        if (testError.message.includes("exceed conversation limit")) {
          await message.reply(
            `⛔ **Cannot test response:** ${testError.message}\n\nThis is the expected behavior - the user has completed their conversation cycle.`
          );
        } else {
          throw testError;
        }
      }
    } catch (error) {
      logger.error("Error in test response:", error);
      await message.reply(`❌ Test failed: ${error.message}`);
    }
  }

  /**
   * Simulate a complete DM conversation with limit checking
   * Usage: !debug-simulate-dm @user "message"
   */
  async handleSimulateDM(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to simulate DM conversation."
        );
        return;
      }

      const testMessage = args.slice(2).join(" ") || "Who are you?";

      // Create mock message object
      const mockMessage = {
        author: {
          id: mentionedUser.id,
          username: mentionedUser.username,
          send: async (content) => {
            console.log(`📨 SIMULATED DM SENT: "${content}"`);
            return { id: "simulated_message_id" };
          },
        },
        content: testMessage,
        channel: { type: 1 }, // DM channel
        reply: async (content) => {
          console.log(`💬 SIMULATED REPLY: "${content}"`);
          return { id: "simulated_reply_id" };
        },
      };

      console.log(
        `\n🎭 SIMULATING DM CONVERSATION with ${mentionedUser.username}...`
      );
      console.log(`Simulated message: "${testMessage}"`);

      // Check user's current state first
      const debugInfo = await messageGeneration.debugDMHandling(
        mentionedUser.id
      );

      let response = `**🎭 DM Simulation for ${mentionedUser.username}:**\n\n`;
      response += `**Pre-simulation State:**\n`;
      response += `• Has Active Selection: ${
        debugInfo.hasActiveSelection ? "✅ Yes" : "❌ No"
      }\n`;

      if (debugInfo.hasActiveSelection) {
        response += `• Current Count: ${debugInfo.conversationCount}/${debugInfo.maxConversationRounds}\n`;
        response += `• Can Respond: ${
          debugInfo.canRespond ? "✅ Yes" : "❌ No"
        }\n`;
      }

      // Process the simulated DM
      try {
        await messageGeneration.handleDMResponse(mockMessage);

        // Check state after processing
        const afterDebugInfo = await messageGeneration.debugDMHandling(
          mentionedUser.id
        );

        response += `\n**✅ Simulation Result: SUCCESS**\n`;
        if (afterDebugInfo.hasActiveSelection) {
          response += `• New Count: ${afterDebugInfo.conversationCount}/${afterDebugInfo.maxConversationRounds}\n`;
          response += `• Is Complete: ${
            afterDebugInfo.isComplete ? "✅ Yes" : "❌ No"
          }\n`;
        } else {
          response += `• Selection completed or no longer active\n`;
        }

        response += `\n*Check console for detailed simulation logs.*`;
      } catch (simError) {
        response += `\n**❌ Simulation Result: FAILED**\n`;
        response += `Error: ${simError.message}\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in simulate DM:", error);
      await message.reply(`❌ Simulation failed: ${error.message}`);
    }
  }

  /**
   * List all selections with detailed status
   * Usage: !debug-selections
   */
  async handleDebugSelections(message) {
    try {
      const result = await database.executeQuery(`
        SELECT user_id, id, conversation_count, is_complete, selected_at, last_message_at
        FROM user_selections 
        ORDER BY selected_at DESC 
        LIMIT 15
      `);

      if (result.rows.length === 0) {
        await message.reply("📭 No user selections found in database.");
        return;
      }

      let response = `**📊 Recent User Selections (${result.rows.length}):**\n\n`;

      for (const selection of result.rows) {
        const status = selection.is_complete
          ? "✅ Complete"
          : selection.conversation_count >= config.arg.maxConversationRounds
          ? "🔧 Corrupted"
          : "🔄 Active";

        const selectedDate = new Date(
          selection.selected_at
        ).toLocaleDateString();
        const lastMessage = selection.last_message_at
          ? new Date(selection.last_message_at).toLocaleDateString()
          : "Never";

        response += `**ID ${selection.id}** - User: \`${selection.user_id}\`\n`;
        response += `• Count: ${selection.conversation_count}/${config.arg.maxConversationRounds} | Status: ${status}\n`;
        response += `• Selected: ${selectedDate} | Last Message: ${lastMessage}\n\n`;
      }

      // Add summary statistics
      const totalActive = result.rows.filter(
        (s) =>
          !s.is_complete &&
          s.conversation_count < config.arg.maxConversationRounds
      ).length;
      const totalComplete = result.rows.filter((s) => s.is_complete).length;
      const totalCorrupted = result.rows.filter(
        (s) =>
          !s.is_complete &&
          s.conversation_count >= config.arg.maxConversationRounds
      ).length;

      response += `**📈 Summary:**\n`;
      response += `• Active: ${totalActive} | Complete: ${totalComplete} | Corrupted: ${totalCorrupted}\n`;

      if (totalCorrupted > 0) {
        response += `\n⚠️ **${totalCorrupted} corrupted selections found!**\n`;
        response += `Use \`!debug-fix-all-corrupted\` to fix them.\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in debug selections:", error);
      await message.reply(`❌ Failed to retrieve selections: ${error.message}`);
    }
  }

  /**
   * Create test selection for a user
   * Usage: !debug-create-selection @user
   */
  async handleCreateTestSelection(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to create a test selection."
        );
        return;
      }

      // Check if user already has an active selection
      const existing = await messageGeneration.getActiveUserSelection(
        mentionedUser.id
      );
      if (existing) {
        await message.reply(
          `❌ ${mentionedUser.username} already has an active selection (ID: ${existing.id}). Use \`!debug-reset-user @${mentionedUser.username}\` first.`
        );
        return;
      }

      // Create test activity data
      const testActivityData = {
        basic: {
          username: mentionedUser.username,
          userId: mentionedUser.id,
        },
        recentActivity: {
          games: [{ name: "Test Game", details: "Debug Mode" }],
          spotify: { song: "Test Song", artist: "Debug Artist" },
        },
        behavioral: {
          currentActiveHour: new Date().getHours(),
          isNightOwl: true,
        },
        timestamp: new Date().toISOString(),
      };

      const insertResult = await database.executeQuery(
        `INSERT INTO user_selections (user_id, guild_id, activity_data, conversation_count, is_complete, selected_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          mentionedUser.id,
          message.guild.id,
          JSON.stringify(testActivityData),
          0,
          false,
          new Date(),
        ]
      );

      const selectionId = insertResult.rows[0].id;

      await message.reply(
        `✅ **Test selection created!**\n\n• User: ${mentionedUser.username}\n• Selection ID: ${selectionId}\n• Initial Count: 0/${config.arg.maxConversationRounds}\n\nThe user can now receive DM responses. Test with \`!debug-simulate-dm @${mentionedUser.username} "test message"\``
      );
    } catch (error) {
      logger.error("Error creating test selection:", error);
      await message.reply(
        `❌ Failed to create test selection: ${error.message}`
      );
    }
  }

  /**
   * Reset user's selection data
   * Usage: !debug-reset-user @user
   */
  async handleResetUser(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to reset their selections."
        );
        return;
      }

      // Get count of selections to be removed
      const countResult = await database.executeQuery(
        "SELECT COUNT(*) as count FROM user_selections WHERE user_id = $1",
        [mentionedUser.id]
      );
      const selectionCount = parseInt(countResult.rows[0].count);

      // Remove all selections for user
      await database.executeQuery(
        "DELETE FROM user_selections WHERE user_id = $1",
        [mentionedUser.id]
      );

      // Remove conversation history
      const historyResult = await database.executeQuery(
        "DELETE FROM conversation_logs WHERE user_id = $1 RETURNING id",
        [mentionedUser.id]
      );
      const historyCount = historyResult.rows.length;

      await message.reply(
        `✅ **User reset complete!**\n\n• User: ${mentionedUser.username}\n• Selections removed: ${selectionCount}\n• Conversation history cleared: ${historyCount} messages\n\nThe user is now ready for a fresh start.`
      );
    } catch (error) {
      logger.error("Error resetting user:", error);
      await message.reply(`❌ Failed to reset user: ${error.message}`);
    }
  }

  /**
   * Clear conversation history for a user
   * Usage: !debug-clear-history @user
   */
  async handleClearHistory(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to clear their conversation history."
        );
        return;
      }

      const result = await database.executeQuery(
        "DELETE FROM conversation_logs WHERE user_id = $1 RETURNING id",
        [mentionedUser.id]
      );

      const clearedCount = result.rows.length;

      await message.reply(
        `✅ **Conversation history cleared!**\n\n• User: ${mentionedUser.username}\n• Messages removed: ${clearedCount}\n\nThe user's conversation memory has been reset.`
      );
    } catch (error) {
      logger.error("Error clearing history:", error);
      await message.reply(`❌ Failed to clear history: ${error.message}`);
    }
  }

  /**
   * Show detailed conversation history with encoding levels
   * Usage: !debug-conversations @user [limit]
   */
  async handleDebugConversations(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to show their conversation history."
        );
        return;
      }

      const limit = parseInt(args[2]) || 10;
      const conversations = await messageGeneration.getConversationHistory(
        mentionedUser.id,
        limit
      );

      if (conversations.length === 0) {
        await message.reply(
          `📭 No conversation history found for ${mentionedUser.username}.`
        );
        return;
      }

      let response = `**💬 Conversation History for ${mentionedUser.username} (${conversations.length}):**\n\n`;

      conversations.forEach((conv, index) => {
        const sender = conv.is_user_message
          ? "👤 User"
          : `🤖 Bot (Level ${conv.encoding_level})`;
        const timestamp = new Date(conv.created_at).toLocaleString();
        const preview =
          conv.message_content.length > 100
            ? conv.message_content.substring(0, 100) + "..."
            : conv.message_content;

        response += `**${index + 1}.** ${sender} - *${timestamp}*\n`;
        response += `\`\`\`${preview}\`\`\`\n`;
      });

      await message.reply(response);
    } catch (error) {
      logger.error("Error in debug conversations:", error);
      await message.reply(
        `❌ Failed to retrieve conversations: ${error.message}`
      );
    }
  }
}

// Export singleton instance
module.exports = new DebugCommands();
