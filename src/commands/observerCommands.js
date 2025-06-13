// ========================================
// FILE: src/commands/observerCommands.js
// PURPOSE: Admin commands for Observer system management
// ========================================

const database = require("../config/database");
const logger = require("../utils/logger");

/**
 * Admin commands for Observer system management
 */
class ObserverCommands {
  /**
   * Shows Observer system statistics
   * Usage: !observer-stats
   */
  async handleObserverStats(message) {
    try {
      const stats = await database.executeQuery(
        `
        SELECT 
          COUNT(*) as total_observers,
          COUNT(DISTINCT user_id) as unique_observers,
          MAX(assigned_at) as last_assignment,
          COUNT(CASE WHEN observer_name LIKE 'Observer-%' THEN 1 END) as formatted_names,
          COUNT(CASE WHEN color_response = 'observer' THEN 1 END) as exact_observer_responses,
          COUNT(CASE WHEN color_response != 'observer' THEN 1 END) as custom_observer_responses
        FROM observer_assignments
        WHERE guild_id = $1
      `,
        [message.guild.id]
      );

      const observerStats = stats.rows[0];

      // Get onboarding comparison
      const onboardingStats = await database.executeQuery(
        `
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN is_observer = TRUE THEN 1 END) as observer_sessions,
          COUNT(CASE WHEN is_observer = FALSE THEN 1 END) as regular_sessions
        FROM onboarding_sessions
        WHERE guild_id = $1 AND completed = TRUE
      `,
        [message.guild.id]
      );

      const sessionStats = onboardingStats.rows[0];

      let response = `**🔍 Observer System Statistics:**\n\n`;

      response += `**📊 Observer Overview:**\n`;
      response += `• Total Observers: ${observerStats.total_observers}\n`;
      response += `• Unique Users: ${observerStats.unique_observers}\n`;
      response += `• Exact "Observer" Responses: ${observerStats.exact_observer_responses}\n`;
      response += `• Custom Observer Names: ${observerStats.custom_observer_responses}\n`;

      if (observerStats.last_assignment) {
        response += `• Last Assignment: ${new Date(
          observerStats.last_assignment
        ).toLocaleString()}\n`;
      }

      response += `\n**📊 Onboarding Comparison:**\n`;
      response += `• Total Completed Sessions: ${sessionStats.total_sessions}\n`;
      response += `• Observer Sessions: ${sessionStats.observer_sessions}\n`;
      response += `• Regular ARG Sessions: ${sessionStats.regular_sessions}\n`;

      if (sessionStats.total_sessions > 0) {
        const observerRate = (
          (sessionStats.observer_sessions / sessionStats.total_sessions) *
          100
        ).toFixed(1);
        response += `• Observer Detection Rate: ${observerRate}%\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in observer-stats command:", error);
      await message.reply("❌ Failed to retrieve Observer statistics.");
    }
  }

  /**
   * Shows recent Observer assignments
   * Usage: !recent-observers [limit]
   */
  async handleRecentObservers(message, args) {
    try {
      const limit = parseInt(args[1]) || 10;

      const result = await database.executeQuery(
        `
        SELECT 
          oa.user_id,
          oa.observer_name,
          oa.color_response,
          oa.assigned_at,
          os.personality_scores
        FROM observer_assignments oa
        LEFT JOIN onboarding_sessions os ON oa.onboarding_session_id = os.id
        WHERE oa.guild_id = $1 
        ORDER BY oa.assigned_at DESC 
        LIMIT $2
      `,
        [message.guild.id, limit]
      );

      if (result.rows.length === 0) {
        await message.reply(
          "📭 No Observer assignments found for this server."
        );
        return;
      }

      let response = `**📋 Recent Observer Assignments (${result.rows.length}):**\n\n`;

      for (const observer of result.rows) {
        const assignedDate = new Date(
          observer.assigned_at
        ).toLocaleDateString();
        const responseType =
          observer.color_response === "observer"
            ? "Exact Match"
            : "Custom Response";

        response += `**\`${observer.observer_name}\`**\n`;
        response += `• User: \`${observer.user_id}\`\n`;
        response += `• Response: "${observer.color_response}" (${responseType})\n`;
        response += `• Assigned: ${assignedDate}\n`;

        // Show psychological scores if available
        if (observer.personality_scores) {
          try {
            const scores = JSON.parse(observer.personality_scores);
            const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
            response += `• Psych Score: ${totalScore}/16\n`;
          } catch (e) {
            // Skip if parsing fails
          }
        }

        response += `\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in recent-observers command:", error);
      await message.reply("❌ Failed to retrieve recent Observers.");
    }
  }

  /**
   * Shows all Observer names and their types
   * Usage: !observer-names
   */
  async handleObserverNames(message) {
    try {
      const result = await database.executeQuery(
        `
        SELECT 
          observer_name,
          color_response,
          COUNT(*) as usage_count,
          MAX(assigned_at) as last_used
        FROM observer_assignments
        WHERE guild_id = $1
        GROUP BY observer_name, color_response
        ORDER BY usage_count DESC, observer_name
      `,
        [message.guild.id]
      );

      if (result.rows.length === 0) {
        await message.reply("📭 No Observer names found for this server.");
        return;
      }

      let response = `**🔍 Observer Name Registry (${result.rows.length} unique names):**\n\n`;

      // Group by name pattern
      const exactObservers = result.rows.filter(
        (r) => r.color_response === "observer"
      );
      const customObservers = result.rows.filter(
        (r) => r.color_response !== "observer"
      );

      if (exactObservers.length > 0) {
        response += `**🎯 Generated Observer Names (${exactObservers.length}):**\n`;
        exactObservers.forEach((obs) => {
          const descriptor = obs.observer_name.replace("Observer-", "");
          response += `• **Observer-${descriptor}** (used ${obs.usage_count}x)\n`;
        });
        response += `\n`;
      }

      if (customObservers.length > 0) {
        response += `**✨ Custom Observer Names (${customObservers.length}):**\n`;
        customObservers.forEach((obs) => {
          const customPart = obs.observer_name.replace("Observer-", "");
          response += `• **Observer-${customPart}** from "${obs.color_response}" (used ${obs.usage_count}x)\n`;
        });
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in observer-names command:", error);
      await message.reply("❌ Failed to retrieve Observer names.");
    }
  }

  /**
   * Shows detailed info for a specific Observer user
   * Usage: !observer-info @user
   */
  async handleObserverInfo(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply(
          "❌ Please mention a user to check their Observer status."
        );
        return;
      }

      // Check if user is an Observer
      const observerResult = await database.executeQuery(
        `
        SELECT 
          oa.*,
          os.personality_scores,
          os.responses,
          os.completed_at
        FROM observer_assignments oa
        LEFT JOIN onboarding_sessions os ON oa.onboarding_session_id = os.id
        WHERE oa.user_id = $1 AND oa.guild_id = $2
        ORDER BY oa.assigned_at DESC
        LIMIT 1
      `,
        [mentionedUser.id, message.guild.id]
      );

      if (observerResult.rows.length === 0) {
        // Check if they have any onboarding session
        const sessionResult = await database.executeQuery(
          `
          SELECT completed, is_observer, observer_response, generated_nickname
          FROM onboarding_sessions
          WHERE user_id = $1 AND guild_id = $2
          ORDER BY started_at DESC
          LIMIT 1
        `,
          [mentionedUser.id, message.guild.id]
        );

        if (sessionResult.rows.length === 0) {
          await message.reply(
            `📭 ${mentionedUser.username} has no onboarding record.`
          );
        } else {
          const session = sessionResult.rows[0];
          await message.reply(
            `❌ ${
              mentionedUser.username
            } is not an Observer.\n\n• Completed Assessment: ${
              session.completed ? "Yes" : "No"
            }\n• Generated Name: ${
              session.generated_nickname || "None"
            }\n• Observer Response: "${session.observer_response || "None"}"`
          );
        }
        return;
      }

      const observer = observerResult.rows[0];

      let response = `**🔍 Observer Details for ${mentionedUser.username}:**\n\n`;

      response += `**📊 Observer Info:**\n`;
      response += `• Observer Name: **\`${observer.observer_name}\`**\n`;
      response += `• Color Response: "${observer.color_response}"\n`;
      response += `• Assignment Type: ${
        observer.color_response === "observer"
          ? "Generated Name"
          : "Custom Name"
      }\n`;
      response += `• Assigned: ${new Date(
        observer.assigned_at
      ).toLocaleString()}\n`;

      if (observer.personality_scores) {
        try {
          const scores = JSON.parse(observer.personality_scores);
          const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

          response += `\n**🧠 Psychological Profile:**\n`;
          response += `• 🔍 Pattern Seeker: ${scores.seeker || 0}/8\n`;
          response += `• 👻 Existentially Isolated: ${
            scores.isolated || 0
          }/8\n`;
          response += `• 👁️ Reality Aware: ${scores.aware || 0}/8\n`;
          response += `• ❓ Lost/Searching: ${scores.lost || 0}/8\n`;
          response += `• **Total Awareness:** ${totalScore}/16\n`;

          const dominantTrait = Object.keys(scores).reduce((a, b) =>
            scores[a] > scores[b] ? a : b
          );
          response += `• **Dominant Trait:** ${this.getTraitDescription(
            dominantTrait
          )}\n`;
        } catch (e) {
          response += `\n**🧠 Psychological Profile:** *Error parsing data*\n`;
        }
      }

      if (observer.completed_at) {
        response += `\n**📅 Assessment Timeline:**\n`;
        response += `• Completed: ${new Date(
          observer.completed_at
        ).toLocaleString()}\n`;
      }

      response += `\n**🎯 Observer Status:** ✅ ACTIVE\n`;
      response += `*This user has enhanced perception protocols and special access permissions.*`;

      await message.reply(response);
    } catch (error) {
      logger.error("Error in observer-info command:", error);
      await message.reply("❌ Failed to retrieve Observer information.");
    }
  }

  /**
   * Lists all Observers in the server
   * Usage: !list-observers
   */
  async handleListObservers(message) {
    try {
      const result = await database.executeQuery(
        `
        SELECT 
          user_id,
          observer_name,
          color_response,
          assigned_at
        FROM observer_assignments
        WHERE guild_id = $1
        ORDER BY assigned_at DESC
      `,
        [message.guild.id]
      );

      if (result.rows.length === 0) {
        await message.reply("📭 No Observers found in this server.");
        return;
      }

      let response = `**🔍 All Observers in Server (${result.rows.length}):**\n\n`;

      result.rows.forEach((observer, index) => {
        const assignedDate = new Date(
          observer.assigned_at
        ).toLocaleDateString();
        const responseType =
          observer.color_response === "observer" ? "🎯" : "✨";

        response += `${index + 1}. **\`${
          observer.observer_name
        }\`** ${responseType}\n`;
        response += `   User: \`${observer.user_id}\` | Assigned: ${assignedDate}\n`;
      });

      response += `\n**Legend:**\n`;
      response += `🎯 Generated name (answered "observer")\n`;
      response += `✨ Custom name (answered something else)\n`;

      await message.reply(response);
    } catch (error) {
      logger.error("Error in list-observers command:", error);
      await message.reply("❌ Failed to retrieve Observer list.");
    }
  }

  /**
   * Tests the Observer detection system
   * Usage: !test-observer-detection "color response"
   */
  async handleTestObserverDetection(message, args) {
    try {
      const testResponse = args.slice(1).join(" ").replace(/['"]/g, "");

      if (!testResponse) {
        await message.reply(
          '❌ Please provide a test response. Usage: `!test-observer-detection "observer"`'
        );
        return;
      }

      const sanitizedResponse = testResponse.toLowerCase().trim();

      let response = `**🧪 Observer Detection Test:**\n\n`;
      response += `**Input:** "${testResponse}"\n`;
      response += `**Sanitized:** "${sanitizedResponse}"\n\n`;

      if (sanitizedResponse === "observer") {
        response += `**Result:** 🎯 **OBSERVER DETECTED**\n`;
        response += `**Name Format:** Observer-RANDOM_DESCRIPTOR\n`;
        response += `**Examples:**\n`;
        response += `• Observer-WATCHING\n`;
        response += `• Observer-SEEING\n`;
        response += `• Observer-KNOWING\n`;
        response += `• Observer-WAITING\n`;
        response += `• Observer-RECORDING\n`;
        response += `• Observer-STUDYING\n`;
        response += `• Observer-ANALYZING\n`;
      } else {
        // Show what the sanitized custom name would be
        const sanitizedCustom = this.sanitizeObserverInput(testResponse);
        response += `**Result:** ✨ **CUSTOM OBSERVER NAME**\n`;
        response += `**Name Format:** Observer-USER_INPUT\n`;
        response += `**Generated Name:** Observer-${sanitizedCustom}\n`;
        response += `**Sanitization Process:**\n`;
        response += `• Original: "${testResponse}"\n`;
        response += `• Cleaned: "${sanitizedCustom}"\n`;
        response += `• Process: Remove special chars, uppercase, truncate to 20 chars\n`;
      }

      response += `\n**Observer Features:**\n`;
      response += `• Enhanced perception protocols: ACTIVE\n`;
      response += `• Special access permissions: ENABLED\n`;
      response += `• Different onboarding completion message\n`;
      response += `• Tracked separately from regular ARG names\n`;

      await message.reply(response);
    } catch (error) {
      logger.error("Error in test-observer-detection command:", error);
      await message.reply("❌ Failed to test Observer detection.");
    }
  }

  /**
   * Shows Observer response patterns and analytics
   * Usage: !observer-analytics
   */
  async handleObserverAnalytics(message) {
    try {
      // Get response patterns
      const responsePatterns = await database.executeQuery(
        `
        SELECT 
          color_response,
          COUNT(*) as count,
          MIN(assigned_at) as first_use,
          MAX(assigned_at) as last_use
        FROM observer_assignments
        WHERE guild_id = $1
        GROUP BY color_response
        ORDER BY count DESC
      `,
        [message.guild.id]
      );

      // Get time-based analytics
      const timeAnalytics = await database.executeQuery(
        `
        SELECT 
          DATE_TRUNC('day', assigned_at) as day,
          COUNT(*) as observers_per_day,
          COUNT(CASE WHEN color_response = 'observer' THEN 1 END) as exact_matches,
          COUNT(CASE WHEN color_response != 'observer' THEN 1 END) as custom_responses
        FROM observer_assignments
        WHERE guild_id = $1 AND assigned_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', assigned_at)
        ORDER BY day DESC
        LIMIT 10
      `,
        [message.guild.id]
      );

      let response = `**📊 Observer Analytics:**\n\n`;

      if (responsePatterns.rows.length > 0) {
        response += `**🎨 Response Patterns:**\n`;
        responsePatterns.rows.forEach((pattern, index) => {
          const isExactMatch = pattern.color_response === "observer";
          const emoji = isExactMatch ? "🎯" : "✨";
          const type = isExactMatch ? "(Exact Match)" : "(Custom)";

          response += `${index + 1}. ${emoji} "${
            pattern.color_response
          }" ${type} - ${pattern.count} uses\n`;
        });
        response += `\n`;
      }

      if (timeAnalytics.rows.length > 0) {
        response += `**📅 Recent Activity (Last 30 Days):**\n`;
        timeAnalytics.rows.forEach((day) => {
          const date = new Date(day.day).toLocaleDateString();
          response += `• ${date}: ${day.observers_per_day} Observers (${day.exact_matches} exact, ${day.custom_responses} custom)\n`;
        });
        response += `\n`;
      }

      // Calculate overall statistics
      const totalObservers = responsePatterns.rows.reduce(
        (sum, row) => sum + parseInt(row.count),
        0
      );
      const exactMatches =
        responsePatterns.rows.find((row) => row.color_response === "observer")
          ?.count || 0;
      const customResponses = totalObservers - exactMatches;

      response += `**📈 Summary:**\n`;
      response += `• Total Observers: ${totalObservers}\n`;
      response += `• Exact "Observer" Responses: ${exactMatches} (${
        totalObservers > 0
          ? Math.round((exactMatches / totalObservers) * 100)
          : 0
      }%)\n`;
      response += `• Custom Responses: ${customResponses} (${
        totalObservers > 0
          ? Math.round((customResponses / totalObservers) * 100)
          : 0
      }%)\n`;
      response += `• Unique Response Types: ${responsePatterns.rows.length}\n`;

      await message.reply(response);
    } catch (error) {
      logger.error("Error in observer-analytics command:", error);
      await message.reply("❌ Failed to retrieve Observer analytics.");
    }
  }

  /**
   * Finds a user by their Observer name
   * Usage: !find-observer "Observer-NAME"
   */
  async handleFindObserver(message, args) {
    try {
      const observerName = args.slice(1).join(" ").replace(/['"]/g, "");

      if (!observerName) {
        await message.reply(
          '❌ Please provide an Observer name to search. Usage: `!find-observer "Observer-WATCHING"`'
        );
        return;
      }

      const result = await database.executeQuery(
        `
        SELECT 
          user_id,
          color_response,
          assigned_at,
          onboarding_session_id
        FROM observer_assignments
        WHERE observer_name = $1 AND guild_id = $2
        ORDER BY assigned_at DESC
      `,
        [observerName, message.guild.id]
      );

      if (result.rows.length === 0) {
        await message.reply(
          `📭 No Observer found with name "${observerName}".`
        );
        return;
      }

      const observer = result.rows[0];
      const responseType =
        observer.color_response === "observer" ? "Generated" : "Custom";

      let response = `**🔍 Observer Found:**\n\n`;
      response += `**Name:** \`${observerName}\`\n`;
      response += `**User ID:** \`${observer.user_id}\`\n`;
      response += `**Original Response:** "${observer.color_response}"\n`;
      response += `**Type:** ${responseType}\n`;
      response += `**Assigned:** ${new Date(
        observer.assigned_at
      ).toLocaleString()}\n`;

      if (result.rows.length > 1) {
        response += `\n⚠️ **Note:** This name has been used ${result.rows.length} times (showing most recent).\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in find-observer command:", error);
      await message.reply("❌ Failed to find Observer.");
    }
  }

  /**
   * Sanitizes user input for Observer custom names (helper method)
   * @param {string} input - User input
   * @returns {string} Sanitized input
   */
  sanitizeObserverInput(input) {
    if (!input || typeof input !== "string") return "UNKNOWN";

    // Remove special characters, keep letters, numbers, spaces
    let cleaned = input
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .toUpperCase();

    // Replace spaces with underscores
    cleaned = cleaned.replace(/\s+/g, "_");

    // Truncate to reasonable length
    if (cleaned.length > 20) {
      cleaned = cleaned.substring(0, 20);
    }

    if (cleaned.length === 0) {
      return "UNNAMED";
    }

    return cleaned;
  }

  /**
   * Gets human-readable description for personality traits
   * @param {string} trait - Personality trait
   * @returns {string} Trait description
   */
  getTraitDescription(trait) {
    const descriptions = {
      seeker: "Pattern Recognition",
      isolated: "Existential Disconnect",
      aware: "Reality Perception",
      lost: "Searching State",
    };
    return descriptions[trait] || "Unknown";
  }
}

// Export singleton instance
module.exports = new ObserverCommands();
