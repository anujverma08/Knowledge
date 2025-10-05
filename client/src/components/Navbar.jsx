// src/components/Navbar.jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUser, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';

// NavigationLink component for active state
function NavigationLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-50 text-blue-600'
          : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const { user, isLoaded } = useUser();
  
  // ✅ Check if user is admin
  const isAdmin = isLoaded && user?.publicMetadata?.role === 'admin';

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link
            to="/"
            className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
          >
            KnowledgeScout
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-1">
            <NavigationLink to="/">Home</NavigationLink>
            <NavigationLink to="/docs">Docs</NavigationLink>
            <NavigationLink to="/ask">Ask</NavigationLink>
            
            {/* ✅ Only show Admin link if user is admin */}
            {isAdmin && (
              <NavigationLink to="/admin">Admin</NavigationLink>
            )}
          </nav>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <Link
                to="/sign-in"
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/sign-up"
                className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
              >
                Sign up
              </Link>
            </SignedOut>
          </div>
        </div>
      </div>
    </header>
  );
}
