
export class SafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafetyError";
  }
}

// A basic blocklist for demonstration. 
// In a production app, this should be more comprehensive or handled by a dedicated API.
const RESTRICTED_KEYWORDS = [
  "murder", "kill", "blood", "death", "violent", "torture", 
  "sex", "nude", "drug", "alcohol", "tobacco", "cigarette", 
  "suicide", "hate", "racist", "nazi", "terrorist", "bomb"
];

/**
 * recursivley checks an object or string for restricted keywords.
 * Returns true if content is SAFE.
 * Returns false if content contains restricted keywords.
 */
export const validateContentSafety = (data: any): boolean => {
  if (typeof data === 'string') {
    const lowerData = data.toLowerCase();
    // Check if any restricted keyword exists as a whole word or significant part
    return !RESTRICTED_KEYWORDS.some(keyword => {
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

export const mockReportIssue = async (contentId: string, reason: string, details: string): Promise<boolean> => {
  // In a real app, this would send a POST request to your backend
  console.log(`[REPORT SUBMITTED] ID: ${contentId}, Reason: ${reason}, Details: ${details}`);
  return new Promise((resolve) => setTimeout(() => resolve(true), 1000));
};
