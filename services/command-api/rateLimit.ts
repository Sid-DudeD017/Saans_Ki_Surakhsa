export class RateLimiter {
  private ipLimits = new Map<string, { count: number; resetAt: number }>();
  private userLimits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxPerIp: number = 100,
    private readonly maxPerUser: number = 1000,
    private readonly windowMs: number = 60000
  ) {}

  check(ip: string, userId?: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();

    // Check IP
    let ipEntry = this.ipLimits.get(ip);
    if (!ipEntry || ipEntry.resetAt < now) {
      ipEntry = { count: 0, resetAt: now + this.windowMs };
    }
    if (ipEntry.count >= this.maxPerIp) {
      return { allowed: false, retryAfter: Math.ceil((ipEntry.resetAt - now) / 1000) };
    }

    // Check User
    let userEntry = null;
    if (userId) {
      userEntry = this.userLimits.get(userId);
      if (!userEntry || userEntry.resetAt < now) {
        userEntry = { count: 0, resetAt: now + this.windowMs };
      }
      if (userEntry.count >= this.maxPerUser) {
        return { allowed: false, retryAfter: Math.ceil((userEntry.resetAt - now) / 1000) };
      }
    }

    // Increment
    ipEntry.count++;
    this.ipLimits.set(ip, ipEntry);
    
    if (userId && userEntry) {
      userEntry.count++;
      this.userLimits.set(userId, userEntry);
    }

    return { allowed: true };
  }
}
