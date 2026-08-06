const buckets = new Map();

const getClientKey = (req, scope) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "unknown";

  return `${scope}:${ip}`;
};

export const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 20, scope = "global" } = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    const key = getClientKey(req, scope);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;

    if (current.count > max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        message: "Demasiados intentos. Intenta de nuevo mas tarde."
      });
    }

    return next();
  };
};
