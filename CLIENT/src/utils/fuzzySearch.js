/**
 * Fuzzy search utility
 * Provides approximate string matching for better search results
 */

/**
 * Calculate Levenshtein distance between two strings
 */
const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  // Initialize matrix
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[len2][len1];
};

/**
 * Calculate similarity score (0-1, where 1 is exact match)
 */
const similarity = (str1, str2) => {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - distance / maxLen;
};

/**
 * Fuzzy search in array of objects
 * @param {Array} items - Array of objects to search
 * @param {string} query - Search query
 * @param {Array} fields - Fields to search in
 * @param {number} threshold - Minimum similarity score (0-1)
 * @returns {Array} Filtered and sorted results
 */
export const fuzzySearch = (items, query, fields = [], threshold = 0.3) => {
  if (!query || !query.trim()) {
    return items;
  }

  const searchTerm = query.toLowerCase().trim();
  const results = [];

  items.forEach((item) => {
    let maxScore = 0;
    let matchedFields = [];

    // Search in specified fields
    fields.forEach((field) => {
      const value = getNestedValue(item, field);
      if (value) {
        const strValue = String(value).toLowerCase();
        
        // Exact match gets highest score
        if (strValue.includes(searchTerm)) {
          maxScore = Math.max(maxScore, 1);
          matchedFields.push(field);
        } else {
          // Calculate similarity
          const score = similarity(strValue, searchTerm);
          if (score >= threshold) {
            maxScore = Math.max(maxScore, score);
            matchedFields.push(field);
          }
        }
      }
    });

    if (maxScore >= threshold) {
      results.push({
        item,
        score: maxScore,
        matchedFields,
      });
    }
  });

  // Sort by score (highest first)
  results.sort((a, b) => b.score - a.score);

  return results.map((r) => r.item);
};

/**
 * Get nested value from object using dot notation
 */
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
};

/**
 * Simple fuzzy match (faster, less accurate)
 */
export const simpleFuzzyMatch = (text, query) => {
  if (!query) return true;
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Exact match
  if (textLower.includes(queryLower)) return true;
  
  // Check if all characters in query appear in order in text
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }
  
  return queryIndex === queryLower.length;
};

export default {
  fuzzySearch,
  simpleFuzzyMatch,
  similarity,
  levenshteinDistance,
};
