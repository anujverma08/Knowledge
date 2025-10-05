// server/middleware/clerkAuthMiddleware.js
import { clerkMiddleware, requireAuth as clerkRequireAuth, getAuth } from '@clerk/express';

/**
 * Global Clerk middleware - adds req.auth to all routes
 * Should be applied globally in your main server file
 */
export const clerkAuth = clerkMiddleware();

/**
 * Middleware to require authentication for API routes
 * Returns 401 with JSON (doesn't redirect)
 */
export function requireAuth(req, res, next) {
  const auth = getAuth(req);
  
  if (!auth.userId) {
    return res.status(401).json({ 
      error: 'UNAUTHORIZED', 
      detail: 'Authentication required' 
    });
  }
  
  // ✅ Attach user object for easier access
  req.user = {
    id: auth.userId,
    userId: auth.userId,
    sessionId: auth.sessionId,
    orgId: auth.orgId,
    sub: auth.userId,
  };
  
  next();
}

/**
 * Optional authentication - attaches user if authenticated
 * Doesn't block unauthenticated requests
 */
export function optionalAuth(req, res, next) {
  const auth = getAuth(req);
  
  if (auth.userId) {
    req.user = {
      id: auth.userId,
      userId: auth.userId,
      sessionId: auth.sessionId,
      orgId: auth.orgId,
      sub: auth.userId,
    };
  }
  
  next();
}
