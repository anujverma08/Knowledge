// server/middleware/clerkAuthMiddleware.js
import { requireAuth } from "@clerk/express";

export const clerkAuthMiddleware = requireAuth();
