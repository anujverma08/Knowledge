import React from "react";
import { Routes, Route, NavLink, Link } from "react-router-dom";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  SignUp,
  UserButton,
  useAuth
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

function NavigationLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        "px-3 py-2 rounded-md text-sm font-medium transition-colors " +
        (isActive ? "text-blue-600 font-semibold" : "text-gray-700 hover:text-blue-600")
      }
      end
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  
  return (
    <ClerkProvider publishableKey={'pk_test_Y2FyaW5nLWRvbHBoaW4tMjMuY2xlcmsuYWNjb3VudHMuZGV2JA'}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo */}
              <Link
                to="/"
                className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
              >
                Knowledge
              </Link>

              {/* Navigation */}
              <nav className="hidden md:flex space-x-1">
                <NavigationLink to="/">Home</NavigationLink>
                <NavigationLink to="/docs">Docs</NavigationLink>
                <NavigationLink to="/ask">Ask</NavigationLink>
                <NavigationLink to="/admin">Admin</NavigationLink>
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

        {/* Main content */}
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

            {/* Sign in/up modals */}
            <Route
              path="/sign-in/*"
              element={
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <SignIn
                    routing="path"
                    path="/sign-in"
                    signUpUrl="/sign-up"
                    afterSignInUrl="/"
                  />
                </div>
              }
            />

            <Route
              path="/sign-up/*"
              element={
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <SignUp
                    routing="path"
                    path="/sign-up"
                    signInUrl="/sign-in"
                    afterSignUpUrl="/"
                  />
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </ClerkProvider>
  );
}
