// middlewares/roleCheck.js
import { clerkClient } from '@clerk/clerk-sdk-node';

export function requireRole(requiredRole) {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const user = await clerkClient.users.getUser(userId);
      const role = user.publicMetadata?.role;

      if (role !== requiredRole) {
        return res.status(403).json({ error: 'Forbidden: Insufficient role' });
      }
      next();
    } catch (err) {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
}
