import { auth } from "@clerk/clerk-sdk-node";

export function clerkAuthMiddleware(req, res, next) {
  try {
    // Verifies the session from Authorization header (Bearer token)
    const { userId, sessionId } = auth(req);

    if (!userId || !sessionId) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    // Attach user info to request for downstream handlers
    req.user = { id: userId, sessionId };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: " + err.message });
  }
}
