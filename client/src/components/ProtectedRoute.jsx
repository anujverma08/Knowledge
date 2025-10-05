import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) return <div>Loading auth...</div>;

  if (!isSignedIn) {
    // Redirect to sign-in if not authenticated
    return <Navigate to="/sign-in" replace />;
  }

  if (requiredRole) {
    const role = user?.publicMetadata?.role;
    if (!role || role !== requiredRole) {
      // Show unauthorized message or redirect as needed
      return (
        <div className="text-center mt-20 text-red-600 font-semibold">
          Unauthorized — you need the <strong>{requiredRole}</strong> role.
        </div>
      );
      // Or redirect to home:
      // return <Navigate to="/" replace />
    }
  }

  return children;
}
