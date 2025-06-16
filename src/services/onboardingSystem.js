// ========================================
// FILE: src/services/onboardingSystem.js (COMPLETE FIXED VERSION)
// PURPOSE: Enhanced onboarding with NORMAL ARG flow + Observer detection - ALL FIXES APPLIED
// UPDATED: Fixed Observer username format from "Observer-Username" to "Username-Obs"
// ========================================

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const database = require("../config/database");
const logger = require("../utils/logger");
const messageLogger = require("./messageLogger");

/**
 * Enhanced ARG Onboarding System - COMPLETE FINAL VERSION WITH ALL FIXES
 * 99% of users get normal ARG systematic names
 * Only users who type "observer" get Observer choices
 */
class OnboardingSystem {
  constructor() {
    // Store Discord client reference for DM fallbacks
    this.client = null;

    // Psychological profiling questions organized by category
    this.questionCategories = {
      existential: [
        "Do you ever feel like you're the only real person in a world of NPCs?",
        "Have you ever had the unsettling feeling that reality is just a simulation?",
        "Do you sometimes wonder if other people actually think, or just act like they do?",
        "Have you noticed how most people seem to follow scripts rather than think?",
        "Do you feel disconnected from people who seem... asleep?",
      ],

      patterns: [
        "Do you see patterns where others see coincidence?",
        "Have you noticed the same numbers appearing everywhere in your life?",
        "Do you feel like events in your life are too orchestrated to be random?",
        "Have you experienced moments where reality felt 'thin' or artificial?",
        "Do you notice glitches that others seem to ignore?",
      ],

      isolation: [
        "Do you prefer the quiet hours when most people are asleep?",
        "Have you ever felt like you're watching life from outside, like through glass?",
        "Do you find it easier to connect with strangers online than people in person?",
        "Have you experienced periods where nothing felt real or meaningful?",
        "Do you sometimes feel like you're living in the wrong reality?",
      ],

      awareness: [
        "Have you ever felt like someone or something was trying to communicate with you?",
        "Do you pay attention to things others dismiss as meaningless?",
        "Have you experienced synchronicities that felt too perfect to be chance?",
        "Do you feel like you're waiting for something to happen, but don't know what?",
        "Have you ever felt chosen for something you couldn't understand?",
      ],

      // Observer identification question
      observer: [
        "What is your favorite color? (Think carefully about your answer...)",
      ],
    };

    // Response tracking for personality analysis
    this.responseAnalysis = {
      seeker: 0, // Pattern recognition, seeking truth
      isolated: 0, // Disconnected, alone
      aware: 0, // Conscious of strangeness
      lost: 0, // Confused, searching
    };
  }

  /**
   * NEW: Set client reference (call this from your main bot file)
   */
  setClient(client) {
    this.client = client;
  }

  /**
   * FIXED: Enhanced interaction state checking utility
   */
  isInteractionValid(interaction) {
    const now = Date.now();
    const interactionTime = interaction.createdTimestamp;
    const timeDiff = now - interactionTime;
    const INTERACTION_TIMEOUT = 900000;
    return timeDiff < INTERACTION_TIMEOUT && !interaction.replied;
  }

  /**
   * FIXED: Safe interaction reply wrapper
   */
  async safeReply(interaction, options) {
    try {
      if (!this.isInteractionValid(interaction)) {
        logger.warn("Cannot reply to expired interaction");
        return false;
      }

      if (interaction.replied) {
        await interaction.followUp(options);
      } else if (interaction.deferred) {
        await interaction.editReply(options);
      } else {
        await interaction.reply(options);
      }

      return true;
    } catch (error) {
      if (error.code === 10062) {
        logger.warn("Interaction expired during reply attempt");
      } else {
        logger.error("Error in safe reply:", error);
      }
      return false;
    }
  }

  /**
   * FIXED: Initiates onboarding process with duplicate prevention and forced flag support
   */
  async initiateOnboarding(member, isForced = false) {
    logger.argEvent(
      "onboarding",
      `🔍 Starting enhanced psychological profiling for ${member.user.username} (forced: ${isForced})`
    );

    try {
      const existingSession = await database.executeQuery(
        `SELECT id, completed, started_at FROM onboarding_sessions WHERE user_id = $1 AND guild_id = $2 AND completed = false ORDER BY started_at DESC LIMIT 1`,
        [member.id, member.guild.id]
      );

      if (existingSession.rows.length > 0 && !isForced) {
        logger.warn(
          `User ${member.user.username} already has active onboarding session`
        );
        return false;
      }

      // Check for very recent sessions to prevent duplicates (within last 30 seconds)
      const recentSession = await database.executeQuery(
        `SELECT id, started_at FROM onboarding_sessions WHERE user_id = $1 AND guild_id = $2 AND started_at > NOW() - INTERVAL '30 seconds' ORDER BY started_at DESC LIMIT 1`,
        [member.id, member.guild.id]
      );

      if (recentSession.rows.length > 0 && !isForced) {
        logger.warn(
          `Preventing duplicate onboarding for ${member.user.username} - session created ${recentSession.rows[0].started_at}`
        );
        return false;
      }

      if (isForced && existingSession.rows.length > 0) {
        await database.executeQuery(
          `UPDATE onboarding_sessions SET completed = true, completed_at = NOW() WHERE user_id = $1 AND guild_id = $2 AND completed = false`,
          [member.id, member.guild.id]
        );
        logger.info(
          `Completed existing sessions for forced onboarding of ${member.user.username}`
        );
      }

      await this.createOnboardingSession(member);
      logger.debug(`✅ Created onboarding session for ${member.user.username}`);

      const dmSent = await this.sendInitialContact(member);

      if (!dmSent) {
        await this.markDMFailed(member.id);
        logger.warn(
          `⚠️ Could not DM ${member.user.username} - marked for manual intervention`
        );
        return false;
      }

      logger.argEvent(
        "onboarding-success",
        `✅ Successfully initiated onboarding for ${member.user.username}`
      );
      return true;
    } catch (error) {
      logger.error(
        `❌ Onboarding initiation failed for ${member.user.username}:`,
        error
      );

      try {
        await database.executeQuery(
          "DELETE FROM onboarding_sessions WHERE user_id = $1 AND completed = FALSE",
          [member.id]
        );
      } catch (cleanupError) {
        logger.debug("Could not clean up partial session");
      }

      return false;
    }
  }

  /**
   * FIXED: Creates onboarding session with multiple fallback levels
   */
  async createOnboardingSession(member) {
    try {
      try {
        await database.executeQuery(
          `INSERT INTO onboarding_sessions (user_id, guild_id, current_question, responses, personality_scores, observer_response, dm_failed, started_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            member.id,
            member.guild.id,
            0,
            JSON.stringify([]),
            JSON.stringify({ seeker: 0, isolated: 0, aware: 0, lost: 0 }),
            null,
            false,
            new Date(),
          ]
        );
        logger.debug("✅ Created session with all DM tracking fields");
        return;
      } catch (dmFieldError) {
        logger.debug("DM tracking fields not available, trying fallback...");
      }

      try {
        await database.executeQuery(
          `INSERT INTO onboarding_sessions (user_id, guild_id, current_question, responses, personality_scores, observer_response, started_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            member.id,
            member.guild.id,
            0,
            JSON.stringify([]),
            JSON.stringify({ seeker: 0, isolated: 0, aware: 0, lost: 0 }),
            null,
            new Date(),
          ]
        );
        logger.debug("✅ Created session without DM tracking fields");
        return;
      } catch (observerFieldError) {
        logger.debug("Observer field not available, trying basic fallback...");
      }

      await database.executeQuery(
        `INSERT INTO onboarding_sessions (user_id, guild_id, current_question, responses, personality_scores, started_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          member.id,
          member.guild.id,
          0,
          JSON.stringify([]),
          JSON.stringify({ seeker: 0, isolated: 0, aware: 0, lost: 0 }),
          new Date(),
        ]
      );
      logger.debug("✅ Created session with minimal fields");
    } catch (error) {
      logger.error("Failed to create onboarding session:", error);
      throw error;
    }
  }

  /**
   * FIXED: Gets existing onboarding session with better column handling
   */
  async getOnboardingSession(userId) {
    try {
      let result;
      try {
        result = await database.executeQuery(
          `SELECT id, user_id, guild_id, current_question, responses, personality_scores, observer_response, dm_failed, started_at, completed, completed_at, generated_nickname, is_observer FROM onboarding_sessions WHERE user_id = $1 AND completed = FALSE ORDER BY started_at DESC LIMIT 1`,
          [userId]
        );
      } catch (columnError) {
        result = await database.executeQuery(
          `SELECT id, user_id, guild_id, current_question, responses, personality_scores, started_at, completed FROM onboarding_sessions WHERE user_id = $1 AND completed = FALSE ORDER BY started_at DESC LIMIT 1`,
          [userId]
        );
      }

      if (result.rows.length === 0) return null;

      const session = result.rows[0];
      session.responses = this.safeParseJSON(session.responses, []);
      session.personality_scores = this.safeParseJSON(
        session.personality_scores,
        { seeker: 0, isolated: 0, aware: 0, lost: 0 }
      );
      session.observer_response = session.observer_response || null;
      session.dm_failed = session.dm_failed || false;
      session.generated_nickname = session.generated_nickname || null;
      session.is_observer = session.is_observer || false;

      return session;
    } catch (error) {
      logger.error("Error getting onboarding session:", error);
      return null;
    }
  }

  /**
   * NEW: Safe JSON parsing with proper fallbacks
   */
  safeParseJSON(value, defaultValue) {
    if (value === null || value === undefined || value === "") {
      return defaultValue;
    }

    if (typeof value === "object") {
      return value;
    }

    if (typeof value === "string") {
      if (value === "null" || value === "undefined" || value.trim() === "") {
        return defaultValue;
      }

      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
          return defaultValue;
        }
        if (
          typeof defaultValue === "object" &&
          !Array.isArray(defaultValue) &&
          Array.isArray(parsed)
        ) {
          return defaultValue;
        }
        return parsed;
      } catch (parseError) {
        return defaultValue;
      }
    }

    return defaultValue;
  }

  /**
   * Marks a session as having DM delivery issues
   */
  async markDMFailed(userId) {
    try {
      await database.executeQuery(
        `UPDATE onboarding_sessions SET dm_failed = TRUE, dm_failed_at = $1 WHERE user_id = $2 AND completed = FALSE`,
        [new Date(), userId]
      );
    } catch (error) {
      logger.debug(
        "Could not mark DM as failed in database - DM tracking columns may not exist"
      );
    }
  }

  /**
   * Sends initial mysterious contact message with better error handling
   */
  async sendInitialContact(member) {
    try {
      const initialMessages = [
        "I need to ask you something...",
        "There are questions that need answering...",
        "Your presence here isn't coincidence...",
        "Something about you is... different.",
        "I've been waiting for someone like you...",
      ];

      const selectedMessage =
        initialMessages[Math.floor(Math.random() * initialMessages.length)];
      const beginButton = new ButtonBuilder()
        .setCustomId(`begin_assessment_${member.id}`)
        .setLabel("🔮 Begin Enhanced Assessment")
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(beginButton);
      const embed = new EmbedBuilder()
        .setColor(0x2c2f33)
        .setDescription(
          `**${selectedMessage}**\n\n*There are questions I must ask before you can be properly... catalogued.*\n\n*This enhanced assessment includes special identification protocols.*`
        )
        .setFooter({
          text: "The assessment will determine your systematic designation.",
        });

      await member.send({ embeds: [embed], components: [row] });

      await messageLogger.logBotMessage(
        member.id,
        member.user.username,
        "onboarding-enhanced-contact",
        selectedMessage,
        "dm",
        member.guild.id
      );
      logger.argEvent(
        "onboarding-dm-sent",
        `📨 Sent enhanced initial contact to ${member.user.username}`
      );

      return true;
    } catch (error) {
      if (error.code === 50007) {
        logger.warn(
          `📪 Cannot send DM to ${member.user.username} - DMs disabled`
        );
      } else {
        logger.error(
          `❌ Failed to send initial contact to ${member.user.username}:`,
          error
        );
      }

      await messageLogger.logBotMessage(
        member.id,
        member.user.username,
        "onboarding-dm-failed",
        `Failed to send DM: ${error.message}`,
        "dm",
        member.guild.id
      );
      return false;
    }
  }

  /**
   * FIXED: Handles begin assessment button click - goes directly to color question
   */
  async handleBeginAssessment(interaction) {
    try {
      const userId = interaction.customId.split("_")[2];

      if (interaction.user.id !== userId) {
        await this.safeReply(interaction, {
          content: "This assessment is not for you...",
          flags: 64,
        });
        return;
      }

      const session = await this.getOnboardingSession(userId);
      if (!session) {
        await this.safeReply(interaction, {
          content: "Assessment session not found. Something went wrong...",
          flags: 64,
        });
        return;
      }

      await this.showObserverModal(
        interaction,
        session,
        "What is your favorite color? (Think carefully about your answer...)",
        1,
        9
      );
    } catch (error) {
      logger.error("Error handling begin assessment:", error);
      await this.safeReply(interaction, {
        content: "The assessment system is... unstable. Try again.",
        flags: 64,
      });
    }
  }

  /**
   * FIXED: Sends the next question with Observer-first flow
   */
  async sendNextQuestion(interaction, session) {
    try {
      const allQuestions = [
        ...this.questionCategories.observer,
        ...this.questionCategories.existential.slice(0, 2),
        ...this.questionCategories.patterns.slice(0, 2),
        ...this.questionCategories.isolation.slice(0, 2),
        ...this.questionCategories.awareness.slice(0, 2),
      ];

      const currentQuestionIndex = session.current_question;
      const totalQuestions = allQuestions.length;

      if (currentQuestionIndex >= totalQuestions) {
        await this.completeAssessment(interaction, session);
        return;
      }

      const question = allQuestions[currentQuestionIndex];
      const questionNumber = currentQuestionIndex + 1;
      const isObserverQuestion = currentQuestionIndex === 0;

      if (isObserverQuestion) {
        await this.showObserverModal(
          interaction,
          session,
          question,
          questionNumber,
          totalQuestions
        );
      } else {
        await this.showRegularQuestion(
          interaction,
          session,
          question,
          questionNumber,
          totalQuestions
        );
      }
    } catch (error) {
      logger.error("Error sending next question:", error);
    }
  }

  /**
   * FIXED: Shows regular multiple choice question with safeReply
   */
  async showRegularQuestion(
    interaction,
    session,
    question,
    questionNumber,
    totalQuestions
  ) {
    try {
      if (!this.client && interaction.client) {
        this.client = interaction.client;
      }

      const embed = new EmbedBuilder()
        .setColor(0x2c2f33)
        .setTitle(`Assessment Question ${questionNumber}/${totalQuestions}`)
        .setDescription(
          `**${question}**\n\n*Choose your response carefully. Each answer contributes to your classification.*`
        )
        .setFooter({ text: "Answer honestly. I can tell when you lie." });

      const yesButton = new ButtonBuilder()
        .setCustomId(
          `answer_yes_${session.user_id}_${session.current_question}`
        )
        .setLabel("Yes")
        .setStyle(ButtonStyle.Success);

      const noButton = new ButtonBuilder()
        .setCustomId(`answer_no_${session.user_id}_${session.current_question}`)
        .setLabel("No")
        .setStyle(ButtonStyle.Danger);

      const maybeButton = new ButtonBuilder()
        .setCustomId(
          `answer_maybe_${session.user_id}_${session.current_question}`
        )
        .setLabel("Sometimes")
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(
        yesButton,
        maybeButton,
        noButton
      );

      const success = await this.safeReply(interaction, {
        embeds: [embed],
        components: [row],
      });

      if (success) {
        logger.argEvent(
          "question-sent",
          `Question ${questionNumber} sent to ${interaction.user.username}`
        );
      } else {
        logger.warn("Failed to send question due to expired interaction");
      }
    } catch (error) {
      logger.error("Error showing regular question:", error);
    }
  }

  /**
   * FIXED: Enhanced handleQuestionResponse with duplicate prevention
   */
  async handleQuestionResponse(interaction) {
    try {
      const [action, answer, userId, questionIndex] =
        interaction.customId.split("_");

      if (interaction.user.id !== userId) {
        await this.safeReply(interaction, {
          content: "This is not your assessment...",
          flags: 64,
        });
        return;
      }

      const session = await this.getOnboardingSession(userId);
      if (!session) {
        await this.safeReply(interaction, {
          content: "Assessment session not found.",
          flags: 64,
        });
        return;
      }

      const existingResponse = session.responses.find(
        (r) => r.questionIndex === parseInt(questionIndex)
      );
      if (existingResponse) {
        await this.safeReply(interaction, {
          content: "You have already answered this question.",
          flags: 64,
        });
        return;
      }

      await this.recordResponse(session, parseInt(questionIndex), answer);
      await this.updateSessionProgress(session.id, parseInt(questionIndex) + 1);

      const updatedSession = await this.getOnboardingSession(userId);

      if (updatedSession.current_question >= 9) {
        await this.completeAssessment(interaction, updatedSession);
      } else {
        await this.sendNextQuestion(interaction, updatedSession);
      }
    } catch (error) {
      logger.error("Error handling question response:", error);

      try {
        await this.safeReply(interaction, {
          content: "Error processing your response. Please try again.",
          flags: 64,
        });
      } catch (replyError) {
        logger.error("Failed to send error response:", replyError);
      }
    }
  }

  /**
   * Records user response and updates personality scoring
   */
  async recordResponse(session, questionIndex, answer) {
    try {
      session.responses.push({ questionIndex, answer, timestamp: new Date() });

      const scores = { ...session.personality_scores };

      let category;
      if (questionIndex >= 1 && questionIndex < 3) category = "isolated";
      else if (questionIndex >= 3 && questionIndex < 5) category = "seeker";
      else if (questionIndex >= 5 && questionIndex < 7) category = "aware";
      else if (questionIndex >= 7 && questionIndex < 9) category = "lost";

      if (category) {
        switch (answer) {
          case "yes":
            scores[category] += 2;
            break;
          case "maybe":
            scores[category] += 1;
            break;
          case "no":
            break;
        }
      }

      await database.executeQuery(
        `UPDATE onboarding_sessions SET responses = $1, personality_scores = $2 WHERE id = $3`,
        [JSON.stringify(session.responses), JSON.stringify(scores), session.id]
      );
    } catch (error) {
      logger.error("Error recording response:", error);
    }
  }

  /**
   * Updates session progress
   */
  async updateSessionProgress(sessionId, nextQuestion) {
    try {
      await database.executeQuery(
        "UPDATE onboarding_sessions SET current_question = $1 WHERE id = $2",
        [nextQuestion, sessionId]
      );
    } catch (error) {
      logger.error("Error updating session progress:", error);
    }
  }

  /**
   * FIXED: Shows special Observer question as a modal - now shows as Question 1
   */
  async showObserverModal(
    interaction,
    session,
    question,
    questionNumber,
    totalQuestions
  ) {
    try {
      if (!this.isInteractionValid(interaction)) {
        logger.warn("Cannot show modal - interaction expired");
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`observer_modal_${session.user_id}`)
        .setTitle(`Question ${questionNumber}/${totalQuestions}`);

      const colorInput = new TextInputBuilder()
        .setCustomId("observer_color_input")
        .setLabel("What is your favorite color?")
        .setPlaceholder("Think carefully about your answer...")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

      const row = new ActionRowBuilder().addComponents(colorInput);
      modal.addComponents(row);

      // Always try to show the modal directly first
      try {
        await interaction.showModal(modal);
        logger.info(
          `✅ Showed Observer modal directly to ${interaction.user.username}`
        );
        return;
      } catch (modalError) {
        logger.warn(
          `Cannot show modal directly (${modalError.message}), showing button fallback`
        );
      }

      // Fallback: Show button if direct modal fails
      const observerButton = new ButtonBuilder()
        .setCustomId(`show_observer_modal_${session.user_id}`)
        .setLabel("🎨 Answer Question")
        .setStyle(ButtonStyle.Primary);

      const buttonRow = new ActionRowBuilder().addComponents(observerButton);

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`Question ${questionNumber}/${totalQuestions}`)
        .setDescription(
          `**${question}**\n\n*This is the first question of your assessment.*`
        )
        .setFooter({ text: "Click below to enter your answer." });

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          embeds: [embed],
          components: [buttonRow],
        });
      } else {
        await interaction.reply({ embeds: [embed], components: [buttonRow] });
      }

      logger.info(
        `✅ Showed Observer modal button fallback to ${interaction.user.username}`
      );
    } catch (error) {
      logger.error("Error showing Observer modal:", error);
    }
  }

  /**
   * Handles the observer modal button click
   */
  async handleObserverModalButton(interaction) {
    try {
      const userId = interaction.customId.split("_")[3];

      if (interaction.user.id !== userId) {
        await this.safeReply(interaction, {
          content: "This question is not for you...",
          flags: 64,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`observer_modal_${userId}`)
        .setTitle("Final Assessment Question");

      const colorInput = new TextInputBuilder()
        .setCustomId("observer_color_input")
        .setLabel("What is your favorite color?")
        .setPlaceholder("Think carefully about your answer...")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

      const row = new ActionRowBuilder().addComponents(colorInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    } catch (error) {
      logger.error("Error showing observer modal:", error);
    }
  }

  /**
   * FIXED: Handles observer modal submission - STREAMLINED Observer flow
   */
  async handleObserverModal(interaction) {
    try {
      const userId = interaction.customId.split("_")[2];

      if (interaction.user.id !== userId) {
        await this.safeReply(interaction, {
          content: "This response is not yours to give...",
          flags: 64,
        });
        return;
      }

      const session = await this.getOnboardingSession(userId);
      if (!session) {
        await this.safeReply(interaction, {
          content: "Assessment session not found.",
          flags: 64,
        });
        return;
      }

      const colorResponse = interaction.fields.getTextInputValue(
        "observer_color_input"
      );

      await database.executeQuery(
        `UPDATE onboarding_sessions SET observer_response = $1 WHERE id = $2`,
        [colorResponse, session.id]
      );

      const isObserverTrigger =
        colorResponse.toLowerCase().trim() === "observer";

      if (isObserverTrigger) {
        console.log(
          `🔍 Observer keyword detected from ${interaction.user.username} - SKIPPING TO CUSTOM NAME`
        );

        await database.executeQuery(
          `UPDATE onboarding_sessions SET completed = TRUE, completed_at = $1, is_observer = TRUE, current_question = 9 WHERE id = $2`,
          [new Date(), session.id]
        );

        await this.showCustomObserverCreation(interaction, userId);
      } else {
        console.log(
          `🎭 Normal response from ${interaction.user.username} - continuing with assessment`
        );

        await this.updateSessionProgress(session.id, 1);
        const updatedSession = await this.getOnboardingSession(userId);
        await this.sendNextQuestion(interaction, updatedSession);
      }
    } catch (error) {
      logger.error("Error handling observer modal:", error);
      await this.safeReply(interaction, {
        content: "The assessment system encountered an error...",
        flags: 64,
      });
    }
  }

  /**
   * FIXED: Normal assessment completion for 99% of users
   */
  async completeAssessment(interaction, session) {
    try {
      console.log("🧠 Starting normal ARG assessment completion...");

      const scores = session.personality_scores || {};
      const dominantTrait =
        Object.keys(scores).length > 0
          ? Object.keys(scores).reduce((a, b) =>
              (scores[a] || 0) > (scores[b] || 0) ? a : b
            )
          : "lost";

      console.log("🔮 Psychological analysis:", {
        scores,
        dominantTrait,
        finalResponse: session.observer_response,
      });

      const argName = await this.generateProfileBasedNickname(
        scores,
        session.responses,
        session.guild_id,
        session.user_id
      );
      console.log(`✅ Generated ARG name: ${argName}`);

      const embed = new EmbedBuilder()
        .setColor(0x2c2f33)
        .setTitle("🧠 Psychological Assessment Complete")
        .setDescription(
          `**Analysis complete.**\n\n**Your designated identity:** \`${argName}\`\n\n*This designation has been carefully selected based on your psychological profile.*`
        )
        .addFields([
          {
            name: "Assessment Results",
            value: this.formatPersonalityResults(scores),
            inline: false,
          },
          {
            name: "Dominant Trait",
            value: this.getTraitDescription(dominantTrait),
            inline: true,
          },
          {
            name: "Final Response",
            value: `"${session.observer_response || "None given"}"`,
            inline: true,
          },
        ])
        .setFooter({ text: "Click below to apply your designation." });

      const acceptButton = new ButtonBuilder()
        .setCustomId(`accept_nickname_${session.user_id}`)
        .setLabel("🎭 Accept Designation")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(acceptButton);

      const success = await this.safeReply(interaction, {
        embeds: [embed],
        components: [row],
      });

      if (!success) {
        try {
          if (!this.client) {
            logger.error("No client available for DM fallback");
            return;
          }
          const user = await this.client.users.fetch(session.user_id);
          await user.send({ embeds: [embed], components: [row] });
          logger.info(
            `Sent assessment completion via DM to ${interaction.user.username}`
          );
        } catch (dmError) {
          logger.error("Failed to send assessment completion via DM:", dmError);
        }
      }

      await database.executeQuery(
        `UPDATE onboarding_sessions SET generated_nickname = $1, completed = TRUE, completed_at = $2, is_observer = FALSE WHERE id = $3`,
        [argName, new Date(), session.id]
      );

      await messageLogger.logBotMessage(
        session.user_id,
        interaction.user.username,
        "onboarding-complete-normal",
        `Normal assessment complete. Generated ARG name: ${argName}`,
        "dm",
        session.guild_id
      );
      logger.argEvent(
        "onboarding-complete",
        `✅ Normal ARG assessment complete for ${interaction.user.username}: ${argName}`
      );
    } catch (error) {
      logger.error("Error completing normal assessment:", error);
      await this.safeReply(interaction, {
        content:
          "The assessment system encountered an error. Your designation is... undefined.",
        flags: 64,
      });
    }
  }

  /**
   * NEW: Direct custom Observer creation (skips generated name choice)
   * FIXED: Updated to use "Obs-Username" format and preserve case
   */
  async showCustomObserverCreation(interaction, userId) {
    try {
      console.log(
        `🎨 Showing direct custom Observer creation for ${interaction.user.username}`
      );

      const embed = new EmbedBuilder()
        .setColor(0x800080)
        .setTitle("🔍 Observer Protocol Activated")
        .setDescription(
          `**Observer classification confirmed.**\n\n*You answered "observer" - immediate Observer status granted.*\n\n**Create your Observer designation:**`
        )
        .addFields([
          {
            name: "Format",
            value: `**\`Obs-Username\`**\nYour custom Observer name`,
            inline: true,
          },
          {
            name: "Example",
            value: `**\`Obs-Cybin\`**\nCustom designation format`,
            inline: true,
          },
        ])
        .setFooter({ text: "Enter your custom Observer name below." });

      const modal = new ModalBuilder()
        .setCustomId(`direct_observer_modal_${userId}`)
        .setTitle("Create Observer Designation");

      const customInput = new TextInputBuilder()
        .setCustomId("direct_observer_input")
        .setLabel("Enter your Observer name:")
        .setPlaceholder("Example: Cybin, Watcher, Sentinel")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(20);

      const row = new ActionRowBuilder().addComponents(customInput);
      modal.addComponents(row);

      await this.safeReply(interaction, { embeds: [embed] });

      setTimeout(async () => {
        try {
          await interaction.followUp({
            content: "Click below to create your Observer designation:",
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`show_direct_observer_modal_${userId}`)
                  .setLabel("🎨 Create Observer Name")
                  .setStyle(ButtonStyle.Primary)
              ),
            ],
          });
        } catch (followupError) {
          logger.error("Error showing Observer modal button:", followupError);
        }
      }, 1000);
    } catch (error) {
      logger.error("Error showing custom Observer creation:", error);
      await this.safeReply(interaction, {
        content: "Observer creation system failed. Contact administrators.",
        flags: 64,
      });
    }
  }

  /**
   * Handles the direct observer modal button click
   */
  async handleDirectObserverModalButton(interaction) {
    try {
      const userId = interaction.customId.split("_")[4];

      if (interaction.user.id !== userId) {
        await this.safeReply(interaction, {
          content: "This Observer creation is not for you...",
          flags: 64,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`direct_observer_modal_${userId}`)
        .setTitle("Create Observer Designation");

      const customInput = new TextInputBuilder()
        .setCustomId("direct_observer_input")
        .setLabel("Enter your Observer name:")
        .setPlaceholder("Example: Cybin, Watcher, Sentinel")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(20);

      const row = new ActionRowBuilder().addComponents(customInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    } catch (error) {
      logger.error("Error showing direct observer modal:", error);
      await this.safeReply(interaction, {
        content: "Failed to show Observer creation modal. Please try again.",
        flags: 64,
      });
    }
  }

  /**
   * FIXED: Handles direct Observer modal submission (streamlined flow)
   * UPDATED: Uses "Obs-Username" format and preserves case
   */
  async handleDirectObserverModal(interaction) {
    try {
      const userId = interaction.customId.split("_")[3];

      if (interaction.user.id !== userId) {
        await this.safeReply(interaction, {
          content: "This Observer creation is not yours to complete...",
          flags: 64,
        });
        return;
      }

      const customInput = interaction.fields.getTextInputValue(
        "direct_observer_input"
      );

      if (!customInput || customInput.trim().length === 0) {
        await this.safeReply(interaction, {
          content: "You must enter an Observer name. Please try again.",
          flags: 64,
        });
        return;
      }

      const sanitizedCustom = this.sanitizeObserverInput(customInput);

      if (sanitizedCustom === "UNKNOWN" || sanitizedCustom === "UNNAMED") {
        await this.safeReply(interaction, {
          content: `Invalid input "${customInput}". Please use letters and numbers only.`,
          flags: 64,
        });
        return;
      }

      // FIXED: NEW FORMAT: Obs-Username and preserve case
      const customName = `Obs-${sanitizedCustom}`;

      await this.completeObserverAssessment(
        interaction,
        userId,
        customName,
        false
      );

      logger.argEvent(
        "direct-observer-created",
        `${interaction.user.username} created direct Observer name: ${customName}`
      );
    } catch (error) {
      logger.error("Error handling direct Observer modal:", error);
      await this.safeReply(interaction, {
        content: "Observer creation failed. Please try again.",
        flags: 64,
      });
    }
  }

  /**
   * FIXED: Observer choice system with updated format
   */
  async showObserverChoiceSystem(interaction, session) {
    try {
      const descriptors = [
        "Watching",
        "Seeing",
        "Knowing",
        "Waiting",
        "Recording",
        "Studying",
        "Analyzing",
      ];
      const randomDescriptor =
        descriptors[Math.floor(Math.random() * descriptors.length)];
      // FIXED: NEW FORMAT: Obs-Username and preserve case
      const generatedName = `Obs-${randomDescriptor}`;

      const embed = new EmbedBuilder()
        .setColor(0x800080)
        .setTitle("🔍 Observer Protocol Detected")
        .setDescription(
          `**Your response has triggered Observer classification...**\n\n*You answered: "${session.observer_response}"*\n\n**Choose your Observer designation:**`
        )
        .addFields([
          {
            name: "Generated Name",
            value: `**\`${generatedName}\`**\nSystem-assigned Observer designation`,
            inline: true,
          },
          {
            name: "Custom Name",
            value: `**\`Obs-Custom\`**\nCreate your own designation`,
            inline: true,
          },
        ])
        .setFooter({
          text: "Both options grant full Observer status and permissions.",
        });

      const generatedButton = new ButtonBuilder()
        .setCustomId(`accept_generated_${session.user_id}_${generatedName}`)
        .setLabel(` Accept ${generatedName}`)
        .setStyle(ButtonStyle.Success);

      const customButton = new ButtonBuilder()
        .setCustomId(`create_custom_${session.user_id}`)
        .setLabel(" Create Custom Name")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(
        generatedButton,
        customButton
      );

      await this.safeReply(interaction, { embeds: [embed], components: [row] });

      logger.argEvent(
        "observer-choice",
        `Showing Observer choice system to ${interaction.user.username}: Generated=${generatedName}`
      );
    } catch (error) {
      logger.error("Error showing Observer choice system:", error);
      await this.safeReply(interaction, {
        content: "The Observer classification system encountered an error...",
        flags: 64,
      });
    }
  }

  /**
   * Handles Observer choice buttons
   */
  async handleObserverChoice(interaction) {
    try {
      console.log(`🔍 Observer choice button clicked: ${interaction.customId}`);

      const customIdParts = interaction.customId.split("_");

      if (customIdParts[0] === "accept" && customIdParts[1] === "generated") {
        await this.handleGeneratedObserverAcceptance(interaction);
      } else if (
        customIdParts[0] === "create" &&
        customIdParts[1] === "custom"
      ) {
        await this.handleCustomObserverCreation(interaction);
      } else {
        await this.safeReply(interaction, {
          content: "Unknown Observer choice option. Please try again.",
          flags: 64,
        });
      }
    } catch (error) {
      logger.error("Error handling Observer choice:", error);
      await this.safeReply(interaction, {
        content:
          "Observer choice processing failed. Please contact an administrator.",
        flags: 64,
      });
    }
  }

  /**
   * Handles generated Observer name acceptance
   */
  async handleGeneratedObserverAcceptance(interaction) {
    try {
      const [action, type, userId, ...nameParts] =
        interaction.customId.split("_");
      const generatedName = nameParts.join("_");

      if (interaction.user.id !== userId) {
        await this.safeReply(interaction, {
          content: "This designation is not yours to claim...",
          flags: 64,
        });
        return;
      }

      await this.completeObserverAssessment(
        interaction,
        userId,
        generatedName,
        true
      );
    } catch (error) {
      logger.error("Error handling generated Observer acceptance:", error);
      await this.safeReply(interaction, {
        content: "The Observer designation system failed...",
        flags: 64,
      });
    }
  }

  /**
   * Handles custom Observer name creation
   */
  async handleCustomObserverCreation(interaction) {
    try {
      const userId = interaction.customId.split("_")[2];

      if (interaction.user.id !== userId) {
        await this.safeReply(interaction, {
          content: "This customization is not yours to make...",
          flags: 64,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`custom_observer_modal_${userId}`)
        .setTitle("Create Custom Observer Name");

      const customInput = new TextInputBuilder()
        .setCustomId("custom_observer_input")
        .setLabel("Enter your custom Observer designation:")
        .setPlaceholder("Example: WATCHER, SENTINEL, GUARDIAN")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(20);

      const row = new ActionRowBuilder().addComponents(customInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    } catch (error) {
      logger.error("Error showing custom Observer modal:", error);
      await this.safeReply(interaction, {
        content:
          "Failed to show custom name creator. Try the generated name instead.",
        flags: 64,
      });
    }
  }

  /**
   * FIXED: Handles custom Observer name modal submission
   * UPDATED: Uses "Obs-Username" format and preserves case
   */
  async handleCustomObserverModal(interaction) {
    try {
      const userId = interaction.customId.split("_")[3];

      if (interaction.user.id !== userId) {
        await this.safeReply(interaction, {
          content: "This customization is not yours to complete...",
          flags: 64,
        });
        return;
      }

      const customInput = interaction.fields.getTextInputValue(
        "custom_observer_input"
      );

      if (!customInput || customInput.trim().length === 0) {
        await this.safeReply(interaction, {
          content: "You must enter a custom name. Please try again.",
          flags: 64,
        });
        return;
      }

      const sanitizedCustom = this.sanitizeObserverInput(customInput);

      if (sanitizedCustom === "UNKNOWN" || sanitizedCustom === "UNNAMED") {
        await this.safeReply(interaction, {
          content: `Invalid input "${customInput}". Please use letters and numbers only.`,
          flags: 64,
        });
        return;
      }

      // FIXED: NEW FORMAT: Obs-Username and preserve case
      const customName = `Obs-${sanitizedCustom}`;

      await this.completeObserverAssessment(
        interaction,
        userId,
        customName,
        false
      );

      logger.argEvent(
        "custom-observer-created",
        `${interaction.user.username} created custom Observer name: ${customName}`
      );
    } catch (error) {
      logger.error("Error handling custom Observer modal:", error);

      if (!interaction.replied && !interaction.deferred) {
        await this.safeReply(interaction, {
          content:
            "The custom Observer creation failed. Please try the generated name instead.",
          flags: 64,
        });
      }
    }
  }

  /**
   * Completes Observer assessment with chosen name and assigns "The Observers" role
   */
  async completeObserverAssessment(
    interaction,
    userId,
    observerName,
    isGenerated
  ) {
    try {
      const sessionResult = await database.executeQuery(
        "SELECT * FROM onboarding_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 1",
        [userId]
      );

      if (sessionResult.rows.length === 0) {
        await this.safeReply(interaction, {
          content: "Assessment session not found...",
          flags: 64,
        });
        return;
      }

      const session = sessionResult.rows[0];

      await database.executeQuery(
        `UPDATE onboarding_sessions SET generated_nickname = $1, completed = TRUE, completed_at = $2, is_observer = TRUE WHERE id = $3`,
        [observerName, new Date(), session.id]
      );

      // NEW: Assign "The Observers" role
      let roleAssignmentStatus = "❌ Failed to assign role";
      try {
        const guild = interaction.client.guilds.cache.get(session.guild_id);
        if (guild) {
          const member = await guild.members.fetch(userId);
          const observerRole = guild.roles.cache.find(
            (role) => role.name === "The Observers"
          );

          if (observerRole && member) {
            await member.roles.add(
              observerRole,
              `Observer Protocol: ${observerName}`
            );
            roleAssignmentStatus = "✅ Added to The Observers role";
            console.log(
              `🎭 AUTO-ROLE: Added ${member.user.username} to "The Observers" role`
            );
          } else if (!observerRole) {
            roleAssignmentStatus = "⚠️ Role 'The Observers' not found";
            console.log(
              `⚠️ Role "The Observers" not found in guild ${guild.name}`
            );
          }
        }
      } catch (roleError) {
        console.log(`❌ Failed to assign Observer role: ${roleError.message}`);
        roleAssignmentStatus = `❌ Role assignment failed: ${roleError.message}`;
      }

      const embed = new EmbedBuilder()
        .setColor(0x800080)
        .setTitle("🔍 Observer Protocol Activated")
        .setDescription(
          `**Observer designation confirmed:**\n\n**\`${observerName}\`**\n\n*${
            isGenerated
              ? "System-generated designation accepted."
              : "Custom designation created."
          } Observer status: ACTIVE*`
        )
        .addFields([
          {
            name: "Observer Classification",
            value: "Enhanced Perception Protocols",
            inline: true,
          },
          { name: "Access Level", value: "Special Permissions", inline: true },
          {
            name: "Designation Type",
            value: isGenerated ? "Generated" : "Custom",
            inline: true,
          },
          {
            name: "Role Assignment",
            value: roleAssignmentStatus,
            inline: false,
          },
        ])
        .setFooter({ text: "Click below to apply your Observer designation." });

      const acceptButton = new ButtonBuilder()
        .setCustomId(`accept_nickname_${userId}`)
        .setLabel("🔍 Apply Observer Designation")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(acceptButton);

      const success = await this.safeReply(interaction, {
        embeds: [embed],
        components: [row],
      });

      // NEW: Clean up previous Observer creation messages to prevent reuse
      try {
        // Delete the message that contained the "Create Observer Name" button
        if (interaction.message) {
          await interaction.message.delete();
          console.log(
            `🧹 CLEANUP: Deleted Observer creation message for ${interaction.user.username}`
          );
        }
      } catch (deleteError) {
        console.log(
          `⚠️ Could not delete Observer creation message: ${deleteError.message}`
        );
      }

      if (!success) {
        try {
          if (!this.client) {
            logger.error("No client available for Observer completion DM");
            return;
          }
          const user = await this.client.users.fetch(userId);
          await user.send({ embeds: [embed], components: [row] });
          logger.info(
            `Sent Observer completion via DM to ${interaction.user.username}`
          );
        } catch (dmError) {
          logger.error("Failed to send Observer completion via DM:", dmError);
        }
      }

      await messageLogger.logBotMessage(
        userId,
        interaction.user.username,
        "onboarding-observer-complete-choice",
        `Observer assessment complete with choice. Name: ${observerName} (${
          isGenerated ? "Generated" : "Custom"
        }) | Role: ${roleAssignmentStatus}`,
        "dm",
        session.guild_id
      );
      logger.argEvent(
        "observer-complete",
        `Observer ${interaction.user.username} chose ${observerName} (${
          isGenerated ? "Generated" : "Custom"
        }) | ${roleAssignmentStatus}`
      );
    } catch (error) {
      logger.error("Error completing Observer assessment:", error);
      await this.safeReply(interaction, {
        content: "The Observer protocol completion failed...",
        flags: 64,
      });
    }
  }

  /**
   * Sanitizes user input for Observer custom names (preserves case)
   */
  sanitizeObserverInput(input) {
    if (!input || typeof input !== "string") {
      return "UNKNOWN";
    }

    // Remove special characters, keep letters, numbers, spaces - PRESERVE CASE
    let cleaned = input.replace(/[^a-zA-Z0-9\s]/g, "").trim();

    // Replace spaces with underscores
    cleaned = cleaned.replace(/\s+/g, "_");
    cleaned = cleaned.replace(/_+/g, "_");
    cleaned = cleaned.replace(/^_|_$/g, "");

    if (cleaned.length > 20) {
      cleaned = cleaned.substring(0, 20);
    }

    if (cleaned.length === 0) {
      return "UNNAMED";
    }

    return cleaned;
  }

  /**
   * Generates systematic ARG name based on psychological profile
   */
  async generateProfileBasedNickname(
    scores,
    responses,
    guildId,
    userId = null
  ) {
    try {
      try {
        const argNamingSystem = require("./argNamingSystem");

        const psychProfile = {
          personality_scores: scores,
          responses: responses,
          user_id: userId,
          guild_id: guildId,
          timestamp: new Date().toISOString(),
        };

        const argName = await argNamingSystem.generateUniqueName(
          psychProfile,
          guildId
        );
        return argName;
      } catch (argNamingError) {
        throw argNamingError;
      }
    } catch (error) {
      logger.error("ARG naming system failed:", error);

      const timestamp = Date.now().toString().slice(-4);
      const dominantTrait =
        Object.keys(scores).length > 0
          ? Object.keys(scores).reduce((a, b) =>
              (scores[a] || 0) > (scores[b] || 0) ? a : b
            )
          : "lost";

      const prefix = this.getTraitPrefix(dominantTrait);
      const fallbackName = `${prefix}-${timestamp}-TEMP-∅`;

      logger.warn(`Using emergency fallback ARG name: ${fallbackName}`);
      return fallbackName;
    }
  }

  /**
   * Gets trait prefix for emergency fallback generation
   */
  getTraitPrefix(trait) {
    const prefixes = {
      seeker: "SEEK",
      isolated: "SUBJ",
      aware: "NODE",
      lost: "LOST",
    };
    return prefixes[trait] || "SPEC";
  }

  /**
   * Format personality results for display
   */
  formatPersonalityResults(scores) {
    if (!scores || Object.keys(scores).length === 0) {
      return "No psychological data recorded";
    }

    const traits = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([trait, score]) => `${trait}: ${score}`)
      .join(" | ");

    return traits;
  }

  /**
   * Get trait description
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

  /**
   * FIXED: Handle nickname acceptance button with better session handling and message cleanup
   */
  async handleNicknameAcceptance(interaction) {
    try {
      const userId = interaction.customId.split("_")[2];

      if (interaction.user.id !== userId) {
        await this.safeReply(interaction, {
          content: "This designation is not yours to accept...",
          flags: 64,
        });
        return;
      }

      // FIXED: Look for ANY session (completed or not) with a generated nickname
      let session = await database.executeQuery(
        "SELECT * FROM onboarding_sessions WHERE user_id = $1 AND generated_nickname IS NOT NULL ORDER BY started_at DESC LIMIT 1",
        [userId]
      );

      // If no session with nickname found, try to find the latest session and mark it completed
      if (session.rows.length === 0) {
        logger.warn(
          `No session with nickname found for ${interaction.user.username}, checking latest session`
        );

        const latestSession = await database.executeQuery(
          "SELECT * FROM onboarding_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 1",
          [userId]
        );

        if (latestSession.rows.length === 0) {
          await this.safeReply(interaction, {
            content:
              "Assessment session not found. Please contact an administrator.",
            flags: 64,
          });
          return;
        }

        // Mark the session as completed if it's not already
        if (!latestSession.rows[0].completed) {
          await database.executeQuery(
            "UPDATE onboarding_sessions SET completed = TRUE, completed_at = $1 WHERE id = $2",
            [new Date(), latestSession.rows[0].id]
          );
        }

        session = latestSession;
      }

      const sessionData = session.rows[0];
      const argName = sessionData.generated_nickname;
      const isObserver = sessionData.is_observer || false;

      if (!argName) {
        await this.safeReply(interaction, {
          content: "No designation found. Please contact an administrator.",
          flags: 64,
        });
        return;
      }

      const guild = interaction.client.guilds.cache.get(sessionData.guild_id);
      if (!guild) {
        await this.safeReply(interaction, {
          content: "Cannot access the server to apply designation...",
          flags: 64,
        });
        return;
      }

      const member = await guild.members.fetch(userId);
      if (!member) {
        await this.safeReply(interaction, {
          content: "Cannot find your server presence...",
          flags: 64,
        });
        return;
      }

      if (
        !guild.members.me.permissions.has("ManageNicknames") ||
        member.roles.highest.position >= guild.members.me.roles.highest.position
      ) {
        await this.safeReply(interaction, {
          content:
            "I lack the authority to apply your designation. Contact the administrators...",
          flags: 64,
        });
        return;
      }

      await member.setNickname(
        argName,
        isObserver
          ? "Observer Protocol Assignment"
          : "ARG Systematic Designation Assignment"
      );

      global.protectedNicknames = global.protectedNicknames || new Map();
      global.protectedNicknames.set(userId, {
        guildId: guild.id,
        protectedNickname: argName,
        assignedAt: new Date(),
        userId: userId,
        username: member.user.username,
        source: isObserver ? "observer-onboarding" : "arg-onboarding",
      });

      console.log(
        `🛡️ AUTO-PROTECTION ADDED: ${member.user.username} → "${argName}" (${
          isObserver ? "Observer" : "ARG"
        } onboarding)`
      );

      let successMessage;
      if (isObserver) {
        successMessage = `🔍 **Observer Protocol Activated**

You are now designated as **\`${argName}\`**.

**Observer Classification Complete:**
• Enhanced perception protocols: ACTIVE
• Data collection authorization: GRANTED
• Special access permissions: ENABLED
• **🛡️ Identity protection: ENABLED**

*You see what others cannot. Your identity is now protected and locked. Any attempts to change your designation will be automatically reverted. Your watch begins now.*`;
      } else {
        successMessage = `✅ **Systematic Designation Applied**

You are now designated as **\`${argName}\`**.

**Classification Details:**
• Systematic identification: COMPLETE
• Psychological profile: RECORDED
• Experimental framework: ACTIVE
• **🛡️ Identity protection: ENABLED**

*The classification is complete. Your identity is now locked and protected against unauthorized changes. Welcome to the experimental framework.*`;
      }

      // Send success message and then clean up interactive messages
      await this.safeReply(interaction, { content: successMessage, flags: 64 });

      // NEW: Clean up all interactive messages after successful designation application
      try {
        // Delete the message that contained the "Apply Designation" button
        if (interaction.message) {
          await interaction.message.delete();
          console.log(
            `🧹 CLEANUP: Deleted designation application message for ${member.user.username}`
          );
        }

        // Also try to clean up any other assessment-related messages in the DM
        // This will help remove lingering buttons that could be reused
        await this.cleanupAssessmentMessages(interaction.user, sessionData.id);
      } catch (deleteError) {
        console.log(
          `⚠️ Could not delete designation application message: ${deleteError.message}`
        );
      }

      await messageLogger.logBotMessage(
        userId,
        member.user.username,
        isObserver
          ? "onboarding-observer-applied-protected"
          : "onboarding-arg-name-applied-protected",
        `${
          isObserver ? "Observer" : "ARG"
        } name applied with protection: ${argName}`,
        "dm",
        sessionData.guild_id
      );

      try {
        await database.executeQuery(
          `INSERT INTO nickname_assignments (user_id, guild_id, old_nickname, new_nickname, assigned_at, assignment_reason) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            guild.id,
            member.displayName,
            argName,
            new Date(),
            isObserver
              ? "Observer Protocol via Enhanced Assessment - AUTO-PROTECTED"
              : "ARG Systematic Designation via Psychological Assessment - AUTO-PROTECTED",
          ]
        );
      } catch (logError) {
        logger.debug(
          "Could not log to nickname_assignments table:",
          logError.message
        );
      }

      if (isObserver) {
        try {
          await database.executeQuery(
            `INSERT INTO observer_assignments (user_id, guild_id, observer_name, color_response, onboarding_session_id) VALUES ($1, $2, $3, $4, $5)`,
            [
              userId,
              guild.id,
              argName,
              sessionData.observer_response,
              sessionData.id,
            ]
          );
        } catch (observerLogError) {
          logger.debug("Could not log to observer_assignments table");
        }
      }

      logger.argEvent(
        "onboarding-protected",
        `Applied ${isObserver ? "Observer" : "ARG"} name "${argName}" to ${
          member.user.username
        } with AUTO-PROTECTION`
      );
    } catch (error) {
      logger.error("Error applying ARG name with protection:", error);
      await this.safeReply(interaction, {
        content: "The designation ritual failed. Contact the administrators...",
        flags: 64,
      });
    }
  }

  /**
   * NEW: Clean up assessment-related messages to prevent button reuse
   */
  async cleanupAssessmentMessages(user, sessionId) {
    try {
      // Send a final cleanup message to replace any lingering interactive elements
      const cleanupEmbed = new EmbedBuilder()
        .setColor(0x2c2f33)
        .setTitle("🧹 Assessment Complete")
        .setDescription(
          "*All assessment interactions have been completed and secured.*\n\n*Your designation is now active and protected.*"
        )
        .setFooter({ text: "This session has been closed." })
        .setTimestamp();

      await user.send({ embeds: [cleanupEmbed] });
      console.log(
        `🧹 CLEANUP: Sent cleanup message to ${user.username} for session ${sessionId}`
      );
    } catch (cleanupError) {
      console.log(`⚠️ Could not send cleanup message: ${cleanupError.message}`);
    }
  }

  /**
   * Gets a completed session for a user
   */
  async getCompletedSession(userId) {
    try {
      const result = await database.executeQuery(
        "SELECT * FROM onboarding_sessions WHERE user_id = $1 AND completed = TRUE ORDER BY completed_at DESC LIMIT 1",
        [userId]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error("Error getting completed session:", error);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new OnboardingSystem();
