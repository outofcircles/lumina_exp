export class SafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafetyError";
  }
}

// --- 1. STRICT BLOCKLIST ---
// Words that are absolutely prohibited in a children's app (Profanity, Hate, Explicit).
// Increased coverage as requested.
const STRICT_BLOCKLIST = [
  // Profanity & Vulgarity
  "fuck", "shit", "bitch", "asshole", "damn", "crap", "piss", "dick", "cock", 
  "pussy", "vagina", "penis", "boobs", "tits", "slut", "whore", "bastard", 
  "cunt", "fag", "dyke", "nigger", "retard", "spic", "kike", "chink",
  
  // Sexual Content
  "sex", "nude", "naked", "erotic", "porn", "incest", "masturbat", "orgasm", 
  "intercourse", "sexual", "fetish", "stripper", "prostitute",

  // Extreme Violence & Abuse
  "rape", "molest", "abuse", "suicide", "torture", "mutilat", "behead", 
  "execution", "massacre", "genocide", "terrorist",
  
  // Substance Abuse
  "cocaine", "heroin", "meth", "lsd", "marijuana", "weed", "drug", "tobacco", "cigarette"
];

// --- 2. SENSITIVE CONTEXT LIST (Optional) ---
// Words that might appear in Philosophy/History but should be monitored.
// We DO NOT block these strictly, allowing for "death" in philosophy or "war" in history.
const SENSITIVE_KEYWORDS = [
  "death", "dead", "die", "kill", "blood", "war", "battle", "fight", 
  "weapon", "bomb", "gun", "poison", "prison", "crime"
];

/**
 * Recursively checks an object or string for STRICT restricted keywords.
 * Returns true if content is SAFE (no strict violations).
 * Returns false if content contains profanity/hate speech.
 */
export const validateContentSafety = (data: any): boolean => {
  if (typeof data === 'string') {
    const lowerData = data.toLowerCase();
    // Check if any STRICT keyword exists as a whole word
    // We allow SENSITIVE_KEYWORDS to pass validation for Philosophy/History contexts
    return !STRICT_BLOCKLIST.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(lowerData);
    });
  }

  if (Array.isArray(data)) {
    return data.every(item => validateContentSafety(item));
  }

  if (typeof data === 'object' && data !== null) {
    return Object.values(data).every(value => validateContentSafety(value));
  }

  return true;
};

/**
 * NEW: Sanitizes text by removing specific sentences that contain strict violations.
 * This allows you to display the safe parts of a story instead of blocking it entirely.
 */
export const sanitizeText = (text: string): string => {
  if (!text) return "";

  // 1. Split text into sentences (keeping the punctuation)
  // Matches any sequence of chars ending in . ! ? followed by space or end of string
  const sentenceRegex = /[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [text];

  // 2. Filter out unsafe sentences
  const safeSentences = sentences.filter(sentence => {
    const lowerSentence = sentence.toLowerCase();
    const hasViolation = STRICT_BLOCKLIST.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(lowerSentence);
    });
    
    // If violation found, return false (omit sentence)
    return !hasViolation;
  });

  // 3. Rejoin
  return safeSentences.join("").trim();
};

export const mockReportIssue = async (contentId: string, reason: string, details: string): Promise<boolean> => {
  // In a real app, this would send a POST request to your backend
  console.log(`[REPORT SUBMITTED] ID: ${contentId}, Reason: ${reason}, Details: ${details}`);
  return new Promise((resolve) => setTimeout(() => resolve(true), 1000));
};
