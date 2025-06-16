// ========================================
// FILE: src/commands/onboardingCommands.js
// PURPOSE: Complete admin commands for ARG onboarding system management - FIXED VERSION
// ========================================

const database = require("../config/database");
const logger = require("../utils/logger");
const onboardingSystem = require("../services/onboardingSystem");

/**
 * Complete admin commands for ARG onboarding system management with duplicate prevention
 */
class OnboardingCommands {
  /**
   * Shows onboarding system statistics
   * Usage: !onboarding-stats
   */
  async handleOnboardingStats(message) {
    try {
      const stats = await database.executeQuery(
        `
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN completed = TRUE THEN 1 END) as completed_sessions,
          COUNT(CASE WHEN completed = FALSE THEN 1 END) as incomplete_sessions,
          COUNT(CASE WHEN dm_failed = TRUE THEN 1 END) as dm_failed_sessions,
          COUNT(CASE WHEN is_observer = TRUE THEN 1 END) as observer_sessions,
          AVG(CASE WHEN completed = TRUE THEN current_question END) as avg_questions_completed,
          MAX(started_at) as last_session,
          COUNT(DISTINCT generated_nickname) as unique_nicknames_generated
        FROM onboarding_sessions
        WHERE guild_id = $1
      `,
        [message.guild.id]
      );

      const sessionStats = stats.rows[0];

      let response = `**🔮 ARG Onboarding System Statistics:**\n\n`;

      response += `**📊 Session Overview:**\n`;
      response += `• Total Sessions: ${sessionStats.total_sessions}\n`;
      response += `• Completed: ${sessionStats.completed_sessions}\n`;
      response += `• In Progress: ${sessionStats.incomplete_sessions}\n`;
      response += `• DM Failures: ${sessionStats.dm_failed_sessions || 0}\n`;
      response += `• Observer Detections: ${
        sessionStats.observer_sessions || 0
      }\n`;
      response += `• Completion Rate: ${
        sessionStats.total_sessions > 0
          ? Math.round(
              (sessionStats.completed_sessions / sessionStats.total_sessions) *
                100
            )
          : 0
      }%\n\n`;

      response += `**🎯 Assessment Details:**\n`;
      response += `• Unique Nicknames: ${sessionStats.unique_nicknames_generated}\n`;
      response += `• Avg Questions Answered: ${
        sessionStats.avg_questions_completed
          ? Math.round(sessionStats.avg_questions_completed * 10) / 10
          : 0
      }/9\n`;
      response += `• Observer Detection Rate: ${
        sessionStats.completed_sessions > 0
          ? Math.round(
              (sessionStats.observer_sessions /
                sessionStats.completed_sessions) *
                100
            )
          : 0
      }%\n\n`;

      response += `**📅 Activity:**\n`;
      response += `• Last Session: ${
        sessionStats.last_session
          ? new Date(sessionStats.last_session).toLocaleString()
          : "Never"
      }\n\n`;

      response += `**🔧 Admin Commands:**\n`;
      response += `• \`!recent-onboarding [limit]\` - Recent sessions\n`;
      response += `• \`!failed-dm-onboarding\` - Show DM failures\n`;
      response += `• \`!force-onboarding @user\` - Force start assessment\n`;
      response += `• \`!reset-onboarding @user\` - Reset user session`;

      await message.reply(response);
    } catch (error) {
      logger.error("Error in onboarding-stats command:", error);
      await message.reply("❌ Failed to retrieve onboarding statistics.");
    }
  }

  /**
   * Shows sessions where DM delivery failed
   * Usage: !failed-dm-onboarding
   */
  async handleFailedDMOnboarding(message) {
    try {
      const result = await database.executeQuery(
        `
        SELECT user_id, started_at, completed, dm_failed_at 
        FROM onboarding_sessions 
        WHERE guild_id = $1 AND dm_failed = TRUE 
        ORDER BY dm_failed_at DESC 
        LIMIT 20
      `,
        [message.guild.id]
      );

      if (result.rows.length === 0) {
        await message.reply(
          "✅ No failed DM onboarding sessions found. All users successfully received their assessment DMs."
        );
        return;
      }

      let response = `**📪 Failed DM Onboarding (${result.rows.length}):**\n\n`;

      for (const session of result.rows) {
        try {
          const member = await message.guild.members.fetch(session.user_id);
          const memberName = member ? member.user.username : "Unknown User";
          const status = session.completed
            ? "✅ Later Completed"
            : "❌ Still Pending";
          const failedDate = session.dm_failed_at
            ? new Date(session.dm_failed_at).toLocaleDateString()
            : "Unknown";

          response += `**${memberName}** (\`${session.user_id}\`)\n`;
          response += `• Status: ${status}\n`;
          response += `• DM Failed: ${failedDate}\n`;
          response += `• Fix: \`!force-onboarding @${memberName}\`\n\n`;
        } catch (fetchError) {
          response += `**Unknown User** (\`${session.user_id}\`)\n`;
          response += `• Status: Member may have left\n`;
          response += `• DM Failed: ${
            session.dm_failed_at
              ? new Date(session.dm_failed_at).toLocaleDateString()
              : "Unknown"
          }\n\n`;
        }
      }

      response += `**💡 Tip:** Users with DMs disabled need to:\n`;
      response += `1. Enable "Allow direct messages from server members"\n`;
      response += `2. Have an admin run \`!force-onboarding @username\``;

      await message.reply(response);
    } catch (error) {
      logger.error("Error in failed-dm-onboarding command:", error);
      await message.reply("❌ Failed to retrieve failed DM sessions.");
    }
  }

  /**
   * Shows recent onboarding sessions
   * Usage: !recent-onboarding [limit]
   */
  async handleRecentOnboarding(message, args) {
    try {
      const limit = parseInt(args[1]) || 10;

      const result = await database.executeQuery(
        `
        SELECT 
          user_id,
          current_question,
          completed,
          generated_nickname,
          is_observer,
          started_at,
          completed_at
        FROM onboarding_sessions 
        WHERE guild_id = $1 
        ORDER BY started_at DESC 
        LIMIT $2
      `,
        [message.guild.id, limit]
      );

      if (result.rows.length === 0) {
        await message.reply("📭 No onboarding sessions found for this server.");
        return;
      }

      let response = `**📋 Recent Onboarding Sessions (${result.rows.length}):**\n\n`;

      for (const session of result.rows) {
        const status = session.completed
          ? "✅ Complete"
          : `🔄 Question ${session.current_question}/9`;
        const startedDate = new Date(session.started_at).toLocaleDateString();
        const userType = session.is_observer ? "🔍 Observer" : "🎭 Regular";

        response += `**User:** \`${session.user_id}\`\n`;
        response += `• Status: ${status}\n`;
        response += `• Type: ${userType}\n`;
        response += `• Started: ${startedDate}\n`;

        if (session.completed && session.generated_nickname) {
          response += `• Generated Name: **\`${session.generated_nickname}\`**\n`;
          if (session.completed_at) {
            response += `• Completed: ${new Date(
              session.completed_at
            ).toLocaleDateString()}\n`;
          }
        }

        response += `\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in recent-onboarding command:", error);
      await message.reply("❌ Failed to retrieve recent onboarding sessions.");
    }
  }

  /**
   * Shows detailed onboarding info for a specific user
   * Usage: !user-onboarding @user
   */
  async handleUserOnboarding(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to check their onboarding status."
        );
        return;
      }

      const sessions = await database.executeQuery(
        `
        SELECT id, completed, started_at, completed_at, current_question, 
               personality_scores, is_observer, responses
        FROM onboarding_sessions 
        WHERE user_id = $1 AND guild_id = $2
        ORDER BY started_at DESC
        LIMIT 5
      `,
        [mentionedUser.id, message.guild.id]
      );

      if (sessions.rows.length === 0) {
        await message.reply(
          `📭 **No onboarding history for ${mentionedUser.username}**\n\n` +
            `Use \`!force-onboarding @${mentionedUser.username}\` to start their assessment.`
        );
        return;
      }

      let statusMessage = `📊 **Onboarding Status for ${mentionedUser.username}**\n\n`;

      sessions.rows.forEach((session, index) => {
        const isLatest = index === 0;
        const responses = JSON.parse(session.responses || "[]");

        statusMessage += `${isLatest ? "🔵" : "⚪"} **Session ${session.id}** ${
          isLatest ? "(Latest)" : ""
        }\n`;
        statusMessage += `   📅 Started: ${new Date(
          session.started_at
        ).toLocaleString()}\n`;
        statusMessage += `   ✅ Status: ${
          session.completed ? "Completed" : "In Progress"
        }\n`;
        statusMessage += `   📊 Progress: ${session.current_question}/9 questions\n`;

        if (session.completed) {
          statusMessage += `   🎯 Completed: ${new Date(
            session.completed_at
          ).toLocaleString()}\n`;
          statusMessage += `   👁️ Observer: ${
            session.is_observer ? "Yes" : "No"
          }\n`;
        } else {
          statusMessage += `   ⏱️ Last Activity: ${
            responses.length > 0
              ? new Date(
                  responses[responses.length - 1].timestamp
                ).toLocaleString()
              : "No responses yet"
          }\n`;
        }

        statusMessage += "\n";
      });

      const latestSession = sessions.rows[0];
      if (!latestSession.completed) {
        statusMessage += `**🔧 Actions Available:**\n`;
        statusMessage += `• \`!reset-onboarding @${mentionedUser.username}\` - Start over\n`;
        statusMessage += `• Contact user to check their DMs for the assessment`;
      }

      await message.reply(statusMessage);
    } catch (error) {
      logger.error("Error checking user onboarding:", error);
      await message.reply(
        `❌ Failed to check onboarding status: ${error.message}`
      );
    }
  }

  /**
   * FIXED: Forces onboarding to start for a user (admin override) - Prevents duplicates
   * Usage: !force-onboarding @user
   */
  async handleForceOnboarding(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply("❌ Please mention a user to force onboarding.");
        return;
      }

      // FIXED: More thorough check for existing sessions (without dm_sent column)
      const existingSession = await database.executeQuery(
        `
        SELECT id, completed, started_at, current_question
        FROM onboarding_sessions 
        WHERE user_id = $1 AND guild_id = $2 
        ORDER BY started_at DESC 
        LIMIT 1
      `,
        [mentionedUser.id, message.guild.id]
      );

      // FIXED: Handle existing sessions properly
      if (existingSession.rows.length > 0) {
        const session = existingSession.rows[0];

        if (!session.completed) {
          // There's an active session
          await message.reply(
            `⚠️ **${mentionedUser.username} already has an active onboarding session!**\n\n` +
              `📊 Progress: Question ${session.current_question}/9\n` +
              `📅 Started: ${new Date(
                session.started_at
              ).toLocaleString()}\n\n` +
              `**Options:**\n` +
              `• Use \`!reset-onboarding @${mentionedUser.username}\` to restart\n` +
              `• Use \`!user-onboarding @${mentionedUser.username}\` to check details`
          );
          return;
        } else {
          // Session is completed
          await message.reply(
            `✅ **${mentionedUser.username} has already completed onboarding!**\n\n` +
              `📅 Completed: ${new Date(
                session.started_at
              ).toLocaleString()}\n\n` +
              `Use \`!reset-onboarding @${mentionedUser.username}\` if you want them to retake it.`
          );
          return;
        }
      }

      // Get guild member object
      const member = await message.guild.members.fetch(mentionedUser.id);
      if (!member) {
        await message.reply("❌ User not found in this server.");
        return;
      }

      // FIXED: Use the forced flag to prevent duplicates
      logger.info(`🚀 Force-starting onboarding for ${mentionedUser.username}`);

      const success = await onboardingSystem.initiateOnboarding(member, true); // Force flag = true

      if (success) {
        await message.reply(
          `✅ **Forced onboarding started for ${mentionedUser.username}!**\n\n` +
            `📨 Assessment DM sent successfully\n` +
            `🔮 Enhanced 9-question assessment with Observer detection\n` +
            `📊 Progress can be tracked with \`!user-onboarding @${mentionedUser.username}\``
        );

        logger.argEvent(
          "force-onboarding-success",
          `Successfully force-started onboarding for ${mentionedUser.username}`
        );
      } else {
        await message.reply(
          `⚠️ **Onboarding session created but DM failed for ${mentionedUser.username}!**\n\n` +
            `❌ The user likely has DMs disabled\n\n` +
            `**User needs to:**\n` +
            `1. Enable "Allow direct messages from server members" in Privacy Settings\n` +
            `2. Use \`!reset-onboarding @${mentionedUser.username}\` to try again\n\n` +
            `**Alternative:** Check session status with \`!user-onboarding @${mentionedUser.username}\``
        );

        logger.argEvent(
          "force-onboarding-dm-failed",
          `Force onboarding created session but DM failed for ${mentionedUser.username}`
        );
      }
    } catch (error) {
      logger.error("Error in force-onboarding command:", error);

      // FIXED: Better error reporting
      if (error.message.includes("duplicate key")) {
        await message.reply(
          `❌ **Duplicate session detected for ${mentionedUser.username}!**\n\n` +
            `This usually means there's already an active session.\n` +
            `Use \`!reset-onboarding @${mentionedUser.username}\` first, then try again.`
        );
      } else {
        await message.reply(
          `❌ **Failed to force onboarding:** ${error.message}\n\n` +
            `Please try:\n` +
            `1. \`!reset-onboarding @${mentionedUser.username}\`\n` +
            `2. \`!force-onboarding @${mentionedUser.username}\` (retry)`
        );
      }
    }
  }

  /**
   * FIXED: Enhanced reset onboarding with better cleanup
   * Usage: !reset-onboarding @user
   */
  async handleResetOnboarding(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to reset their onboarding."
        );
        return;
      }

      // FIXED: Get session details first for better reporting
      const existingSessions = await database.executeQuery(
        `
        SELECT id, completed, started_at, current_question
        FROM onboarding_sessions 
        WHERE user_id = $1 AND guild_id = $2
        ORDER BY started_at DESC
      `,
        [mentionedUser.id, message.guild.id]
      );

      if (existingSessions.rows.length === 0) {
        await message.reply(
          `📭 **No onboarding sessions found for ${mentionedUser.username}.**\n\n` +
            `You can directly use \`!force-onboarding @${mentionedUser.username}\` to start fresh.`
        );
        return;
      }

      // Delete all sessions for this user
      const deleteResult = await database.executeQuery(
        `
        DELETE FROM onboarding_sessions 
        WHERE user_id = $1 AND guild_id = $2
        RETURNING id, completed
      `,
        [mentionedUser.id, message.guild.id]
      );

      const deletedCount = deleteResult.rows.length;
      const completedCount = deleteResult.rows.filter(
        (s) => s.completed
      ).length;
      const activeCount = deletedCount - completedCount;

      await message.reply(
        `✅ **Reset complete for ${mentionedUser.username}!**\n\n` +
          `🗑️ Deleted ${deletedCount} session(s):\n` +
          `   • ${completedCount} completed\n` +
          `   • ${activeCount} active/incomplete\n\n` +
          `🚀 Ready for fresh onboarding with \`!force-onboarding @${mentionedUser.username}\``
      );

      logger.argEvent(
        "reset-onboarding-success",
        `Reset ${deletedCount} sessions for ${mentionedUser.username} (${completedCount} completed, ${activeCount} active)`
      );
    } catch (error) {
      logger.error("Error in reset-onboarding command:", error);
      await message.reply(
        `❌ **Failed to reset onboarding:** ${error.message}\n\n` +
          `Please contact an administrator if this persists.`
      );
    }
  }

  /**
   * Shows incomplete onboarding sessions
   * Usage: !incomplete-onboarding
   */
  async handleIncompleteOnboarding(message) {
    try {
      const result = await database.executeQuery(
        `
        SELECT user_id, current_question, started_at, dm_failed
        FROM onboarding_sessions 
        WHERE guild_id = $1 AND completed = FALSE 
        ORDER BY started_at DESC 
        LIMIT 20
      `,
        [message.guild.id]
      );

      if (result.rows.length === 0) {
        await message.reply(
          "✅ No incomplete onboarding sessions found. All started assessments have been completed!"
        );
        return;
      }

      let response = `**🔄 Incomplete Onboarding Sessions (${result.rows.length}):**\n\n`;

      for (const session of result.rows) {
        try {
          const member = await message.guild.members.fetch(session.user_id);
          const memberName = member ? member.user.username : "Unknown User";
          const startedDate = new Date(session.started_at).toLocaleDateString();
          const dmStatus = session.dm_failed ? "❌ Failed" : "✅ Sent";

          response += `**${memberName}** (\`${session.user_id}\`)\n`;
          response += `• Progress: Question ${session.current_question}/9\n`;
          response += `• Started: ${startedDate}\n`;
          response += `• DM Status: ${dmStatus}\n`;
          response += `• Action: \`!user-onboarding @${memberName}\`\n\n`;
        } catch (fetchError) {
          response += `**Unknown User** (\`${session.user_id}\`)\n`;
          response += `• Progress: Question ${session.current_question}/9\n`;
          response += `• Status: Member may have left server\n\n`;
        }
      }

      response += `**💡 Tips:**\n`;
      response += `• Use \`!user-onboarding @username\` for detailed status\n`;
      response += `• Use \`!reset-onboarding @username\` to restart stalled sessions\n`;
      response += `• Users with DM failures need to enable DMs and get re-invited`;

      await message.reply(response);
    } catch (error) {
      logger.error("Error in incomplete-onboarding command:", error);
      await message.reply("❌ Failed to retrieve incomplete sessions.");
    }
  }

  /**
   * Tests if a nickname is unique in the system
   * Usage: !test-nickname-unique "nickname"
   */
  async handleTestNicknameUnique(message, args) {
    try {
      const nickname = args.slice(1).join(" ").replace(/["']/g, "");

      if (!nickname) {
        await message.reply(
          '❌ Please provide a nickname to test. Usage: `!test-nickname-unique "TestName"`'
        );
        return;
      }

      // Check in onboarding sessions
      const onboardingCheck = await database.executeQuery(
        "SELECT user_id, generated_nickname FROM onboarding_sessions WHERE generated_nickname = $1",
        [nickname]
      );

      // Check in ARG name assignments
      const argCheck = await database.executeQuery(
        "SELECT user_id, assigned_name FROM arg_name_assignments WHERE assigned_name = $1",
        [nickname]
      );

      const isUnique =
        onboardingCheck.rows.length === 0 && argCheck.rows.length === 0;

      let response = `**🔍 Nickname Uniqueness Test: "${nickname}"**\n\n`;

      if (isUnique) {
        response += `✅ **UNIQUE** - This nickname is available for use\n\n`;
        response += `• Not found in onboarding sessions\n`;
        response += `• Not found in ARG name assignments\n`;
        response += `• Safe to assign to new users`;
      } else {
        response += `❌ **NOT UNIQUE** - This nickname is already in use\n\n`;

        if (onboardingCheck.rows.length > 0) {
          response += `**Found in Onboarding Sessions:**\n`;
          onboardingCheck.rows.forEach((row) => {
            response += `• User ID: \`${row.user_id}\`\n`;
          });
          response += `\n`;
        }

        if (argCheck.rows.length > 0) {
          response += `**Found in ARG Name Assignments:**\n`;
          argCheck.rows.forEach((row) => {
            response += `• User ID: \`${row.user_id}\`\n`;
          });
        }
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in test-nickname-unique command:", error);
      await message.reply("❌ Failed to test nickname uniqueness.");
    }
  }
}

// Export singleton instance
module.exports = new OnboardingCommands();
