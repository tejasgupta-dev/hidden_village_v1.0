import levelsApi from "@/lib/api/levels.api";

/**
 * Domain logic for browsing and selecting levels
 * Public-facing operations
 */
export const levelMenu = {
  /**
   * List all levels (public)
   * @returns {Promise<{success: boolean, levels: Array}>}
   */
  async list() {
    return levelsApi.list();
  },

  async listPublished() {
    return levelsApi.listPublished({ credentials: "include" });
  },

  /**
   * Get a level's basic info for preview
   * @param {string} levelId - The level ID
   * @param {Object} options - Options
   * @param {string} options.pin - PIN for protected levels
   * @returns {Promise<{success: boolean, level: Object}>}
   */
  async getPreview(levelId, options = {}) {
    return levelsApi.get(levelId, {
      pin: options.pin,
      credentials: "include",
    });
  },
};

/**
 * Search levels by keyword
 * @param {Array} levels - Array of levels
 * @param {string} searchTerm - Search term
 * @returns {Array} Filtered levels
 */
export function searchLevels(levels, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) {
    return levels;
  }

  const term = searchTerm.toLowerCase().trim();

  return levels.filter((level) => {
    const name = (level.name || "").toLowerCase();
    const keywords = (level.keywords || "").toLowerCase();
    const author = (level.author || "").toLowerCase();

    return (
      name.includes(term) || keywords.includes(term) || author.includes(term)
    );
  });
}

/**
 * Sort levels by criteria
 * @param {Array} levels - Array of levels
 * @param {string} sortBy - Sort criteria ('name', 'author', 'date')
 * @param {string} order - Sort order ('asc' or 'desc')
 * @returns {Array} Sorted levels
 */
export function sortLevels(levels, sortBy = "name", order = "asc") {
  const sorted = [...levels];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "name":
        comparison = (a.name || "").localeCompare(b.name || "");
        break;
      case "author":
        comparison = (a.author || "").localeCompare(b.author || "");
        break;
      case "date":
        comparison = (a.createdAt || 0) - (b.createdAt || 0);
        break;
      default:
        comparison = 0;
    }

    return order === "asc" ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Filter levels by publish status
 * @param {Array} levels - Array of levels
 * @param {boolean} published - Filter for published levels
 * @returns {Array} Filtered levels
 */
export function filterByStatus(levels, published) {
  return levels.filter((level) => level.isPublished === published);
}

/**
 * Get levels by author
 * @param {Array} levels - Array of levels
 * @param {string} authorUid - Author UID
 * @returns {Array} Filtered levels
 */
export function filterByAuthor(levels, authorUid) {
  return levels.filter((level) => level.authorUid === authorUid);
}

/**
 * Check if a level is published
 * @param {Object} level - Level object
 * @returns {boolean}
 */
export function isPublished(level) {
  return level?.isPublished === true;
}

/**
 * Check if a level has a PIN
 * @param {Object} level - Level object
 * @returns {boolean}
 */
export function isProtected(level) {
  if (typeof level?.hasPin === "boolean") {
    return level.hasPin;
  }
  return Boolean(level?.pin && level.pin.length > 0);
}

/**
 * Check if user is level owner
 * @param {Object} level - Level object
 * @param {string} userUid - User UID
 * @returns {boolean}
 */
export function isOwner(level, userUid) {
  return level?.authorUid === userUid;
}

/**
 * Format level for menu display
 * @param {Object} level - Level object
 * @returns {Object} Formatted level
 */
export function formatForMenu(level) {
  return {
    id: level.id,
    name: level.name || "Untitled Level",
    author: level.author || "Anonymous",
    authorUid: level.authorUid || "",
    keywords: level.keywords || "",
    isPublished: level.isPublished || false,
    hasPin: isProtected(level),
  };
}

/**
 * Group levels by author
 * @param {Array} levels - Array of levels
 * @returns {Object} Levels grouped by author
 */
export function groupByAuthor(levels) {
  return levels.reduce((groups, level) => {
    const author = level.author || "Anonymous";
    if (!groups[author]) {
      groups[author] = [];
    }
    groups[author].push(level);
    return groups;
  }, {});
}

/**
 * Get level statistics
 * @param {Array} levels - Array of levels
 * @returns {Object} Statistics
 */
export function getStats(levels) {
  return {
    total: levels.length,
    published: levels.filter((l) => l.isPublished).length,
    drafts: levels.filter((l) => !l.isPublished).length,
    protected: levels.filter((l) => isProtected(l)).length,
    authors: new Set(levels.map((l) => l.authorUid)).size,
  };
}

export default levelMenu;