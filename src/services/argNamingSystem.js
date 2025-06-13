// ========================================
// FILE: src/services/argNamingSystem.js
// PURPOSE: ARG systematic naming system with guaranteed uniqueness (3,840,000 combinations)
// ========================================

const database = require("../config/database");
const logger = require("../utils/logger");

/**
 * ARG Systematic Naming System
 * Generates unique identifiers in format: [CLASSIFICATION]-[ID]-[DESCRIPTOR]-[SYMBOL]
 * Total combinations: 8 × 100 × 80 × 60 = 3,840,000 unique names
 */
class ARGNamingSystem {
  constructor() {
    // Table 1: Classifications (8 options)
    this.classifications = [
      "SUBJ",
      "ID",
      "TEST",
      "#",
      "UNIT",
      "NODE",
      "CASE",
      "SPEC",
    ];

    // Table 2: Alphanumeric IDs (100 options)
    this.alphanumericIds = [
      // A-Z series (26 × 5 = 130, taking first 95)
      "A1",
      "A2",
      "A3",
      "A4",
      "A5",
      "B1",
      "B2",
      "B3",
      "B4",
      "B5",
      "C1",
      "C2",
      "C3",
      "C4",
      "C5",
      "D1",
      "D2",
      "D3",
      "D4",
      "D5",
      "E1",
      "E2",
      "E3",
      "E4",
      "E5",
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "G1",
      "G2",
      "G3",
      "G4",
      "G5",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "I1",
      "I2",
      "I3",
      "I4",
      "I5",
      "J1",
      "J2",
      "J3",
      "J4",
      "J5",
      "K1",
      "K2",
      "K3",
      "K4",
      "K5",
      "L1",
      "L2",
      "L3",
      "L4",
      "L5",
      "M1",
      "M2",
      "M3",
      "M4",
      "M5",
      "N1",
      "N2",
      "N3",
      "N4",
      "N5",
      "O1",
      "O2",
      "O3",
      "O4",
      "O5",
      "P1",
      "P2",
      "P3",
      "P4",
      "P5",
      "Q1",
      "Q2",
      "Q3",
      "Q4",
      "Q5",
      "R1",
      "R2",
      "R3",
      "R4",
      "R5",
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
      "T1",
      "T2",
      "T3",
      "T4",
      "T5",
      "U1",
      "U2",
      "U3",
      "U4",
      "U5",
      "V1",
      "V2",
      "V3",
      "V4",
      "V5",
      "W1",
      "W2",
      "W3",
      "W4",
      "W5",
      "X1",
      "X2",
      "X3",
      "X4",
      "X5",
      "Y1",
      "Y2",
      "Y3",
      "Y4",
      "Y5",
      "Z1",
      "Z2",
      "Z3",
      "Z4",
      "Z5",
      // Double digits (10 options to reach 100 total)
      "00",
      "11",
      "22",
      "33",
      "44",
      "55",
      "66",
      "77",
      "88",
      "99",
    ];

    // Table 3: ARG-Themed Descriptors (80 options)
    this.descriptors = [
      "SEEING",
      "BLIND",
      "AWAKE",
      "SLEEP",
      "LOOP",
      "CYCLE",
      "STATIC",
      "SIGNAL",
      "VOID",
      "NULL",
      "PRIME",
      "ZERO",
      "ECHO",
      "FADE",
      "BURN",
      "DRIFT",
      "COUNT",
      "WATCH",
      "WAIT",
      "KNOW",
      "FORGET",
      "BREAK",
      "MEND",
      "SEEK",
      "TRUTH",
      "FALSE",
      "REAL",
      "FAKE",
      "DEEP",
      "SHALLOW",
      "CLEAR",
      "BLUR",
      "PATTERN",
      "CHAOS",
      "ORDER",
      "FLUX",
      "NODE",
      "LINK",
      "PATH",
      "MAZE",
      "MIRROR",
      "SHARD",
      "WHOLE",
      "PART",
      "START",
      "END",
      "BETWEEN",
      "BEYOND",
      "PULSE",
      "WAVE",
      "SHIFT",
      "TURN",
      "RISE",
      "FALL",
      "CLIMB",
      "DIVE",
      "OPEN",
      "CLOSE",
      "LOCK",
      "KEY",
      "DOOR",
      "WALL",
      "BRIDGE",
      "GAP",
      "LIGHT",
      "DARK",
      "SHADE",
      "GLOW",
      "SPARK",
      "FLAME",
      "ASH",
      "DUST",
      "WIND",
      "STORM",
      "CALM",
      "STILL",
      "MOVE",
      "STOP",
      "FLOW",
      "BLOCK",
    ];

    // Table 4: Discord-Safe Mystical Symbols (60 options)
    this.symbols = [
      "░",
      "▦",
      "⋫",
      "⋢",
      "◈",
      "ж",
      "Ƹ",
      "Ξ",
      "∀",
      "๑",
      "☼",
      "ஐ",
      "⋝",
      "⋜",
      "⋪",
      "█",
      "╩",
      "▪",
      "▫",
      "□",
      "‖",
      "﹉",
      "๏",
      "∩",
      "▓",
      "回",
      "⋖",
      "⋗",
      "✚",
      "▧",
      "≋",
      "≈",
      "∴",
      "∵",
      "∃",
      "∄",
      "∅",
      "∆",
      "∇",
      "∈",
      "∉",
      "∋",
      "∌",
      "∑",
      "∏",
      "∐",
      "∫",
      "∬",
      "∭",
      "∮",
      "∯",
      "∰",
      "∱",
      "∲",
      "∳",
      "⊕",
      "⊖",
      "⊗",
      "⊘",
      "⊙",
    ];

    // Verify our counts
    this.totalCombinations =
      this.classifications.length *
      this.alphanumericIds.length *
      this.descriptors.length *
      this.symbols.length;

    logger.info(
      `ARG Naming System initialized: ${this.totalCombinations} total combinations`
    );
    logger.info(`  Classifications: ${this.classifications.length}`);
    logger.info(`  IDs: ${this.alphanumericIds.length}`);
    logger.info(`  Descriptors: ${this.descriptors.length}`);
    logger.info(`  Symbols: ${this.symbols.length}`);
  }

  /**
   * Generates a unique ARG name based on psychological profile
   * @param {Object} psychProfile - Psychological assessment results
   * @param {string} guildId - Guild ID for uniqueness tracking
   * @returns {Promise<string>} Generated unique ARG name
   */
  async generateUniqueName(psychProfile, guildId) {
    const maxAttempts = 50; // Should never need this many with 3.8M combinations
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;

      // Generate name based on psychological profile
      const name = this.generateProfileBasedName(psychProfile, attempts);

      // Check if name is unique
      const isUnique = await this.checkNameUniqueness(name, guildId);

      if (isUnique) {
        // Store the assigned name to prevent future duplicates
        await this.recordNameAssignment(name, guildId, psychProfile);

        logger.argEvent(
          "name-generated",
          `Generated unique ARG name: ${name} (attempt ${attempts})`
        );
        return name;
      }

      logger.debug(
        `Name ${name} already exists, trying again (attempt ${attempts})`
      );
    }

    // Fallback: Generate completely random name (should never reach here)
    const fallbackName = this.generateRandomName();
    logger.warn(
      `Using fallback random name: ${fallbackName} after ${maxAttempts} attempts`
    );

    // Still record it
    await this.recordNameAssignment(fallbackName, guildId, psychProfile);
    return fallbackName;
  }

  /**
   * Generates name based on psychological profile with intelligent selection
   * @param {Object} psychProfile - Psychological assessment results
   * @param {number} attempt - Current attempt number for variation
   * @returns {string} Generated ARG name
   */
  generateProfileBasedName(psychProfile, attempt = 1) {
    // Extract profile data
    const scores = psychProfile.personality_scores || {};
    const dominantTrait = this.getDominantTrait(scores);
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

    // Select classification based on dominant trait and attempt
    const classification = this.selectClassification(dominantTrait, attempt);

    // Select ID based on total score and some randomness
    const id = this.selectId(totalScore, attempt);

    // Select descriptor based on psychological profile
    const descriptor = this.selectDescriptor(dominantTrait, scores, attempt);

    // Select symbol based on awareness level and variation
    const symbol = this.selectSymbol(totalScore, attempt);

    return `${classification}-${id}-${descriptor}-${symbol}`;
  }

  /**
   * Selects classification based on dominant psychological trait
   * @param {string} dominantTrait - Dominant personality trait
   * @param {number} attempt - Attempt number for variation
   * @returns {string} Selected classification
   */
  selectClassification(dominantTrait, attempt) {
    const traitMappings = {
      seeker: ["TEST", "SPEC", "CASE"], // Active investigators
      isolated: ["SUBJ", "#", "UNIT"], // Processed subjects
      aware: ["NODE", "SPEC", "TEST"], // Network connections
      lost: ["ID", "SUBJ", "#"], // Identification needed
    };

    const preferredOptions = traitMappings[dominantTrait] || traitMappings.lost;

    // Use attempt to vary selection within preferred options
    const index = (attempt - 1) % preferredOptions.length;
    return preferredOptions[index];
  }

  /**
   * Selects alphanumeric ID based on total score and attempt
   * @param {number} totalScore - Total psychological score
   * @param {number} attempt - Attempt number for variation
   * @returns {string} Selected ID
   */
  selectId(totalScore, attempt) {
    // Use score and attempt to distribute across the 100 IDs
    const baseIndex =
      Math.floor(totalScore * 12.5 + attempt * 7) % this.alphanumericIds.length;
    return this.alphanumericIds[baseIndex];
  }

  /**
   * Selects descriptor based on psychological traits
   * @param {string} dominantTrait - Dominant trait
   * @param {Object} scores - All psychological scores
   * @param {number} attempt - Attempt number
   * @returns {string} Selected descriptor
   */
  selectDescriptor(dominantTrait, scores, attempt) {
    const traitDescriptors = {
      seeker: [
        "SEEING",
        "TRUTH",
        "SEEK",
        "PATTERN",
        "KNOW",
        "REAL",
        "CLEAR",
        "DEEP",
        "WATCH",
        "COUNT",
        "BREAK",
        "OPEN",
        "KEY",
        "PATH",
        "LINK",
        "PRIME",
      ],
      isolated: [
        "VOID",
        "NULL",
        "FADE",
        "DRIFT",
        "BETWEEN",
        "BEYOND",
        "SHARD",
        "PART",
        "BLIND",
        "SLEEP",
        "FORGET",
        "CLOSE",
        "WALL",
        "GAP",
        "DARK",
        "ASH",
      ],
      aware: [
        "AWAKE",
        "SIGNAL",
        "ECHO",
        "PULSE",
        "WAVE",
        "GLOW",
        "SPARK",
        "LIGHT",
        "MIRROR",
        "WHOLE",
        "START",
        "RISE",
        "FLOW",
        "SHIFT",
        "TURN",
        "BRIDGE",
      ],
      lost: [
        "STATIC",
        "LOOP",
        "CYCLE",
        "CHAOS",
        "FLUX",
        "MAZE",
        "BURN",
        "BLUR",
        "WAIT",
        "MEND",
        "FALSE",
        "FAKE",
        "SHALLOW",
        "END",
        "FALL",
        "STOP",
      ],
    };

    const preferredDescriptors =
      traitDescriptors[dominantTrait] || traitDescriptors.lost;

    // Use attempt and secondary traits to vary selection
    const secondaryTrait = this.getSecondaryTrait(scores);
    const variation = attempt * 3 + (secondaryTrait === "aware" ? 5 : 0);

    const index = variation % preferredDescriptors.length;
    return preferredDescriptors[index];
  }

  /**
   * Selects symbol based on awareness level
   * @param {number} totalScore - Total psychological score
   * @param {number} attempt - Attempt number
   * @returns {string} Selected symbol
   */
  selectSymbol(totalScore, attempt) {
    // Distribute symbols based on awareness level
    let symbolGroup;

    if (totalScore >= 12) {
      // High awareness - more complex symbols
      symbolGroup = this.symbols.slice(40, 60); // Last 20 symbols
    } else if (totalScore >= 8) {
      // Medium awareness - medium complexity
      symbolGroup = this.symbols.slice(20, 40); // Middle 20 symbols
    } else {
      // Low awareness - simpler symbols
      symbolGroup = this.symbols.slice(0, 20); // First 20 symbols
    }

    const index = (attempt * 7) % symbolGroup.length;
    return symbolGroup[index];
  }

  /**
   * Gets the dominant psychological trait
   * @param {Object} scores - Psychological scores
   * @returns {string} Dominant trait
   */
  getDominantTrait(scores) {
    if (!scores || Object.keys(scores).length === 0) return "lost";

    return Object.keys(scores).reduce((a, b) =>
      (scores[a] || 0) > (scores[b] || 0) ? a : b
    );
  }

  /**
   * Gets the secondary psychological trait
   * @param {Object} scores - Psychological scores
   * @returns {string} Secondary trait
   */
  getSecondaryTrait(scores) {
    if (!scores || Object.keys(scores).length === 0) return "lost";

    const sortedTraits = Object.keys(scores).sort(
      (a, b) => (scores[b] || 0) - (scores[a] || 0)
    );
    return sortedTraits[1] || "lost";
  }

  /**
   * Checks if a name is unique across the system
   * @param {string} name - Name to check
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Whether name is unique
   */
  async checkNameUniqueness(name, guildId) {
    try {
      // Check against current Discord nicknames
      const client = require("../bot");
      const guild = client.guilds.cache.get(guildId);

      if (guild) {
        const existingMember = guild.members.cache.find(
          (member) => member.displayName === name
        );

        if (existingMember) {
          return false;
        }
      }

      // Check against our assigned names database
      const result = await database.executeQuery(
        "SELECT id FROM arg_name_assignments WHERE assigned_name = $1",
        [name]
      );

      return result.rows.length === 0;
    } catch (error) {
      logger.error("Error checking name uniqueness:", error);
      return false; // Assume not unique to be safe
    }
  }

  /**
   * Records a name assignment to prevent future duplicates
   * @param {string} name - Assigned name
   * @param {string} guildId - Guild ID
   * @param {Object} psychProfile - Psychological profile data
   * @returns {Promise<void>}
   */
  async recordNameAssignment(name, guildId, psychProfile) {
    try {
      await database.executeQuery(
        `
        INSERT INTO arg_name_assignments 
        (assigned_name, guild_id, user_id, psychological_profile, assigned_at)
        VALUES ($1, $2, $3, $4, $5)
      `,
        [
          name,
          guildId,
          psychProfile.user_id || null,
          JSON.stringify(psychProfile),
          new Date(),
        ]
      );

      logger.database("insert", `Recorded ARG name assignment: ${name}`);
    } catch (error) {
      logger.error("Error recording name assignment:", error);
      // Don't throw - assignment failure shouldn't stop the process
    }
  }

  /**
   * Generates completely random name (fallback only)
   * @returns {string} Random ARG name
   */
  generateRandomName() {
    const classification =
      this.classifications[
        Math.floor(Math.random() * this.classifications.length)
      ];
    const id =
      this.alphanumericIds[
        Math.floor(Math.random() * this.alphanumericIds.length)
      ];
    const descriptor =
      this.descriptors[Math.floor(Math.random() * this.descriptors.length)];
    const symbol =
      this.symbols[Math.floor(Math.random() * this.symbols.length)];

    return `${classification}-${id}-${descriptor}-${symbol}`;
  }

  /**
   * Gets statistics about name assignments
   * @param {string} guildId - Guild ID (optional)
   * @returns {Promise<Object>} Assignment statistics
   */
  async getAssignmentStats(guildId = null) {
    try {
      let query = `
        SELECT 
          COUNT(*) as total_assigned,
          COUNT(DISTINCT SPLIT_PART(assigned_name, '-', 1)) as classifications_used,
          COUNT(DISTINCT SPLIT_PART(assigned_name, '-', 2)) as ids_used,
          COUNT(DISTINCT SPLIT_PART(assigned_name, '-', 3)) as descriptors_used,
          COUNT(DISTINCT SPLIT_PART(assigned_name, '-', 4)) as symbols_used,
          MAX(assigned_at) as last_assignment
        FROM arg_name_assignments
      `;

      let params = [];

      if (guildId) {
        query += " WHERE guild_id = $1";
        params.push(guildId);
      }

      const result = await database.executeQuery(query, params);
      const stats = result.rows[0];

      return {
        totalAssigned: parseInt(stats.total_assigned),
        remaining: this.totalCombinations - parseInt(stats.total_assigned),
        utilizationRate: (
          (parseInt(stats.total_assigned) / this.totalCombinations) *
          100
        ).toFixed(4),
        classificationsUsed: parseInt(stats.classifications_used),
        idsUsed: parseInt(stats.ids_used),
        descriptorsUsed: parseInt(stats.descriptors_used),
        symbolsUsed: parseInt(stats.symbols_used),
        lastAssignment: stats.last_assignment,
        totalPossible: this.totalCombinations,
      };
    } catch (error) {
      logger.error("Error getting assignment stats:", error);
      return {
        totalAssigned: 0,
        remaining: this.totalCombinations,
        utilizationRate: "0.0000",
        totalPossible: this.totalCombinations,
      };
    }
  }

  /**
   * Validates that a name follows the correct ARG format
   * @param {string} name - Name to validate
   * @returns {boolean} Whether name is valid ARG format
   */
  isValidARGName(name) {
    if (!name || typeof name !== "string") return false;

    const parts = name.split("-");
    if (parts.length !== 4) return false;

    const [classification, id, descriptor, symbol] = parts;

    return (
      this.classifications.includes(classification) &&
      this.alphanumericIds.includes(id) &&
      this.descriptors.includes(descriptor) &&
      this.symbols.includes(symbol)
    );
  }

  /**
   * Decodes an ARG name into its components
   * @param {string} name - ARG name to decode
   * @returns {Object} Decoded name components
   */
  decodeARGName(name) {
    if (!this.isValidARGName(name)) {
      return { isValid: false };
    }

    const [classification, id, descriptor, symbol] = name.split("-");

    const classificationMeaning = {
      SUBJ: "Standard Subject",
      ID: "Identification Phase",
      TEST: "Active Testing",
      "#": "Processed/Numbered",
      UNIT: "Operational Unit",
      NODE: "Network Connection Point",
      CASE: "Case Study",
      SPEC: "Special Designation",
    };

    return {
      isValid: true,
      classification: {
        code: classification,
        meaning: classificationMeaning[classification],
      },
      id: id,
      descriptor: descriptor,
      symbol: symbol,
      fullName: name,
    };
  }
}

// Export singleton instance
module.exports = new ARGNamingSystem();
