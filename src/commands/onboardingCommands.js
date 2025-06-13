// ========================================
// FILE: src/commands/onboardingCommands.js
// PURPOSE: Complete admin commands for ARG onboarding system management - FINAL VERSION
// ========================================

const database = require("../config/database");
const logger = require("../utils/logger");
const onboardingSystem = require("../services/onboardingSystem");

/**
 * Complete admin commands for ARG onboarding system management
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

      if (sessionStats.last_session) {
        response += `• Last Session: ${new Date(
          sessionStats.last_session
        ).toLocaleDateString()}\n`;
      }

      response += `\n**💡 Quick Actions:**\n`;
      response += `• \`!incomplete-onboarding\` - See stalled sessions\n`;
      response += `• \`!failed-dm-onboarding\` - See DM delivery issues\n`;
      response += `• \`!recent-onboarding 10\` - See recent activity`;

      await message.reply(response);
    } catch (error) {
      logger.error("Error in onboarding-stats command:", error);
      await message.reply("❌ Failed to retrieve onboarding statistics.");
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
        SELECT 
          user_id,
          current_question,
          started_at,
          dm_failed
        FROM onboarding_sessions 
        WHERE guild_id = $1 AND completed = FALSE
        ORDER BY started_at DESC
        LIMIT 15
      `,
        [message.guild.id]
      );

      if (result.rows.length === 0) {
        await message.reply("✅ No incomplete onboarding sessions found!");
        return;
      }

      let response = `**🔄 Incomplete Onboarding Sessions (${result.rows.length}):**\n\n`;

      for (const session of result.rows) {
        try {
          const member = await message.guild.members.fetch(session.user_id);
          const memberName = member ? member.user.username : "Unknown User";
          const startedDate = new Date(session.started_at).toLocaleDateString();
          const dmStatus = session.dm_failed ? "❌ DM Failed" : "✅ DM Sent";

          response += `**${memberName}** (\`${session.user_id}\`)\n`;
          response += `• Progress: Question ${session.current_question}/9\n`;
          response += `• Started: ${startedDate}\n`;
          response += `• Status: ${dmStatus}\n`;
          response += `• Action: \`!force-onboarding @${memberName}\`\n\n`;
        } catch (fetchError) {
          response += `**Unknown User** (\`${session.user_id}\`)\n`;
          response += `• Progress: Question ${session.current_question}/9\n`;
          response += `• Status: Member may have left\n\n`;
        }
      }

      response += `**💡 Tip:** Use \`!reset-onboarding @user\` to restart a stalled session.`;

      await message.reply(response);
    } catch (error) {
      logger.error("Error in incomplete-onboarding command:", error);
      await message.reply(
        "❌ Failed to retrieve incomplete onboarding sessions."
      );
    }
  }

  /**
   * Shows members who couldn't receive onboarding DMs
   * Usage: !failed-dm-onboarding
   */
  async handleFailedDMOnboarding(message, args) {
    try {
      const result = await database.executeQuery(
        `
        SELECT 
          user_id,
          started_at,
          dm_failed_at,
          completed
        FROM onboarding_sessions 
        WHERE guild_id = $1 AND (dm_failed = TRUE OR dm_failed_at IS NOT NULL)
        ORDER BY started_at DESC
        LIMIT 20
      `,
        [message.guild.id]
      );

      if (result.rows.length === 0) {
        await message.reply("✅ No failed DM deliveries found!");
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

      const result = await database.executeQuery(
        `
        SELECT * FROM onboarding_sessions 
        WHERE user_id = $1 AND guild_id = $2 
        ORDER BY started_at DESC 
        LIMIT 1
      `,
        [mentionedUser.id, message.guild.id]
      );

      if (result.rows.length === 0) {
        await message.reply(
          `📭 No onboarding sessions found for ${mentionedUser.username}.`
        );
        return;
      }

      const session = result.rows[0];
      let response = `**🔍 Onboarding Details for ${mentionedUser.username}:**\n\n`;

      response += `**📊 Session Status:**\n`;
      response += `• Progress: ${session.current_question}/9 questions\n`;
      response += `• Completed: ${session.completed ? "✅ Yes" : "❌ No"}\n`;
      response += `• Observer: ${session.is_observer ? "🔍 Yes" : "🎭 No"}\n`;
      response += `• DM Failed: ${session.dm_failed ? "❌ Yes" : "✅ No"}\n`;
      response += `• Started: ${new Date(
        session.started_at
      ).toLocaleDateString()}\n`;

      if (session.completed) {
        response += `• Completed: ${new Date(
          session.completed_at
        ).toLocaleDateString()}\n`;
        response += `• Generated Name: **\`${session.generated_nickname}\`**\n`;
      }

      // Parse and display psychological profile
      if (session.personality_scores && session.completed) {
        try {
          const scores = JSON.parse(session.personality_scores);
          const dominantTrait =
            Object.keys(scores).length > 0
              ? Object.keys(scores).reduce((a, b) =>
                  (scores[a] || 0) > (scores[b] || 0) ? a : b
                )
              : "unknown";

          response += `\n**🧠 Psychological Profile:**\n`;
          response += `• Seeker: ${scores.seeker || 0} | Isolated: ${
            scores.isolated || 0
          }\n`;
          response += `• Aware: ${scores.aware || 0} | Lost: ${
            scores.lost || 0
          }\n`;
          response += `• **Dominant Trait:** ${this.getTraitDescription(
            dominantTrait
          )}\n`;
        } catch (e) {
          response += `\n**🧠 Psychological Profile:** *Error parsing data*\n`;
        }
      }

      // Parse and display responses
      if (session.responses && session.completed) {
        try {
          const responses = JSON.parse(session.responses);
          if (responses.length > 0) {
            response += `\n**📝 Response Summary:**\n`;
            const yesCount = responses.filter((r) => r.answer === "yes").length;
            const maybeCount = responses.filter(
              (r) => r.answer === "maybe"
            ).length;
            const noCount = responses.filter((r) => r.answer === "no").length;

            response += `• Yes: ${yesCount} | Sometimes: ${maybeCount} | No: ${noCount}\n`;
          }
        } catch (e) {
          // Skip response details if parsing fails
        }
      }

      // Show Observer response if available
      if (session.observer_response) {
        response += `\n**🔍 Observer Response:**\n`;
        response += `• Favorite Color: "${session.observer_response}"\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in user-onboarding command:", error);
      await message.reply("❌ Failed to retrieve user onboarding details.");
    }
  }

  /**
   * Forces onboarding to start for a user (admin override)
   * Usage: !force-onboarding @user
   */
  async handleForceOnboarding(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply("❌ Please mention a user to force onboarding.");
        return;
      }

      // Check if user already has an active session
      const existingSession = await database.executeQuery(
        `
        SELECT id, completed 
        FROM onboarding_sessions 
        WHERE user_id = $1 AND guild_id = $2 
        ORDER BY started_at DESC 
        LIMIT 1
      `,
        [mentionedUser.id, message.guild.id]
      );

      if (
        existingSession.rows.length > 0 &&
        !existingSession.rows[0].completed
      ) {
        await message.reply(
          `⚠️ ${mentionedUser.username} already has an active onboarding session. Use \`!reset-onboarding @${mentionedUser.username}\` to restart it.`
        );
        return;
      }

      // Get guild member object
      const member = await message.guild.members.fetch(mentionedUser.id);
      if (!member) {
        await message.reply("❌ User not found in this server.");
        return;
      }

      // Force start onboarding
      const success = await onboardingSystem.initiateOnboarding(member);

      if (success) {
        await message.reply(
          `✅ **Forced onboarding started for ${mentionedUser.username}!**\n\nThe user should receive a DM with the psychological assessment. If they don't receive it, their DMs may be disabled.`
        );
      } else {
        await message.reply(
          `⚠️ **Onboarding started but DM failed for ${mentionedUser.username}!**\n\nThe user likely has DMs disabled. They need to:\n1. Enable "Allow direct messages from server members"\n2. Try the assessment again`
        );
      }
    } catch (error) {
      logger.error("Error in force-onboarding command:", error);
      await message.reply(`❌ Failed to force onboarding: ${error.message}`);
    }
  }

  /**
   * Resets a user's onboarding session
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

      // Delete existing sessions
      const deleteResult = await database.executeQuery(
        `
        DELETE FROM onboarding_sessions 
        WHERE user_id = $1 AND guild_id = $2
        RETURNING id
      `,
        [mentionedUser.id, message.guild.id]
      );

      const sessionCount = deleteResult.rows.length;

      if (sessionCount === 0) {
        await message.reply(
          `📭 No onboarding sessions found for ${mentionedUser.username}.`
        );
        return;
      }

      await message.reply(
        `✅ **Reset complete for ${mentionedUser.username}!**\n\n• Removed ${sessionCount} session(s)\n• User can now start fresh onboarding\n\nUse \`!force-onboarding @${mentionedUser.username}\` to restart their assessment.`
      );
    } catch (error) {
      logger.error("Error in reset-onboarding command:", error);
      await message.reply(`❌ Failed to reset onboarding: ${error.message}`);
    }
  }

  /**
   * Tests if a nickname is unique in the guild
   * Usage: !test-nickname-unique "nickname"
   */
  async handleTestNicknameUnique(message, args) {
    try {
      const nickname = args.slice(1).join(" ").replace(/['"]/g, "");

      if (!nickname) {
        await message.reply(
          '❌ Please provide a nickname to test.\n\nUsage: `!test-nickname-unique "SUBJ-A1-SEEING-░"`'
        );
        return;
      }

      // Check if nickname exists in current guild
      const guild = message.guild;
      const existingMember = guild.members.cache.find(
        (member) => member.nickname === nickname
      );

      // Check if nickname exists in onboarding database
      const dbResult = await database.executeQuery(
        "SELECT user_id FROM onboarding_sessions WHERE generated_nickname = $1 AND guild_id = $2",
        [nickname, guild.id]
      );

      let response = `**🔍 Nickname Uniqueness Test:**\n\n`;
      response += `**Tested Nickname:** \`${nickname}\`\n\n`;

      if (existingMember) {
        response += `❌ **Already in use by:** ${existingMember.user.username}\n`;
        response += `• User ID: \`${existingMember.user.id}\`\n`;
        response += `• Status: Currently active\n`;
      } else if (dbResult.rows.length > 0) {
        response += `⚠️ **Found in database but not active**\n`;
        response += `• User ID: \`${dbResult.rows[0].user_id}\`\n`;
        response += `• Status: Previously assigned (user may have left)\n`;
      } else {
        response += `✅ **Unique and available**\n`;
        response += `• Status: This nickname can be safely used\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in test-nickname-unique command:", error);
      await message.reply("❌ Failed to test nickname uniqueness.");
    }
  }

  /**
   * Gets trait description for display
   * @param {string} trait - Trait name
   * @returns {string} Trait description
   */
  getTraitDescription(trait) {
    const descriptions = {
      seeker: "Truth Seeker - Drawn to patterns and hidden meanings",
      isolated: "The Isolated - Disconnected from the ordinary world",
      aware: "The Aware - Conscious of forces others cannot see",
      lost: "The Lost - Searching for purpose and direction",
    };

    return descriptions[trait] || "Unknown Classification";
  }
}

module.exports = new OnboardingCommands();
