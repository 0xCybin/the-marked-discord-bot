// ========================================
// FILE: src/commands/nicknameCommands.js - COMPLETE
// PURPOSE: Admin commands for managing nickname protection system
// ========================================

const nicknameService = require("../services/nicknames");
const database = require("../config/database");
const logger = require("../utils/logger");

/**
 * Nickname protection management commands
 * These commands help admins manage and debug the protection system
 */

/**
 * Checks if a user has nickname protection active
 * Usage: !check-protection @user
 */
async function checkProtection(message) {
  const mentionedUser = message.mentions.members.first();
  if (!mentionedUser) {
    await message.reply(
      "❌ *Please mention a user to check: `!check-protection @user`*"
    );
    return;
  }

  try {
    // Check protection status
    global.protectedNicknames = global.protectedNicknames || new Map();
    const protectedData = global.protectedNicknames.get(mentionedUser.id);

    if (protectedData && protectedData.guildId === message.guild.id) {
      const embed = {
        color: 0x00ff00, // Green
        title: "🛡️ Nickname Protection Status",
        description: `**${mentionedUser.user.username}** has active nickname protection`,
        fields: [
          {
            name: "Protected Nickname",
            value: `\`${protectedData.protectedNickname}\``,
            inline: true,
          },
          {
            name: "Current Nickname",
            value: `\`${mentionedUser.nickname || "None"}\``,
            inline: true,
          },
          {
            name: "Protection Since",
            value: protectedData.assignedAt
              ? protectedData.assignedAt.toLocaleString()
              : "Unknown",
            inline: false,
          },
          {
            name: "Protection Source",
            value: protectedData.source || "Unknown",
            inline: true,
          },
          {
            name: "Status",
            value:
              mentionedUser.nickname === protectedData.protectedNickname
                ? "✅ **ACTIVE** - Nickname matches protection"
                : "⚠️ **MISMATCH** - Current nickname differs from protected",
            inline: false,
          },
        ],
        footer: {
          text: "ARG Protocol: Identity Protection System",
        },
        timestamp: new Date().toISOString(),
      };

      await message.reply({ embeds: [embed] });
    } else {
      await message.reply({
        embeds: [
          {
            color: 0xff9900, // Orange
            title: "⚠️ No Protection Found",
            description: `**${mentionedUser.user.username}** does not have active nickname protection`,
            fields: [
              {
                name: "Current Nickname",
                value: `\`${mentionedUser.nickname || "None"}\``,
                inline: true,
              },
              {
                name: "Suggested Actions",
                value:
                  "• Use `!force-protect @user` to add protection\n• Use `!protect-current @user` to protect current nickname\n• Use `!force-onboarding @user` for full onboarding",
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      });
    }
  } catch (error) {
    logger.error("Error checking protection status:", error);
    await message.reply("❌ *Error checking protection status.*");
  }
}

/**
 * Forces nickname protection for a user (assigns new ARG nickname)
 * Usage: !force-protect @user
 */
async function forceProtect(message) {
  const mentionedUser = message.mentions.members.first();
  if (!mentionedUser) {
    await message.reply(
      "❌ *Please mention a user to protect: `!force-protect @user`*"
    );
    return;
  }

  try {
    // Check if already protected
    global.protectedNicknames = global.protectedNicknames || new Map();
    if (global.protectedNicknames.has(mentionedUser.id)) {
      await message.reply(
        "ℹ️ *This user already has nickname protection active. Use `!check-protection @user` to see details.*"
      );
      return;
    }

    // Assign new nickname and protection
    const assignedNickname = await nicknameService.assignNicknameToNewMember(
      mentionedUser
    );

    if (assignedNickname) {
      // Protection is automatically added by the enhanced nickname service
      await message.reply({
        embeds: [
          {
            color: 0x00ff00, // Green
            title: "✅ Protection Applied",
            description: `**${mentionedUser.user.username}** is now protected`,
            fields: [
              {
                name: "Protected Nickname",
                value: `\`${assignedNickname}\``,
                inline: true,
              },
              {
                name: "Status",
                value: "🛡️ Active Protection",
                inline: true,
              },
              {
                name: "Protection Type",
                value: "Force-assigned ARG name",
                inline: false,
              },
            ],
            footer: {
              text: "User will now receive warnings if they try to change their nickname",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      });

      logger.argEvent(
        "manual-protection",
        `Admin ${message.author.username} forced protection for ${mentionedUser.user.username} with nickname: ${assignedNickname}`
      );
    } else {
      await message.reply(
        "❌ *Failed to assign protected nickname. Check bot permissions and role hierarchy.*"
      );
    }
  } catch (error) {
    logger.error("Error forcing protection:", error);
    await message.reply("❌ *Error applying nickname protection.*");
  }
}

/**
 * Protect user with their current nickname (for existing users)
 * Usage: !protect-current @user
 */
async function protectCurrent(message) {
  const mentionedUser = message.mentions.members.first();
  if (!mentionedUser) {
    await message.reply(
      "❌ *Please mention a user to protect: `!protect-current @user`*"
    );
    return;
  }

  try {
    // Check if already protected
    global.protectedNicknames = global.protectedNicknames || new Map();
    if (global.protectedNicknames.has(mentionedUser.id)) {
      await message.reply(
        "ℹ️ *This user already has nickname protection active.*"
      );
      return;
    }

    // Get their current nickname
    const currentNickname =
      mentionedUser.nickname || mentionedUser.user.username;

    // Add protection with current nickname
    global.protectedNicknames.set(mentionedUser.id, {
      guildId: message.guild.id,
      protectedNickname: currentNickname,
      assignedAt: new Date(),
      userId: mentionedUser.id,
      username: mentionedUser.user.username,
      source: "admin-protect-current",
    });

    await message.reply({
      embeds: [
        {
          color: 0x00ff00, // Green
          title: "✅ Current Nickname Protected",
          description: `**${mentionedUser.user.username}** is now protected`,
          fields: [
            {
              name: "Protected Nickname",
              value: `\`${currentNickname}\``,
              inline: true,
            },
            {
              name: "Protection Type",
              value: "Current Nickname Lock",
              inline: true,
            },
            {
              name: "Status",
              value: "🛡️ Active Protection",
              inline: false,
            },
          ],
          footer: {
            text: "User will receive warnings if they try to change their nickname",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    logger.argEvent(
      "admin-protect-current",
      `Admin ${message.author.username} protected ${mentionedUser.user.username}'s current nickname: ${currentNickname}`
    );
  } catch (error) {
    logger.error("Error protecting current nickname:", error);
    await message.reply("❌ *Error applying nickname protection.*");
  }
}

/**
 * Shows nickname protection system statistics
 * Usage: !protection-stats
 */
async function protectionStats(message) {
  try {
    global.protectedNicknames = global.protectedNicknames || new Map();

    // Count protected users in this guild
    const guildProtected = Array.from(
      global.protectedNicknames.values()
    ).filter((data) => data.guildId === message.guild.id);

    // Count total protected users across all guilds
    const totalProtected = global.protectedNicknames.size;

    // Group by protection source
    const sourceStats = {};
    guildProtected.forEach((data) => {
      const source = data.source || "unknown";
      sourceStats[source] = (sourceStats[source] || 0) + 1;
    });

    // Get oldest and newest protections in this guild
    const sortedByDate = guildProtected.sort(
      (a, b) => new Date(a.assignedAt) - new Date(b.assignedAt)
    );
    const oldestProtection = sortedByDate[0];
    const newestProtection = sortedByDate[sortedByDate.length - 1];

    // Get recent protections (last 24 hours)
    const recentProtections = guildProtected.filter(
      (data) => new Date() - new Date(data.assignedAt) < 24 * 60 * 60 * 1000
    ).length;

    const embed = {
      color: 0x0099ff, // Blue
      title: "📊 Nickname Protection Statistics",
      description: `Protection system status for **${message.guild.name}**`,
      fields: [
        {
          name: "🛡️ Protected Users (This Server)",
          value: `${guildProtected.length} users`,
          inline: true,
        },
        {
          name: "🌐 Total Protected (All Servers)",
          value: `${totalProtected} users`,
          inline: true,
        },
        {
          name: "⏰ System Status",
          value: "🟢 **ACTIVE**",
          inline: true,
        },
        {
          name: "📈 Recent Activity (24h)",
          value: `${recentProtections} new protections`,
          inline: true,
        },
        {
          name: "📅 Protection Timeline",
          value:
            guildProtected.length > 0
              ? `Oldest: ${
                  oldestProtection
                    ? oldestProtection.assignedAt.toLocaleDateString()
                    : "N/A"
                }\nNewest: ${
                  newestProtection
                    ? newestProtection.assignedAt.toLocaleDateString()
                    : "N/A"
                }`
              : "No protected users yet",
          inline: false,
        },
        {
          name: "🔍 Protection Sources",
          value:
            Object.keys(sourceStats).length > 0
              ? Object.entries(sourceStats)
                  .map(([source, count]) => `${source}: ${count}`)
                  .join("\n")
              : "No data available",
          inline: false,
        },
      ],
      footer: {
        text: "Use !check-protection @user to see individual status",
      },
      timestamp: new Date().toISOString(),
    };

    await message.reply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error getting protection stats:", error);
    await message.reply("❌ *Error retrieving protection statistics.*");
  }
}

/**
 * Tests bot permissions for nickname management
 * Usage: !test-permissions @user
 */
async function testPermissions(message) {
  const mentionedUser = message.mentions.members.first();
  if (!mentionedUser) {
    await message.reply(
      "❌ *Please mention a user to test: `!test-permissions @user`*"
    );
    return;
  }

  try {
    const guild = message.guild;
    const botMember = guild.members.me;
    const targetMember = mentionedUser;

    // Check bot permissions
    const hasManageNicknames = botMember.permissions.has("ManageNicknames");
    const hasAdmin = botMember.permissions.has("Administrator");
    const hasAuditLog = botMember.permissions.has("ViewAuditLog");

    // Check role hierarchy
    const canManage =
      botMember.roles.highest.position > targetMember.roles.highest.position;

    // Check if target is server owner
    const isOwner = targetMember.id === guild.ownerId;

    // Determine overall status
    const canAssignNickname =
      !isOwner && canManage && (hasManageNicknames || hasAdmin);

    const embed = {
      color: canAssignNickname ? 0x00ff00 : 0xff0000, // Green if can manage, red if not
      title: "🔍 Permission Test Results",
      description: `Testing bot permissions for **${targetMember.user.username}**`,
      fields: [
        {
          name: "🤖 Bot Permissions",
          value: `Manage Nicknames: ${
            hasManageNicknames ? "✅" : "❌"
          }\nAdministrator: ${hasAdmin ? "✅" : "❌"}\nView Audit Log: ${
            hasAuditLog ? "✅" : "❌"
          }`,
          inline: true,
        },
        {
          name: "👥 Role Hierarchy",
          value: `Bot Role: ${botMember.roles.highest.name} (${
            botMember.roles.highest.position
          })\nUser Role: ${targetMember.roles.highest.name} (${
            targetMember.roles.highest.position
          })\nCan Manage: ${canManage ? "✅" : "❌"}`,
          inline: true,
        },
        {
          name: "⚠️ Special Cases",
          value: `Server Owner: ${
            isOwner ? "⚠️ YES (Cannot manage)" : "✅ No"
          }\nBot User: ${
            targetMember.user.bot ? "⚠️ YES (Skip bots)" : "✅ No"
          }`,
          inline: false,
        },
        {
          name: "📋 Overall Status",
          value: canAssignNickname
            ? "✅ **CAN MANAGE** - All checks passed"
            : "❌ **CANNOT MANAGE** - Check issues above",
          inline: false,
        },
      ],
      footer: {
        text: canAssignNickname
          ? "Bot can successfully manage this user's nickname"
          : "Bot cannot manage this user's nickname - fix the issues above",
      },
      timestamp: new Date().toISOString(),
    };

    // Add fix suggestions if there are issues
    if (!canAssignNickname) {
      let fixes = [];

      if (isOwner) {
        fixes.push("• Server owners cannot have nicknames managed by bots");
        fixes.push("• Test with a different user instead");
      }

      if (!canManage && !isOwner) {
        fixes.push(
          "• Move bot's role ABOVE the user's role in Server Settings → Roles"
        );
      }

      if (!hasManageNicknames && !hasAdmin) {
        fixes.push("• Give bot 'Manage Nicknames' permission");
        fixes.push("• Or re-invite bot with proper permissions");
      }

      if (fixes.length > 0) {
        embed.fields.push({
          name: "🔧 How to Fix",
          value: fixes.join("\n"),
          inline: false,
        });
      }
    }

    await message.reply({ embeds: [embed] });

    // If permissions look good, offer to test actual nickname change
    if (canAssignNickname) {
      const testMessage = await message.channel.send(
        "🧪 **Test actual nickname change?** React with ✅ to test or ❌ to skip"
      );
      await testMessage.react("✅");
      await testMessage.react("❌");

      // Wait for reaction
      const filter = (reaction, user) => {
        return (
          ["✅", "❌"].includes(reaction.emoji.name) &&
          user.id === message.author.id
        );
      };

      const collected = await testMessage.awaitReactions({
        filter,
        max: 1,
        time: 15000,
      });

      if (collected.size === 0) {
        await testMessage.edit("🧪 Test timeout - no reaction received");
        return;
      }

      const reaction = collected.first();

      if (reaction.emoji.name === "✅") {
        // Perform actual test
        try {
          const originalNickname = targetMember.nickname;
          await targetMember.setNickname("TEST-TEMP", "Permission test");
          await message.channel.send(
            "✅ **Test 1/2 PASSED** - Bot can change nickname"
          );

          // Restore original
          await targetMember.setNickname(
            originalNickname,
            "Restoring after test"
          );
          await message.channel.send(
            "✅ **Test 2/2 PASSED** - Bot can restore nickname\n\n🎉 **ALL TESTS PASSED!** Nickname protection will work for this user."
          );
        } catch (testError) {
          await message.channel.send(
            `❌ **TEST FAILED** - ${testError.message}\n\nEven though permissions look correct, there may be a Discord-side issue.`
          );
        }
      } else {
        await testMessage.edit("🧪 Test skipped by user");
      }
    }
  } catch (error) {
    logger.error("Error testing permissions:", error);
    await message.reply("❌ *Error testing permissions.*");
  }
}

/**
 * Removes nickname protection from a user
 * Usage: !remove-protection @user
 */
async function removeProtection(message) {
  const mentionedUser = message.mentions.members.first();
  if (!mentionedUser) {
    await message.reply(
      "❌ *Please mention a user: `!remove-protection @user`*"
    );
    return;
  }

  try {
    global.protectedNicknames = global.protectedNicknames || new Map();
    const hadProtection = global.protectedNicknames.has(mentionedUser.id);

    if (hadProtection) {
      const protectedData = global.protectedNicknames.get(mentionedUser.id);
      global.protectedNicknames.delete(mentionedUser.id);

      await message.reply({
        embeds: [
          {
            color: 0xff9900, // Orange
            title: "🔓 Protection Removed",
            description: `**${mentionedUser.user.username}** can now change their nickname freely`,
            fields: [
              {
                name: "Was Protected",
                value: `\`${protectedData.protectedNickname}\``,
                inline: true,
              },
              {
                name: "Current Nickname",
                value: `\`${mentionedUser.nickname || "None"}\``,
                inline: true,
              },
              {
                name: "Status",
                value: "🔓 No Protection",
                inline: false,
              },
            ],
            footer: {
              text: "User will no longer receive warnings for nickname changes",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      });

      logger.argEvent(
        "protection-removed",
        `Admin ${message.author.username} removed protection from ${mentionedUser.user.username} (was: ${protectedData.protectedNickname})`
      );
    } else {
      await message.reply(
        "ℹ️ *This user doesn't have nickname protection active.*"
      );
    }
  } catch (error) {
    logger.error("Error removing protection:", error);
    await message.reply("❌ *Error removing nickname protection.*");
  }
}

/**
 * Lists all protected users in the current guild
 * Usage: !list-protected
 */
async function listProtected(message) {
  try {
    global.protectedNicknames = global.protectedNicknames || new Map();

    // Get protected users in this guild
    const guildProtected = Array.from(global.protectedNicknames.entries())
      .filter(([userId, data]) => data.guildId === message.guild.id)
      .sort((a, b) => new Date(b[1].assignedAt) - new Date(a[1].assignedAt)); // Sort by newest first

    if (guildProtected.length === 0) {
      await message.reply(
        "ℹ️ *No users currently have nickname protection in this server.*"
      );
      return;
    }

    // Create pages if there are many protected users
    const itemsPerPage = 10;
    const totalPages = Math.ceil(guildProtected.length / itemsPerPage);
    const currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageUsers = guildProtected.slice(startIndex, endIndex);

    let userList = "";
    for (let i = 0; i < pageUsers.length; i++) {
      const [userId, data] = pageUsers[i];
      const member = await message.guild.members
        .fetch(userId)
        .catch(() => null);
      const username = member
        ? member.user.username
        : data.username || "Unknown User";
      const currentNick = member ? member.nickname || "None" : "Unknown";
      const statusIcon =
        member && member.nickname === data.protectedNickname ? "✅" : "⚠️";

      userList += `${statusIcon} **${username}**\n`;
      userList += `   Protected: \`${data.protectedNickname}\`\n`;
      userList += `   Current: \`${currentNick}\`\n`;
      userList += `   Source: ${data.source || "unknown"}\n`;
      userList += `   Since: ${
        data.assignedAt ? data.assignedAt.toLocaleDateString() : "Unknown"
      }\n\n`;
    }

    const embed = {
      color: 0x0099ff, // Blue
      title: "🛡️ Protected Users List",
      description: `Showing ${pageUsers.length} of ${guildProtected.length} protected users`,
      fields: [
        {
          name: `Page ${currentPage} of ${totalPages}`,
          value: userList || "No users found",
          inline: false,
        },
      ],
      footer: {
        text: "✅ = Nickname matches protection | ⚠️ = Nickname mismatch",
      },
      timestamp: new Date().toISOString(),
    };

    await message.reply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error listing protected users:", error);
    await message.reply("❌ *Error retrieving protected users list.*");
  }
}

/**
 * Bulk protect all current server members with their current nicknames
 * Usage: !bulk-protect-current
 */
async function bulkProtectCurrent(message) {
  try {
    if (!message.member.permissions.has("Administrator")) {
      await message.reply(
        "❌ *This command requires Administrator permission.*"
      );
      return;
    }

    const guild = message.guild;
    const members = await guild.members.fetch();

    let protected = 0;
    let alreadyProtected = 0;
    let skipped = 0;

    const statusMessage = await message.reply(
      "🔄 **Starting bulk protection of current nicknames...**\nThis protects users with their existing names."
    );

    global.protectedNicknames = global.protectedNicknames || new Map();

    for (const [userId, member] of members) {
      // Skip bots
      if (member.user.bot) {
        skipped++;
        continue;
      }

      // Skip if already protected
      if (global.protectedNicknames.has(userId)) {
        alreadyProtected++;
        continue;
      }

      try {
        const currentNickname = member.nickname || member.user.username;

        global.protectedNicknames.set(userId, {
          guildId: guild.id,
          protectedNickname: currentNickname,
          assignedAt: new Date(),
          userId: userId,
          username: member.user.username,
          source: "bulk-protect-current",
        });

        protected++;

        // Update status every 10 users
        if (protected % 10 === 0) {
          await statusMessage.edit(
            `🔄 **Bulk Protection Progress**\n✅ Protected: ${protected}\n🛡️ Already Protected: ${alreadyProtected}\n⏭️ Skipped (bots): ${skipped}`
          );
        }
      } catch (error) {
        console.log(
          `Failed to protect ${member.user.username}:`,
          error.message
        );
      }
    }

    await statusMessage.edit(
      `✅ **Bulk Protection Complete!**\n\n📊 **Results:**\n✅ Newly Protected: ${protected}\n🛡️ Already Protected: ${alreadyProtected}\n⏭️ Skipped (bots): ${skipped}\n\n🛡️ All users now have nickname protection with their current names.`
    );

    logger.argEvent(
      "bulk-protect-current",
      `Admin ${message.author.username} bulk protected ${protected} users with current nicknames`
    );
  } catch (error) {
    logger.error("Error in bulk protect current:", error);
    await message.reply("❌ *Error during bulk protection process.*");
  }
}

/**
 * Protect users who completed onboarding (from database)
 * Usage: !protect-onboarded
 */
async function protectOnboarded(message) {
  try {
    if (!message.member.permissions.has("Administrator")) {
      await message.reply(
        "❌ *This command requires Administrator permission.*"
      );
      return;
    }

    const guild = message.guild;

    // Get users who completed onboarding
    const result = await database.executeQuery(
      `SELECT user_id, generated_nickname, is_observer, completed_at 
       FROM onboarding_sessions 
       WHERE guild_id = $1 AND completed = TRUE AND generated_nickname IS NOT NULL
       ORDER BY completed_at DESC`,
      [guild.id]
    );

    if (result.rows.length === 0) {
      await message.reply(
        "ℹ️ *No completed onboarding sessions found with generated nicknames.*"
      );
      return;
    }

    let protected = 0;
    let alreadyProtected = 0;
    let userNotFound = 0;

    const statusMessage = await message.reply(
      `🔄 **Protecting ${result.rows.length} onboarded users...**`
    );

    global.protectedNicknames = global.protectedNicknames || new Map();

    for (const row of result.rows) {
      try {
        // Skip if already protected
        if (global.protectedNicknames.has(row.user_id)) {
          alreadyProtected++;
          continue;
        }

        // Try to get the member
        const member = await guild.members.fetch(row.user_id).catch(() => null);
        if (!member) {
          userNotFound++;
          continue;
        }

        // Add protection
        global.protectedNicknames.set(row.user_id, {
          guildId: guild.id,
          protectedNickname: row.generated_nickname,
          assignedAt: new Date(),
          userId: row.user_id,
          username: member.user.username,
          source: row.is_observer
            ? "onboarding-observer-retroactive"
            : "onboarding-arg-retroactive",
        });

        protected++;

        // Update status every 5 users
        if (protected % 5 === 0) {
          await statusMessage.edit(
            `🔄 **Onboarding Protection Progress**\n✅ Protected: ${protected}\n🛡️ Already Protected: ${alreadyProtected}\n❌ User Not Found: ${userNotFound}`
          );
        }
      } catch (error) {
        console.log(
          `Failed to protect onboarded user ${row.user_id}:`,
          error.message
        );
      }
    }

    await statusMessage.edit(
      `✅ **Onboarding Protection Complete!**\n\n📊 **Results:**\n✅ Newly Protected: ${protected}\n🛡️ Already Protected: ${alreadyProtected}\n❌ Users Not Found: ${userNotFound}\n\n🛡️ All onboarded users now have nickname protection.`
    );

    logger.argEvent(
      "protect-onboarded",
      `Admin ${message.author.username} protected ${protected} onboarded users retroactively`
    );
  } catch (error) {
    logger.error("Error protecting onboarded users:", error);
    await message.reply("❌ *Error protecting onboarded users.*");
  }
}

module.exports = {
  checkProtection,
  forceProtect,
  protectCurrent,
  protectionStats,
  testPermissions,
  removeProtection,
  listProtected,
  bulkProtectCurrent,
  protectOnboarded,
};
