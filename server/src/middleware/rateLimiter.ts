import rateLimit from 'express-rate-limit';

// Global rate limit: 100 requests per minute per IP
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limit for auth endpoints: 5 attempts per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Medium limit for API-heavy endpoints: 30 per minute
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});
