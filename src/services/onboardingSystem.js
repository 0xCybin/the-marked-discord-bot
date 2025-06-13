// ========================================
// FILE: src/services/onboardingSystem.js (PART 1 OF 2)
// PURPOSE: Enhanced onboarding with NORMAL ARG flow + Observer detection - COMPLETE FINAL VERSION
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
 * Enhanced ARG Onboarding System - COMPLETE FINAL VERSION
 * 99% of users get normal ARG systematic names
 * Only users who type "observer" get Observer choices
 */
class OnboardingSystem {
  constructor() {
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
   * Initiates onboarding process for new member with DM failure tracking
   * @param {Object} member - Discord member object
   * @returns {Promise<boolean>} - Returns true if successful, false if DM failed
   */
  async initiateOnboarding(member) {
    logger.argEvent(
      "onboarding",
      `🔍 Starting enhanced psychological profiling for ${member.user.username}`
    );

    try {
      // Check if user already has an onboarding session
      const existingSession = await this.getOnboardingSession(member.id);
      if (existingSession && !existingSession.completed) {
        logger.debug(
          `${member.user.username} already has active onboarding session`
        );
        return true;
      }

      // Create onboarding session FIRST
      await this.createOnboardingSession(member);
      logger.debug(`✅ Created onboarding session for ${member.user.username}`);

      // Try to send initial contact message
      const dmSent = await this.sendInitialContact(member);

      if (!dmSent) {
        // DM failed - mark this in the session but don't fail completely
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

      // Try to clean up any partial session
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
   * Creates onboarding session in database - handles both with and without DM tracking
   * @param {Object} member - Discord member object
   * @returns {Promise<void>}
   */
  async createOnboardingSession(member) {
    try {
      // Try with DM tracking first, fallback without if columns don't exist
      try {
        await database.executeQuery(
          `
          INSERT INTO onboarding_sessions 
          (user_id, guild_id, current_question, responses, personality_scores, observer_response, dm_failed, started_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
          [
            member.id,
            member.guild.id,
            0,
            JSON.stringify([]),
            JSON.stringify({ seeker: 0, isolated: 0, aware: 0, lost: 0 }),
            null, // observer_response field
            false, // dm_failed field
            new Date(),
          ]
        );
      } catch (dmFieldError) {
        // Fallback without DM tracking fields if they don't exist
        logger.debug("DM tracking fields not found, using fallback creation");
        await database.executeQuery(
          `
          INSERT INTO onboarding_sessions 
          (user_id, guild_id, current_question, responses, personality_scores, observer_response, started_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
          [
            member.id,
            member.guild.id,
            0,
            JSON.stringify([]),
            JSON.stringify({ seeker: 0, isolated: 0, aware: 0, lost: 0 }),
            null, // observer_response field
            new Date(),
          ]
        );
      }

      logger.database(
        "insert",
        `Created enhanced onboarding session for ${member.user.username}`
      );
    } catch (error) {
      logger.error("Failed to create onboarding session:", error);
      throw error;
    }
  }

  /**
   * IMPROVED: Gets existing onboarding session with better JSON parsing
   * @param {string} userId - Discord user ID
   * @returns {Promise<Object|null>} Onboarding session or null
   */
  async getOnboardingSession(userId) {
    try {
      const result = await database.executeQuery(
        "SELECT * FROM onboarding_sessions WHERE user_id = $1 AND completed = FALSE ORDER BY started_at DESC LIMIT 1",
        [userId]
      );

      if (result.rows.length === 0) return null;

      const session = result.rows[0];

      // IMPROVED: Much more robust JSON parsing
      session.responses = this.safeParseJSON(session.responses, []);
      session.personality_scores = this.safeParseJSON(
        session.personality_scores,
        {
          seeker: 0,
          isolated: 0,
          aware: 0,
          lost: 0,
        }
      );

      return session;
    } catch (error) {
      logger.error("Error getting onboarding session:", error);
      return null;
    }
  }

  /**
   * NEW: Safe JSON parsing with proper fallbacks
   * @param {any} value - Value to parse
   * @param {any} defaultValue - Default value if parsing fails
   * @returns {any} Parsed value or default
   */
  safeParseJSON(value, defaultValue) {
    // Handle null, undefined, empty string
    if (value === null || value === undefined || value === "") {
      return defaultValue;
    }

    // If it's already an object/array, return it
    if (typeof value === "object") {
      return value;
    }

    // Handle string values
    if (typeof value === "string") {
      // Handle obvious non-JSON strings
      if (value === "null" || value === "undefined" || value.trim() === "") {
        return defaultValue;
      }

      try {
        const parsed = JSON.parse(value);

        // Validate the parsed result makes sense
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

    // For any other type, use default
    return defaultValue;
  }

  /**
   * Marks a session as having DM delivery issues
   * @param {string} userId - User ID
   */
  async markDMFailed(userId) {
    try {
      await database.executeQuery(
        `UPDATE onboarding_sessions 
         SET dm_failed = TRUE, dm_failed_at = $1 
         WHERE user_id = $2 AND completed = FALSE`,
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
   * @param {Object} member - Discord member object
   * @returns {Promise<boolean>} - Returns true if DM was sent successfully
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

      // Create "Begin Assessment" button
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

      await member.send({
        embeds: [embed],
        components: [row],
      });

      // Log the successful initial contact
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

      // Log the failed attempt
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
   * Handles begin assessment button click
   * @param {Object} interaction - Discord button interaction
   * @returns {Promise<void>}
   */
  async handleBeginAssessment(interaction) {
    try {
      const userId = interaction.customId.split("_")[2];

      if (interaction.user.id !== userId) {
        await interaction.reply({
          content: "This assessment is not for you...",
          flags: 64,
        });
        return;
      }

      const session = await this.getOnboardingSession(userId);
      if (!session) {
        await interaction.reply({
          content: "Assessment session not found. Something went wrong...",
          flags: 64,
        });
        return;
      }

      await this.sendNextQuestion(interaction, session);
    } catch (error) {
      logger.error("Error handling begin assessment:", error);
      await interaction.reply({
        content: "The assessment system is... unstable. Try again.",
        flags: 64,
      });
    }
  }

  /**
   * Sends the next question in the enhanced assessment
   * @param {Object} interaction - Discord interaction object
   * @param {Object} session - Onboarding session data
   * @returns {Promise<void>}
   */
  async sendNextQuestion(interaction, session) {
    try {
      // Get all questions including Observer question (now 9 total)
      const allQuestions = [
        ...this.questionCategories.existential.slice(0, 2),
        ...this.questionCategories.patterns.slice(0, 2),
        ...this.questionCategories.isolation.slice(0, 2),
        ...this.questionCategories.awareness.slice(0, 2),
        ...this.questionCategories.observer, // The special Observer question
      ];

      const currentQuestionIndex = session.current_question;
      const totalQuestions = allQuestions.length; // Now 9 questions

      if (currentQuestionIndex >= totalQuestions) {
        await this.completeAssessment(interaction, session);
        return;
      }

      const question = allQuestions[currentQuestionIndex];
      const questionNumber = currentQuestionIndex + 1;
      const isObserverQuestion = currentQuestionIndex === 8; // Last question is Observer

      if (isObserverQuestion) {
        // Special handling for Observer question - show text input modal
        await this.showObserverModal(
          interaction,
          session,
          question,
          questionNumber,
          totalQuestions
        );
      } else {
        // Regular multiple choice question
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
   * Shows regular multiple choice question
   * @param {Object} interaction - Discord interaction
   * @param {Object} session - Session data
   * @param {string} question - Question text
   * @param {number} questionNumber - Question number
   * @param {number} totalQuestions - Total questions
   */
  async showRegularQuestion(
    interaction,
    session,
    question,
    questionNumber,
    totalQuestions
  ) {
    // Create response buttons
    const yesButton = new ButtonBuilder()
      .setCustomId(`answer_yes_${session.user_id}_${session.current_question}`)
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

    const embed = new EmbedBuilder()
      .setColor(0x2c2f33)
      .setTitle(`Assessment Question ${questionNumber}/${totalQuestions}`)
      .setDescription(`**${question}**`)
      .setFooter({ text: "Answer honestly. I can tell when you lie." });

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        embeds: [embed],
        components: [row],
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components: [row],
      });
    }
  }

  /**
   * Shows special Observer question as a modal
   * @param {Object} interaction - Discord interaction
   * @param {Object} session - Session data
   * @param {string} question - Question text
   * @param {number} questionNumber - Question number
   * @param {number} totalQuestions - Total questions
   */
  async showObserverModal(
    interaction,
    session,
    question,
    questionNumber,
    totalQuestions
  ) {
    const modal = new ModalBuilder()
      .setCustomId(`observer_modal_${session.user_id}`)
      .setTitle(`Final Question ${questionNumber}/${totalQuestions}`);

    const colorInput = new TextInputBuilder()
      .setCustomId("observer_color_input")
      .setLabel("What is your favorite color?")
      .setPlaceholder("Think carefully about your answer...")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const row = new ActionRowBuilder().addComponents(colorInput);
    modal.addComponents(row);

    if (interaction.replied || interaction.deferred) {
      // Can't show modal after replying, need to send a button instead
      const observerButton = new ButtonBuilder()
        .setCustomId(`show_observer_modal_${session.user_id}`)
        .setLabel("🎨 Answer Final Question")
        .setStyle(ButtonStyle.Primary);

      const buttonRow = new ActionRowBuilder().addComponents(observerButton);

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`Final Question ${questionNumber}/${totalQuestions}`)
        .setDescription(
          `**${question}**\n\n*This is the most important question. Your answer will determine your true classification.*`
        )
        .setFooter({ text: "Click below to enter your answer." });

      await interaction.followUp({
        embeds: [embed],
        components: [buttonRow],
      });
    } else {
      await interaction.showModal(modal);
    }
  }

  /**
   * Handles the observer modal button click
   * @param {Object} interaction - Discord button interaction
   */
  async handleObserverModalButton(interaction) {
    try {
      const userId = interaction.customId.split("_")[3];

      if (interaction.user.id !== userId) {
        await interaction.reply({
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
   * FIXED: Handles observer modal submission - NORMAL FLOW + Observer detection
   * @param {Object} interaction - Modal submit interaction
   */
  async handleObserverModal(interaction) {
    try {
      const userId = interaction.customId.split("_")[2];

      if (interaction.user.id !== userId) {
        await interaction.reply({
          content: "This response is not yours to give...",
          flags: 64,
        });
        return;
      }

      const session = await this.getOnboardingSession(userId);
      if (!session) {
        await interaction.reply({
          content: "Assessment session not found.",
          flags: 64,
        });
        return;
      }

      const colorResponse = interaction.fields.getTextInputValue(
        "observer_color_input"
      );

      // Store the observer response
      await database.executeQuery(
        `UPDATE onboarding_sessions SET observer_response = $1 WHERE id = $2`,
        [colorResponse, session.id]
      );

      // Move to completion
      await this.updateSessionProgress(session.id, 9); // Question 9 (final)

      const updatedSession = await this.getOnboardingSession(userId);
      updatedSession.observer_response = colorResponse;

      // 🔥 FIXED: Only trigger Observer system if they specifically typed "observer"
      const isObserverTrigger =
        colorResponse.toLowerCase().trim() === "observer";

      if (isObserverTrigger) {
        console.log(
          `🔍 Observer keyword detected from ${interaction.user.username}`
        );
        // Show Observer choice system
        await this.showObserverChoiceSystem(interaction, updatedSession);
      } else {
        console.log(
          `🎭 Normal assessment completion for ${interaction.user.username}`
        );
        // Complete normal assessment with ARG name generation
        await this.completeAssessment(interaction, updatedSession);
      }
    } catch (error) {
      logger.error("Error handling observer modal:", error);
      await interaction.reply({
        content: "The assessment system encountered an error...",
        flags: 64,
      });
    }
  }

  /**
   * FIXED: Normal assessment completion for 99% of users
   * @param {Object} interaction - Discord interaction
   * @param {Object} session - Onboarding session
   * @returns {Promise<void>}
   */
  async completeAssessment(interaction, session) {
    try {
      console.log("🧠 Starting normal ARG assessment completion...");

      // Analyze personality scores with safe handling
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

      // 🔥 FIXED: Generate systematic ARG name (normal flow)
      const argName = await this.generateProfileBasedNickname(
        scores,
        session.responses,
        session.guild_id,
        session.user_id
      );

      console.log(`✅ Generated ARG name: ${argName}`);

      // Create final embed with ARG name reveal
      const embed = new EmbedBuilder()
        .setColor(0x2c2f33)
        .setTitle("🧠 Psychological Assessment Complete")
        .setDescription(
          `**Analysis complete.**\n\n` +
            `**Your designated identity:** \`${argName}\`\n\n` +
            `*This designation has been carefully selected based on your psychological profile.*`
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
        .setFooter({
          text: "Click below to apply your designation.",
        });

      // Create acceptance button
      const acceptButton = new ButtonBuilder()
        .setCustomId(`accept_nickname_${session.user_id}`)
        .setLabel("🎭 Accept Designation")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(acceptButton);

      await interaction.reply({
        embeds: [embed],
        components: [row],
      });

      // 🔥 FIXED: Store the generated ARG name in session as NORMAL user (not Observer)
      await database.executeQuery(
        `
        UPDATE onboarding_sessions 
        SET generated_nickname = $1, completed = TRUE, completed_at = $2, is_observer = FALSE
        WHERE id = $3
      `,
        [argName, new Date(), session.id]
      );

      // Log completion
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
      await interaction.reply({
        content:
          "The assessment system encountered an error. Your designation is... undefined.",
        flags: 64,
      });
    }
  }

  /**
   * Shows Observer choice system - let user choose between generated and custom names
   * @param {Object} interaction - Discord interaction
   * @param {Object} session - Updated session with observer_response
   */
  async showObserverChoiceSystem(interaction, session) {
    try {
      const observerResponse = session.observer_response?.toLowerCase().trim();

      // Generate the automatic Observer name
      const descriptors = [
        "WATCHING",
        "SEEING",
        "KNOWING",
        "WAITING",
        "RECORDING",
        "STUDYING",
        "ANALYZING",
      ];
      const randomDescriptor =
        descriptors[Math.floor(Math.random() * descriptors.length)];
      const generatedName = `Observer-${randomDescriptor}`;

      // Create choice embed
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
            value: `**\`Observer-CUSTOM\`**\nCreate your own designation`,
            inline: true,
          },
        ])
        .setFooter({
          text: "Both options grant full Observer status and permissions.",
        });

      // Create choice buttons
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

      await interaction.reply({
        embeds: [embed],
        components: [row],
      });

      logger.argEvent(
        "observer-choice",
        `Showing Observer choice system to ${interaction.user.username}: Generated=${generatedName}`
      );
    } catch (error) {
      logger.error("Error showing Observer choice system:", error);
      await interaction.reply({
        content: "The Observer classification system encountered an error...",
        flags: 64,
      });
    }
  }

  /**
   * IMPROVED: Handles Observer choice buttons with better debugging
   * @param {Object} interaction - Button interaction
   */
  async handleObserverChoice(interaction) {
    try {
      console.log(`🔍 Observer choice button clicked: ${interaction.customId}`);
      console.log(`   User: ${interaction.user.username}`);

      const customIdParts = interaction.customId.split("_");
      console.log(`   CustomId parts:`, customIdParts);

      // Handle both old and new button formats
      if (customIdParts[0] === "accept" && customIdParts[1] === "generated") {
        console.log(`   Handling generated Observer acceptance`);
        await this.handleGeneratedObserverAcceptance(interaction);
      } else if (
        customIdParts[0] === "create" &&
        customIdParts[1] === "custom"
      ) {
        console.log(`   Handling custom Observer creation`);
        await this.handleCustomObserverCreation(interaction);
      } else {
        console.log(
          `   Unhandled Observer choice interaction: ${interaction.customId}`
        );
        logger.debug(
          `Unhandled Observer choice interaction: ${interaction.customId}`
        );

        await interaction.reply({
          content: "Unknown Observer choice option. Please try again.",
          flags: 64,
        });
      }
    } catch (error) {
      logger.error("Error handling Observer choice:", error);
      console.error("Observer choice error details:", {
        customId: interaction.customId,
        userId: interaction.user.id,
        username: interaction.user.username,
        error: error.message,
      });

      await interaction.reply({
        content:
          "Observer choice processing failed. Please contact an administrator.",
        flags: 64,
      });
    }
  }

  /**
   * Handles generated Observer name acceptance
   * @param {Object} interaction - Button interaction
   */
  async handleGeneratedObserverAcceptance(interaction) {
    try {
      const [action, type, userId, ...nameParts] =
        interaction.customId.split("_");
      const generatedName = nameParts.join("_");

      if (interaction.user.id !== userId) {
        await interaction.reply({
          content: "This designation is not yours to claim...",
          flags: 64,
        });
        return;
      }

      // Complete the assessment with the generated name
      await this.completeObserverAssessment(
        interaction,
        userId,
        generatedName,
        true
      );
    } catch (error) {
      logger.error("Error handling generated Observer acceptance:", error);
      await interaction.reply({
        content: "The Observer designation system failed...",
        flags: 64,
      });
    }
  }

  /**
   * FIXED: Handles custom Observer name creation
   * @param {Object} interaction - Button interaction
   */
  async handleCustomObserverCreation(interaction) {
    try {
      const userId = interaction.customId.split("_")[2];

      if (interaction.user.id !== userId) {
        await interaction.reply({
          content: "This customization is not yours to make...",
          flags: 64,
        });
        return;
      }

      console.log(
        `🎨 Showing custom Observer modal for ${interaction.user.username}`
      );

      // Show custom name modal
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

      logger.debug(
        `✅ Custom Observer modal shown to ${interaction.user.username}`
      );
    } catch (error) {
      logger.error("Error showing custom Observer modal:", error);
      await interaction.reply({
        content:
          "Failed to show custom name creator. Try the generated name instead.",
        flags: 64,
      });
    }
  }

  /**
   * FIXED: Handles custom Observer name modal submission
   * @param {Object} interaction - Modal submit interaction
   */
  async handleCustomObserverModal(interaction) {
    try {
      console.log(
        `🎨 Processing custom Observer modal from ${interaction.user.username}`
      );
      console.log(`   Custom ID: ${interaction.customId}`);

      const userId = interaction.customId.split("_")[3]; // custom_observer_modal_userId

      if (interaction.user.id !== userId) {
        await interaction.reply({
          content: "This customization is not yours to complete...",
          flags: 64,
        });
        return;
      }

      const customInput = interaction.fields.getTextInputValue(
        "custom_observer_input"
      );
      console.log(`   Raw input: "${customInput}"`);

      if (!customInput || customInput.trim().length === 0) {
        await interaction.reply({
          content: "You must enter a custom name. Please try again.",
          flags: 64,
        });
        return;
      }

      const sanitizedCustom = this.sanitizeObserverInput(customInput);
      console.log(`   Sanitized: "${sanitizedCustom}"`);

      if (sanitizedCustom === "UNKNOWN" || sanitizedCustom === "UNNAMED") {
        await interaction.reply({
          content: `Invalid input "${customInput}". Please use letters and numbers only.`,
          flags: 64,
        });
        return;
      }

      const customName = `Observer-${sanitizedCustom}`;
      console.log(`   Final name: "${customName}"`);

      // Complete the assessment with the custom name
      await this.completeObserverAssessment(
        interaction,
        userId,
        customName,
        false // isGenerated = false
      );

      logger.argEvent(
        "custom-observer-created",
        `${interaction.user.username} created custom Observer name: ${customName}`
      );
    } catch (error) {
      logger.error("Error handling custom Observer modal:", error);
      console.error("Custom Observer modal error details:", {
        customId: interaction.customId,
        userId: interaction.user.id,
        username: interaction.user.username,
        error: error.message,
      });

      await interaction.reply({
        content:
          "The custom Observer creation failed. Please try the generated name instead.",
        flags: 64,
      });
    }
  }

  /**
   * Completes Observer assessment with chosen name
   * @param {Object} interaction - Discord interaction
   * @param {string} userId - User ID
   * @param {string} observerName - Chosen Observer name
   * @param {boolean} isGenerated - Whether name was generated or custom
   */
  async completeObserverAssessment(
    interaction,
    userId,
    observerName,
    isGenerated
  ) {
    try {
      // Get the session
      const sessionResult = await database.executeQuery(
        "SELECT * FROM onboarding_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 1",
        [userId]
      );

      if (sessionResult.rows.length === 0) {
        await interaction.reply({
          content: "Assessment session not found...",
          flags: 64,
        });
        return;
      }

      const session = sessionResult.rows[0];

      // Complete the session
      await database.executeQuery(
        `UPDATE onboarding_sessions 
         SET generated_nickname = $1, completed = TRUE, completed_at = $2, is_observer = TRUE
         WHERE id = $3`,
        [observerName, new Date(), session.id]
      );

      // Create success embed
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
          {
            name: "Access Level",
            value: "Special Permissions",
            inline: true,
          },
          {
            name: "Designation Type",
            value: isGenerated ? "Generated" : "Custom",
            inline: true,
          },
        ])
        .setFooter({
          text: "Click below to apply your Observer designation.",
        });

      // Create acceptance button
      const acceptButton = new ButtonBuilder()
        .setCustomId(`accept_nickname_${userId}`)
        .setLabel("🔍 Apply Observer Designation")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(acceptButton);

      await interaction.reply({
        embeds: [embed],
        components: [row],
      });

      // Log completion
      await messageLogger.logBotMessage(
        userId,
        interaction.user.username,
        "onboarding-observer-complete-choice",
        `Observer assessment complete with choice. Name: ${observerName} (${
          isGenerated ? "Generated" : "Custom"
        })`,
        "dm",
        session.guild_id
      );

      logger.argEvent(
        "observer-complete",
        `Observer ${interaction.user.username} chose ${observerName} (${
          isGenerated ? "Generated" : "Custom"
        })`
      );
    } catch (error) {
      logger.error("Error completing Observer assessment:", error);
      await interaction.reply({
        content: "The Observer protocol completion failed...",
        flags: 64,
      });
    }
  }

  /**
   * Handles regular question responses
   * @param {Object} interaction - Discord button interaction
   * @returns {Promise<void>}
   */
  async handleQuestionResponse(interaction) {
    try {
      const [action, answer, userId, questionIndex] =
        interaction.customId.split("_");

      if (interaction.user.id !== userId) {
        await interaction.reply({
          content: "This is not your assessment...",
          flags: 64,
        });
        return;
      }

      const session = await this.getOnboardingSession(userId);
      if (!session) {
        await interaction.reply({
          content: "Assessment session not found.",
          flags: 64,
        });
        return;
      }

      // Record the response
      await this.recordResponse(session, parseInt(questionIndex), answer);

      // Move to next question
      await this.updateSessionProgress(session.id, parseInt(questionIndex) + 1);

      // Get updated session
      const updatedSession = await this.getOnboardingSession(userId);

      // Continue with next question or complete
      if (updatedSession.current_question >= 9) {
        // Now 9 questions total
        await this.completeAssessment(interaction, updatedSession);
      } else {
        await this.sendNextQuestion(interaction, updatedSession);
      }
    } catch (error) {
      logger.error("Error handling question response:", error);
    }
  }

  /**
   * Records user response and updates personality scoring
   * @param {Object} session - Onboarding session
   * @param {number} questionIndex - Question index
   * @param {string} answer - User's answer (yes/no/maybe)
   * @returns {Promise<void>}
   */
  async recordResponse(session, questionIndex, answer) {
    try {
      // Add response to array
      session.responses.push({
        questionIndex,
        answer,
        timestamp: new Date(),
      });

      // Update personality scores based on question category and answer
      const scores = { ...session.personality_scores };

      // Determine which category this question belongs to (0-7 are psych questions, 8 is Observer)
      let category;
      if (questionIndex < 2) category = "isolated";
      else if (questionIndex < 4) category = "seeker";
      else if (questionIndex < 6) category = "aware";
      else if (questionIndex < 8) category = "lost";
      // Question 8 (Observer) doesn't affect psychological scores

      if (category) {
        // Score based on answer
        switch (answer) {
          case "yes":
            scores[category] += 2;
            break;
          case "maybe":
            scores[category] += 1;
            break;
          case "no":
            // No points, but still tracking
            break;
        }
      }

      // Update database
      await database.executeQuery(
        `
        UPDATE onboarding_sessions 
        SET responses = $1, personality_scores = $2
        WHERE id = $3
      `,
        [JSON.stringify(session.responses), JSON.stringify(scores), session.id]
      );
    } catch (error) {
      logger.error("Error recording response:", error);
    }
  }

  /**
   * Updates session progress
   * @param {number} sessionId - Session ID
   * @param {number} nextQuestion - Next question index
   * @returns {Promise<void>}
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
   * IMPROVED: Sanitizes user input for Observer custom names
   * @param {string} input - User input
   * @returns {string} Sanitized input
   */
  sanitizeObserverInput(input) {
    if (!input || typeof input !== "string") {
      console.log("   Sanitization: Invalid input type");
      return "UNKNOWN";
    }

    console.log(`   Sanitizing: "${input}"`);

    // Remove special characters, keep letters, numbers, spaces
    let cleaned = input
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .toUpperCase();

    console.log(`   After cleaning: "${cleaned}"`);

    // Replace spaces with underscores
    cleaned = cleaned.replace(/\s+/g, "_");

    console.log(`   After underscore replacement: "${cleaned}"`);

    // Remove multiple underscores
    cleaned = cleaned.replace(/_+/g, "_");

    // Remove leading/trailing underscores
    cleaned = cleaned.replace(/^_|_$/g, "");

    console.log(`   After underscore cleanup: "${cleaned}"`);

    // Truncate to reasonable length
    if (cleaned.length > 20) {
      cleaned = cleaned.substring(0, 20);
      console.log(`   After truncation: "${cleaned}"`);
    }

    if (cleaned.length === 0) {
      console.log("   Sanitization result: Empty string, returning UNNAMED");
      return "UNNAMED";
    }

    console.log(`   Final sanitized result: "${cleaned}"`);
    return cleaned;
  }

  /**
   * FIXED: Generates systematic ARG name based on psychological profile
   * @param {Object} scores - Personality scores
   * @param {Array} responses - User responses
   * @param {string} guildId - Guild ID for uniqueness checking
   * @param {string} userId - User ID for tracking
   * @returns {Promise<string>} Generated unique ARG name
   */
  async generateProfileBasedNickname(
    scores,
    responses,
    guildId,
    userId = null
  ) {
    try {
      console.log(`\n🔮 GENERATING ARG SYSTEMATIC NAME...`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Guild ID: ${guildId}`);

      // Calculate dominant trait
      const dominantTrait =
        Object.keys(scores).length > 0
          ? Object.keys(scores).reduce((a, b) =>
              (scores[a] || 0) > (scores[b] || 0) ? a : b
            )
          : "lost";

      // Calculate total score
      const totalScore =
        Object.values(scores).length > 0
          ? Object.values(scores).reduce((a, b) => (a || 0) + (b || 0), 0)
          : 0;

      console.log(`   Dominant trait: ${dominantTrait}`);
      console.log(`   Total score: ${totalScore}/16`);
      console.log(`   Responses count: ${responses?.length || 0}`);

      // Try to use the ARG naming system
      try {
        const argNamingSystem = require("./argNamingSystem");

        // Create psychological profile object for ARG naming system
        const psychProfile = {
          personality_scores: scores,
          responses: responses,
          user_id: userId,
          guild_id: guildId,
          timestamp: new Date().toISOString(),
        };

        console.log(`   📊 Sending profile to ARG naming system...`);

        // Generate unique ARG name using systematic naming system
        const argName = await argNamingSystem.generateUniqueName(
          psychProfile,
          guildId
        );

        console.log(`   ✅ Generated ARG name: ${argName}`);
        return argName;
      } catch (argNamingError) {
        console.log(`   ⚠️ ARG naming system error:`, argNamingError.message);
        throw argNamingError; // Re-throw to trigger fallback
      }
    } catch (error) {
      logger.error("ARG naming system failed:", error);

      // 🔥 FIXED: Emergency fallback with better naming
      console.log(`   🚨 Using emergency fallback naming...`);

      const timestamp = Date.now().toString().slice(-4);
      const dominantTrait =
        Object.keys(scores).length > 0
          ? Object.keys(scores).reduce((a, b) =>
              (scores[a] || 0) > (scores[b] || 0) ? a : b
            )
          : "lost";

      const prefix = this.getTraitPrefix(dominantTrait);
      const fallbackName = `${prefix}-${timestamp}-TEMP-∅`;

      console.log(`   📛 Emergency fallback ARG name: ${fallbackName}`);
      logger.warn(`Using emergency fallback ARG name: ${fallbackName}`);

      return fallbackName;
    }
  }

  /**
   * FIXED: Gets trait prefix for emergency fallback generation
   * @param {string} trait - Personality trait
   * @returns {string} Trait prefix
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
   * FIXED: Format personality results for display
   * @param {Object} scores - Personality scores
   * @returns {string} Formatted results
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
   * FIXED: Get trait description
   * @param {string} trait - Personality trait
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

  // ========================================
  // FIXED: Observer Nickname Protection - onboardingSystem.js
  // Add this updated function to your onboardingSystem.js file
  // ========================================

  /**
   * 🔥 FIXED: Handle nickname acceptance button with AUTOMATIC PROTECTION for ALL names
   * This is called when users click "🔍 Apply Observer Designation" or "🎭 Accept Designation"
   * @param {Object} interaction - Button interaction
   */
  async handleNicknameAcceptance(interaction) {
    try {
      const userId = interaction.customId.split("_")[2]; // accept_nickname_{userId}

      if (interaction.user.id !== userId) {
        await interaction.reply({
          content: "This designation is not yours to accept...",
          flags: 64,
        });
        return;
      }

      // Get the latest completed session
      const session = await database.executeQuery(
        "SELECT * FROM onboarding_sessions WHERE user_id = $1 AND completed = TRUE ORDER BY completed_at DESC LIMIT 1",
        [userId]
      );

      if (session.rows.length === 0) {
        await interaction.reply({
          content: "Assessment session not found...",
          flags: 64,
        });
        return;
      }

      const argName = session.rows[0].generated_nickname;
      const isObserver = session.rows[0].is_observer || false;

      // Apply ARG name to user
      const guild = interaction.client.guilds.cache.get(
        session.rows[0].guild_id
      );
      if (!guild) {
        await interaction.reply({
          content: "Cannot access the server to apply designation...",
          flags: 64,
        });
        return;
      }

      const member = await guild.members.fetch(userId);
      if (!member) {
        await interaction.reply({
          content: "Cannot find your server presence...",
          flags: 64,
        });
        return;
      }

      // Check permissions
      if (
        !guild.members.me.permissions.has("ManageNicknames") ||
        member.roles.highest.position >= guild.members.me.roles.highest.position
      ) {
        await interaction.reply({
          content:
            "I lack the authority to apply your designation. Contact the administrators...",
          flags: 64,
        });
        return;
      }

      // Apply the ARG name
      await member.setNickname(
        argName,
        isObserver
          ? "Observer Protocol Assignment"
          : "ARG Systematic Designation Assignment"
      );

      // 🔥 CRITICAL FIX: Automatically add to protection system for ALL assignments
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

      // Enhanced success response with protection info
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

      await interaction.reply({
        content: successMessage,
        flags: 64,
      });

      // Enhanced logging with protection status
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
        session.rows[0].guild_id
      );

      // Log to nickname assignments table with protection status
      try {
        await database.executeQuery(
          `
        INSERT INTO nickname_assignments 
        (user_id, guild_id, old_nickname, new_nickname, assigned_at, assignment_reason)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
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
        logger.debug("Could not log to nickname_assignments table");
      }

      // If Observer, also log to observer_assignments table
      if (isObserver) {
        try {
          await database.executeQuery(
            `
          INSERT INTO observer_assignments 
          (user_id, guild_id, observer_name, color_response, onboarding_session_id)
          VALUES ($1, $2, $3, $4, $5)
        `,
            [
              userId,
              guild.id,
              argName,
              session.rows[0].observer_response,
              session.rows[0].id,
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
      await interaction.reply({
        content: "The designation ritual failed. Contact the administrators...",
        flags: 64,
      });
    }
  }

  /**
   * Gets a completed session for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Completed session or null
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
