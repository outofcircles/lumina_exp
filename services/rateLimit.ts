
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  name: string;
}

const LIMITS: RateLimitConfig[] = [
  { windowMs: 60 * 1000, maxRequests: 5, name: 'Burst' },       // 5 requests per minute
  { windowMs: 60 * 60 * 1000, maxRequests: 60, name: 'Hourly' } // 60 requests per hour
];

const STORAGE_KEY = 'lumina_req_logs';

export const checkRateLimit = (): void => {
  const now = Date.now();
  let logs: number[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

  // 1. Clean up old logs (older than the largest window)
  const maxWindow = Math.max(...LIMITS.map(l => l.windowMs));
  logs = logs.filter(timestamp => now - timestamp < maxWindow);

  // 2. Check against all limits
  for (const limit of LIMITS) {
    const countInWindow = logs.filter(timestamp => now - timestamp < limit.windowMs).length;
    
    if (countInWindow >= limit.maxRequests) {
      const oldestInWindow = logs.find(timestamp => now - timestamp < limit.windowMs) || now;
      const resetTime = oldestInWindow + limit.windowMs;
      const waitSeconds = Math.ceil((resetTime - now) / 1000);
      
      let waitMsg = `${waitSeconds} seconds`;
      if (waitSeconds > 60) {
        waitMsg = `${Math.ceil(waitSeconds / 60)} minutes`;
      }

      throw new RateLimitError(
        `Usage limit reached. Please wait ${waitMsg} before exploring more.`
      );
    }
  }

  // 3. Log this request
  logs.push(now);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
};
