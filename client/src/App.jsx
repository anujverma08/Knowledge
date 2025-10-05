// src/App.jsx
import React from "react";
import { Routes, Route, NavLink, Link } from "react-router-dom";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  SignUp,
  UserButton,
  useUser
} from "@clerk/clerk-react";

import Home from "./pages/Home";
import Docs from "./pages/Docs";
import AdminPage from "./pages/Admin";
import AskPage from "./pages/Ask";
import ProtectedRoute from "./components/ProtectedRoute";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

if (!clerkPublishableKey) {
  console.warn("Missing VITE_CLERK_PUBLISHABLE_KEY - Clerk auth will not work");
}

// ✅ Enhanced NavigationLink with better active state
function NavigationLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          isActive
            ? "bg-blue-50 text-blue-600 shadow-sm"
            : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
        }`
      }
      end
    >
      {children}
    </NavLink>
  );
}

// ✅ Navigation component with admin visibility
function Navigation() {
  const { user, isLoaded } = useUser();
  const isAdmin = isLoaded && user?.publicMetadata?.role === 'admin';

  return (
    <nav className="hidden md:flex items-center space-x-1">
      <NavigationLink to="/">Home</NavigationLink>
      <NavigationLink to="/docs">Docs</NavigationLink>
      <NavigationLink to="/ask">Ask</NavigationLink>
      
      {/* ✅ Admin link only visible to admins */}
      {isAdmin && (
        <NavigationLink to="/admin">
          <span className="flex items-center gap-1">
            <span>⚙️</span>
            <span>Admin</span>
          </span>
        </NavigationLink>
      )}
    </nav>
  );
}

function AppContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      {/* ✅ Enhanced Header with gradient shadow */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* ✅ Enhanced Logo */}
            <Link
              to="/"
              className="flex items-center space-x-2 text-xl font-bold text-gray-900 hover:text-blue-600 transition-all duration-200 group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                
              </span>
              <span className="bg-gradient-to-r from-gray-900 to-blue-600 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-blue-700">
                 KnowledgeScout
              </span>
            </Link>

            {/* ✅ Navigation with admin check */}
            <Navigation />

            {/* ✅ Enhanced Auth buttons */}
            <div className="flex items-center gap-3">
              <SignedIn>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block">
                    <UserButton 
                      afterSignOutUrl="/"
                      appearance={{
                        elements: {
                          avatarBox: "w-9 h-9 ring-2 ring-blue-100 hover:ring-blue-200 transition-all"
                        }
                      }}
                    />
                  </div>
                  <div className="sm:hidden">
                    <UserButton afterSignOutUrl="/" />
                  </div>
                </div>
              </SignedIn>
              <SignedOut>
                <Link
                  to="/sign-in"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:bg-gray-50"
                >
                  Sign in
                </Link>
                <Link
                  to="/sign-up"
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                >
                  Sign up
                </Link>
              </SignedOut>
            </div>
          </div>
        </div>
      </header>

      {/* ✅ Enhanced Main content with better spacing */}
      <main className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <Routes>
          {/* Public route */}
          <Route path="/" element={<Home />} />

          {/* Protected routes */}
          <Route
            path="/docs"
            element={
              <ProtectedRoute>
                <Docs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ask"
            element={
              <ProtectedRoute>
                <AskPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* ✅ Enhanced Auth modals with better backdrop */}
          <Route
            path="/sign-in/*"
            element={
              <div className="fixed inset-0 bg-gradient-to-br from-gray-900/50 via-blue-900/50 to-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
                <div className="animate-slideUp">
                  <SignIn
                    routing="path"
                    path="/sign-in"
                    signUpUrl="/sign-up"
                    afterSignInUrl="/"
                    appearance={{
                      elements: {
                        rootBox: "shadow-2xl",
                        card: "shadow-2xl rounded-xl"
                      }
                    }}
                  />
                </div>
              </div>
            }
          />

          <Route
            path="/sign-up/*"
            element={
              <div className="fixed inset-0 bg-gradient-to-br from-gray-900/50 via-blue-900/50 to-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
                <div className="animate-slideUp">
                  <SignUp
                    routing="path"
                    path="/sign-up"
                    signInUrl="/sign-in"
                    afterSignUpUrl="/"
                    appearance={{
                      elements: {
                        rootBox: "shadow-2xl",
                        card: "shadow-2xl rounded-xl"
                      }
                    }}
                  />
                </div>
              </div>
            }
          />
        </Routes>
      </main>

      {/* ✅ Optional: Footer */}
      <footer className="bg-white/50 backdrop-blur-sm border-t border-gray-200/50 mt-auto">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-600">
            <p>© 2025 Knowledge Base. Built with AI-powered search.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <AppContent />
    </ClerkProvider>
  );
}
