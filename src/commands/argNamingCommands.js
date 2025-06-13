// ========================================
// FILE: src/commands/argNamingCommands.js
// PURPOSE: Admin commands for ARG systematic naming system
// ========================================

const database = require("../config/database");
const logger = require("../utils/logger");
const argNamingSystem = require("../services/argNamingSystem");

/**
 * Admin commands for ARG naming system management
 */
class ARGNamingCommands {
  /**
   * Shows ARG naming system statistics
   * Usage: !arg-naming-stats
   */
  async handleNamingStats(message) {
    try {
      const stats = await argNamingSystem.getAssignmentStats(message.guild.id);

      let response = `**🔮 ARG Systematic Naming Statistics:**\n\n`;

      response += `**📊 System Overview:**\n`;
      response += `• Total Possible Names: ${stats.totalPossible.toLocaleString()}\n`;
      response += `• Names Assigned: ${stats.totalAssigned.toLocaleString()}\n`;
      response += `• Remaining Available: ${stats.remaining.toLocaleString()}\n`;
      response += `• Utilization Rate: ${stats.utilizationRate}%\n`;

      if (stats.lastAssignment) {
        response += `• Last Assignment: ${new Date(
          stats.lastAssignment
        ).toLocaleString()}\n`;
      }

      response += `\n**🧩 Component Usage:**\n`;
      response += `• Classifications Used: ${stats.classificationsUsed}/8\n`;
      response += `• IDs Used: ${stats.idsUsed}/100\n`;
      response += `• Descriptors Used: ${stats.descriptorsUsed}/80\n`;
      response += `• Symbols Used: ${stats.symbolsUsed}/60\n`;

      // Calculate years until exhaustion at current rate
      if (stats.totalAssigned > 0) {
        const dailyRate =
          stats.totalAssigned /
          Math.max(
            1,
            Math.floor(
              (Date.now() - new Date(stats.lastAssignment).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          );
        const daysUntilExhaustion = stats.remaining / Math.max(0.1, dailyRate);
        const yearsUntilExhaustion = (daysUntilExhaustion / 365).toFixed(1);

        response += `\n**📈 Projection:**\n`;
        response += `• Est. Years Until Exhaustion: ${yearsUntilExhaustion} years\n`;
        response += `• (Based on current assignment rate)\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in arg-naming-stats command:", error);
      await message.reply("❌ Failed to retrieve ARG naming statistics.");
    }
  }

  /**
   * Shows recent ARG name assignments
   * Usage: !recent-arg-names [limit]
   */
  async handleRecentNames(message, args) {
    try {
      const limit = parseInt(args[1]) || 10;

      const result = await database.executeQuery(
        `
        SELECT 
          assigned_name,
          user_id,
          assigned_at,
          psychological_profile
        FROM arg_name_assignments 
        WHERE guild_id = $1 
        ORDER BY assigned_at DESC 
        LIMIT $2
      `,
        [message.guild.id, limit]
      );

      if (result.rows.length === 0) {
        await message.reply(
          "📭 No ARG name assignments found for this server."
        );
        return;
      }

      let response = `**📋 Recent ARG Name Assignments (${result.rows.length}):**\n\n`;

      for (const assignment of result.rows) {
        const assignedDate = new Date(
          assignment.assigned_at
        ).toLocaleDateString();
        const decoded = argNamingSystem.decodeARGName(assignment.assigned_name);

        response += `**\`${assignment.assigned_name}\`**\n`;
        response += `• User: \`${assignment.user_id}\`\n`;
        response += `• Assigned: ${assignedDate}\n`;

        if (decoded.isValid) {
          response += `• Type: ${decoded.classification.meaning}\n`;
        }

        response += `\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in recent-arg-names command:", error);
      await message.reply("❌ Failed to retrieve recent ARG names.");
    }
  }

  /**
   * Decodes a specific ARG name
   * Usage: !decode-arg-name "NAME-A1-DESC-SYMBOL"
   */
  async handleDecodeName(message, args) {
    try {
      const nameToCheck = args.slice(1).join(" ").replace(/['"]/g, "");

      if (!nameToCheck) {
        await message.reply(
          '❌ Please provide an ARG name to decode. Usage: `!decode-arg-name "SUBJ-A1-SEEING-░"`'
        );
        return;
      }

      const decoded = argNamingSystem.decodeARGName(nameToCheck);

      let response = `**🔍 ARG Name Analysis:**\n\n`;
      response += `**Name:** \`${nameToCheck}\`\n\n`;

      if (decoded.isValid) {
        response += `**✅ Valid ARG Format**\n\n`;
        response += `**Components:**\n`;
        response += `• **${decoded.classification.code}** - ${decoded.classification.meaning}\n`;
        response += `• **${decoded.id}** - Identification Code\n`;
        response += `• **${decoded.descriptor}** - State Descriptor\n`;
        response += `• **${decoded.symbol}** - Systematic Symbol\n`;

        // Check if this name has been assigned
        const assignmentCheck = await database.executeQuery(
          "SELECT user_id, assigned_at FROM arg_name_assignments WHERE assigned_name = $1",
          [nameToCheck]
        );

        if (assignmentCheck.rows.length > 0) {
          const assignment = assignmentCheck.rows[0];
          response += `\n**Assignment Status:** ✅ Assigned\n`;
          response += `• User: \`${assignment.user_id}\`\n`;
          response += `• Date: ${new Date(
            assignment.assigned_at
          ).toLocaleString()}\n`;
        } else {
          response += `\n**Assignment Status:** ⚪ Available\n`;
        }
      } else {
        response += `**❌ Invalid ARG Format**\n\n`;
        response += `ARG names must follow the format:\n`;
        response += `\`CLASSIFICATION-ID-DESCRIPTOR-SYMBOL\`\n\n`;
        response += `Example: \`SUBJ-A1-SEEING-░\`\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in decode-arg-name command:", error);
      await message.reply("❌ Failed to decode ARG name.");
    }
  }

  /**
   * Shows component usage statistics
   * Usage: !arg-component-stats
   */
  async handleComponentStats(message) {
    try {
      const result = await database.executeQuery(`
        SELECT 
          component_type,
          component_value,
          usage_count,
          last_used
        FROM arg_name_component_usage 
        WHERE usage_count > 0
        ORDER BY component_type, usage_count DESC
      `);

      if (result.rows.length === 0) {
        await message.reply("📭 No component usage data found.");
        return;
      }

      // Group by component type
      const grouped = result.rows.reduce((acc, row) => {
        if (!acc[row.component_type]) acc[row.component_type] = [];
        acc[row.component_type].push(row);
        return acc;
      }, {});

      let response = `**🧩 ARG Name Component Usage:**\n\n`;

      Object.keys(grouped).forEach((componentType) => {
        const components = grouped[componentType];
        const totalUsed = components.length;
        const maxPossible =
          {
            classification: 8,
            id: 100,
            descriptor: 80,
            symbol: 60,
          }[componentType] || 0;

        response += `**${componentType.toUpperCase()}S** (${totalUsed}/${maxPossible} used):\n`;

        // Show top 5 most used
        components.slice(0, 5).forEach((comp) => {
          response += `• \`${comp.component_value}\` - ${comp.usage_count} uses\n`;
        });

        if (components.length > 5) {
          response += `• ... and ${components.length - 5} more\n`;
        }

        response += `\n`;
      });

      await message.reply(response);
    } catch (error) {
      logger.error("Error in arg-component-stats command:", error);
      await message.reply("❌ Failed to retrieve component statistics.");
    }
  }

  /**
   * Tests the ARG naming system with a mock psychological profile
   * Usage: !test-arg-naming
   */
  async handleTestNaming(message) {
    try {
      const mockProfiles = [
        {
          personality_scores: { seeker: 7, isolated: 2, aware: 5, lost: 3 },
          user_id: "test_seeker",
          description: "High Seeker Profile",
        },
        {
          personality_scores: { seeker: 1, isolated: 8, aware: 2, lost: 4 },
          user_id: "test_isolated",
          description: "High Isolated Profile",
        },
        {
          personality_scores: { seeker: 3, isolated: 1, aware: 7, lost: 2 },
          user_id: "test_aware",
          description: "High Aware Profile",
        },
        {
          personality_scores: { seeker: 2, isolated: 3, aware: 1, lost: 6 },
          user_id: "test_lost",
          description: "High Lost Profile",
        },
      ];

      let response = `**🧪 ARG Naming System Test:**\n\n`;

      for (const profile of mockProfiles) {
        try {
          const generatedName = await argNamingSystem.generateUniqueName(
            profile,
            message.guild.id
          );
          const decoded = argNamingSystem.decodeARGName(generatedName);

          response += `**${profile.description}:**\n`;
          response += `• Generated: \`${generatedName}\`\n`;
          response += `• Type: ${
            decoded.classification?.meaning || "Unknown"
          }\n`;
          response += `• Scores: S:${profile.personality_scores.seeker} I:${profile.personality_scores.isolated} A:${profile.personality_scores.aware} L:${profile.personality_scores.lost}\n\n`;
        } catch (error) {
          response += `**${profile.description}:** ❌ Failed to generate\n\n`;
        }
      }

      response += `*Note: These are test generations and will be recorded in the database.*`;

      await message.reply(response);
    } catch (error) {
      logger.error("Error in test-arg-naming command:", error);
      await message.reply("❌ Failed to test ARG naming system.");
    }
  }

  /**
   * Finds ARG names by user ID
   * Usage: !find-arg-name @user
   */
  async handleFindUserName(message, args) {
    try {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        await message.reply("❌ Please mention a user to find their ARG name.");
        return;
      }

      const result = await database.executeQuery(
        `
        SELECT 
          assigned_name,
          assigned_at,
          psychological_profile
        FROM arg_name_assignments 
        WHERE user_id = $1 AND guild_id = $2
        ORDER BY assigned_at DESC
        LIMIT 1
      `,
        [mentionedUser.id, message.guild.id]
      );

      if (result.rows.length === 0) {
        await message.reply(
          `📭 No ARG name found for ${mentionedUser.username} in this server.`
        );
        return;
      }

      const assignment = result.rows[0];
      const decoded = argNamingSystem.decodeARGName(assignment.assigned_name);
      const psychProfile = JSON.parse(assignment.psychological_profile || "{}");

      let response = `**🔍 ARG Name for ${mentionedUser.username}:**\n\n`;
      response += `**Name:** \`${assignment.assigned_name}\`\n`;
      response += `**Assigned:** ${new Date(
        assignment.assigned_at
      ).toLocaleString()}\n\n`;

      if (decoded.isValid) {
        response += `**Decoded:**\n`;
        response += `• **${decoded.classification.code}** - ${decoded.classification.meaning}\n`;
        response += `• **${decoded.id}** - Identification Code\n`;
        response += `• **${decoded.descriptor}** - State Descriptor\n`;
        response += `• **${decoded.symbol}** - Systematic Symbol\n`;
      }

      if (psychProfile.personality_scores) {
        const scores = psychProfile.personality_scores;
        response += `\n**Psychological Profile:**\n`;
        response += `• 🔍 Seeker: ${scores.seeker || 0}/8\n`;
        response += `• 👻 Isolated: ${scores.isolated || 0}/8\n`;
        response += `• 👁️ Aware: ${scores.aware || 0}/8\n`;
        response += `• ❓ Lost: ${scores.lost || 0}/8\n`;
      }

      await message.reply(response);
    } catch (error) {
      logger.error("Error in find-arg-name command:", error);
      await message.reply("❌ Failed to find ARG name.");
    }
  }

  /**
   * Shows unused name combinations for analysis
   * Usage: !unused-combinations [classification]
   */
  async handleUnusedCombinations(message, args) {
    try {
      const classification = args[1]?.toUpperCase();

      if (
        classification &&
        !["SUBJ", "ID", "TEST", "#", "UNIT", "NODE", "CASE", "SPEC"].includes(
          classification
        )
      ) {
        await message.reply(
          "❌ Invalid classification. Use: SUBJ, ID, TEST, #, UNIT, NODE, CASE, SPEC"
        );
        return;
      }

      let query = `
        SELECT 
          SPLIT_PART(assigned_name, '-', 1) as classification,
          COUNT(*) as used_count,
          CASE 
            WHEN SPLIT_PART(assigned_name, '-', 1) = 'SUBJ' THEN 480000
            WHEN SPLIT_PART(assigned_name, '-', 1) = 'ID' THEN 480000
            WHEN SPLIT_PART(assigned_name, '-', 1) = 'TEST' THEN 480000
            WHEN SPLIT_PART(assigned_name, '-', 1) = '#' THEN 480000
            WHEN SPLIT_PART(assigned_name, '-', 1) = 'UNIT' THEN 480000
            WHEN SPLIT_PART(assigned_name, '-', 1) = 'NODE' THEN 480000
            WHEN SPLIT_PART(assigned_name, '-', 1) = 'CASE' THEN 480000
            WHEN SPLIT_PART(assigned_name, '-', 1) = 'SPEC' THEN 480000
            ELSE 480000
          END as total_possible
        FROM arg_name_assignments
      `;

      let params = [];

      if (classification) {
        query += ` WHERE SPLIT_PART(assigned_name, '-', 1) = $1`;
        params.push(classification);
      }

      query += ` GROUP BY SPLIT_PART(assigned_name, '-', 1) ORDER BY classification`;

      const result = await database.executeQuery(query, params);

      let response = `**📊 ARG Name Usage by Classification:**\n\n`;

      if (result.rows.length === 0) {
        response += "No names assigned yet.\n";
      } else {
        result.rows.forEach((row) => {
          const remaining = row.total_possible - row.used_count;
          const percentage = (
            (row.used_count / row.total_possible) *
            100
          ).toFixed(2);

          response += `**${row.classification}:**\n`;
          response += `• Used: ${row.used_count.toLocaleString()}\n`;
          response += `• Remaining: ${remaining.toLocaleString()}\n`;
          response += `• Utilization: ${percentage}%\n\n`;
        });
      }

      // Add total system statistics
      const totalStats = await argNamingSystem.getAssignmentStats();
      response += `**🌐 System Total:**\n`;
      response += `• Total Used: ${totalStats.totalAssigned.toLocaleString()}\n`;
      response += `• Total Remaining: ${totalStats.remaining.toLocaleString()}\n`;
      response += `• Overall Utilization: ${totalStats.utilizationRate}%\n`;

      await message.reply(response);
    } catch (error) {
      logger.error("Error in unused-combinations command:", error);
      await message.reply("❌ Failed to retrieve unused combinations.");
    }
  }
}

// Export singleton instance
module.exports = new ARGNamingCommands();
