import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser, useClerk } from "@clerk/clerk-react";

export default function Home() {
  const { user, isSignedIn, isLoaded } = useUser();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();

  // Backend URL from environment
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const handleGetStarted = async () => {
    if (!isLoaded) return; // wait until Clerk loads user info

    if (isSignedIn && user) {
      // Optionally, you can verify user role by calling backend here with user token

      // Redirect signed-in user to /docs
      navigate("/docs");
    } else {
      // Open sign-in modal and redirect to /docs after successful sign-in
      openSignIn({ redirectUrl: "/docs" });
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-800 mb-6 tracking-tight">
            Knowledge<span className="text-blue-600">Scout</span>
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-12">
            Upload documents, ask questions, and get precise answers with real citations.{" "}
            Transform your knowledge base into an intelligent search experience.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          <Link
            to="/docs"
            className="group bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 hover:border-blue-300"
          >
            <div className="text-4xl mb-4">📄</div>
            <h3 className="text-xl font-semibold text-slate-800 mb-3 group-hover:text-blue-600 transition-colors">
              Document Management
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Upload, organize, and manage your documents with our intuitive interface.
            </p>
          </Link>

          <Link
            to="/ask"
            className="group bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 hover:border-blue-300"
          >
            <div className="text-4xl mb-4">❓</div>
            <h3 className="text-xl font-semibold text-slate-800 mb-3 group-hover:text-blue-600 transition-colors">
              Smart Questions
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Ask natural language questions and receive accurate, cited responses.
            </p>
          </Link>

          <Link
            to="/admin"
            className="group bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 hover:border-blue-300"
          >
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-xl font-semibold text-slate-800 mb-3 group-hover:text-blue-600 transition-colors">
              Administration
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Configure settings, manage users, and monitor system performance.
            </p>
          </Link>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            Get Started
            <svg
              className="ml-2 w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-300 py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm">&copy; 2025 KnowledgeScout. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
