// server/middleware/adminOnly.js
import { getAuth } from '@clerk/express';

export function adminOnly(req, res, next) {
  try {
    const auth = getAuth(req);
    
    if (!auth.userId) {
      console.log('[Admin] ❌ No userId in token');
      return res.status(401).json({ error: 'Login required' });
    }

    // ✅ Get role from session claims metadata
    const metadata = auth.sessionClaims?.metadata || auth.sessionClaims?.public_metadata;
    const role = metadata?.role;

    console.log('[Admin] User:', auth.userId);
    console.log('[Admin] Metadata:', metadata);
    console.log('[Admin] Role:', role);

    if (role === 'admin') {
      console.log('[Admin] ✅ Access granted');
      req.user = { id: auth.userId, role };
      return next();
    }

    console.log('[Admin] ❌ Access denied - Role is:', role);
    return res.status(403).json({ 
      error: 'Admin access required',
      yourRole: role || 'none',
      hint: 'Contact admin to get admin role'
    });

  } catch (err) {
    console.error('[Admin] ❌ Error:', err);
    return res.status(500).json({ error: 'Auth check failed' });
  }
}
