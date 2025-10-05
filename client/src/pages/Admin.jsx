// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";

export default function AdminDashboard() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  
  // ✅ Use ref to track if welcome toast was shown
  const hasShownWelcome = useRef(false);

  // ✅ Memoize loadStats to prevent infinite loop
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken({ template: 'integration' }).catch(() => getToken());
      
      console.log('[Admin] Loading stats...');
      
      const { data } = await axios.get(`${BACKEND_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('[Admin] Stats loaded:', data);
      setStats(data);
      setError(null);
      // ✅ Removed toast from here - too noisy
    } catch (err) {
      console.error('[Admin] Failed to load stats:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.message;
      setError(errorMsg);
      toast.error(`Failed to load stats: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [getToken, BACKEND_URL]);

  // ✅ Check admin status - runs only once when user loads
  useEffect(() => {
    if (!isLoaded) return;

    console.log('[Admin] Checking access...', { 
      user: user?.id, 
      role: user?.publicMetadata?.role 
    });

    if (!user) {
      console.log('[Admin] No user, redirecting to sign-in');
      navigate("/sign-in");
      return;
    }

    // Check if user has admin role
    const hasAdminRole = user.publicMetadata?.role === 'admin';
    
    console.log('[Admin] Has admin role?', hasAdminRole);
    
    if (!hasAdminRole) {
      toast.error("You don't have admin access!", {
        duration: 4000,
        icon: '⛔',
      });
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    setIsAdmin(true);
    
    // ✅ Only show welcome toast once
    if (!hasShownWelcome.current) {
      toast.success(`Welcome back, ${user?.firstName || 'Admin'}!`, {
        icon: '👋',
        duration: 2000,
      });
      hasShownWelcome.current = true;
    }
  }, [isLoaded, user, navigate]);

  // ✅ Load stats only after admin check passes
  useEffect(() => {
    if (isAdmin) {
      loadStats();
    }
  }, [isAdmin, loadStats]);

  const handleRebuild = async () => {
    try {
      setRebuilding(true);
      
      // Show warning toast
      toast.loading('Starting index rebuild...', {
        id: 'rebuild',
        duration: 2000,
      });

      const token = await getToken({ template: 'integration' }).catch(() => getToken());
      
      console.log('[Admin] Starting rebuild...');
      
      const response = await axios.post(`${BACKEND_URL}/api/admin/rebuild`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('[Admin] Rebuild response:', response.data);
      
      // Success toast with warning
      toast.success(
        (t) => (
          <div>
            <div className="font-bold">Index rebuild started!</div>
            <div className="text-sm mt-1">
              ⚠️ This process may take several minutes. The index is being rebuilt in the background.
            </div>
          </div>
        ),
        {
          id: 'rebuild',
          duration: 6000,
          icon: '🔧',
        }
      );
      
      // Refresh stats after 5 seconds
      setTimeout(() => {
        console.log('[Admin] Refreshing stats...');
        loadStats().then(() => {
          toast.success('Stats refreshed!', { duration: 2000 });
        });
      }, 5000);
      
    } catch (err) {
      console.error('[Admin] Rebuild failed:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.message;
      
      toast.error(
        (t) => (
          <div>
            <div className="font-bold">Rebuild failed!</div>
            <div className="text-sm mt-1">{errorMsg}</div>
          </div>
        ),
        {
          id: 'rebuild',
          duration: 5000,
        }
      );
    } finally {
      setRebuilding(false);
    }
  };

  // Show loading state
  if (!isLoaded || !isAdmin) {
    return (
      <>
        <Toaster position="top-right" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Checking permissions...</p>
          </div>
        </div>
      </>
    );
  }

  if (loading && !stats) {
    return (
      <>
        <Toaster position="top-right" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Toaster position="top-right" />
        <div className="max-w-4xl mx-auto p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Dashboard</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={loadStats}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          // Default options
          duration: 4000,
          style: {
            background: '#fff',
            color: '#363636',
          },
          // Success
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          // Error
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
          // Loading
          loading: {
            iconTheme: {
              primary: '#3b82f6',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">
            Welcome, {user?.firstName || user?.username || 'Admin'}! 
            Manage your knowledge base index.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {stats?.total_docs || 0}
            </div>
            <div className="text-gray-700 font-medium">Total Documents</div>
            <div className="text-xs text-gray-500 mt-1">
              All documents in system
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="text-4xl font-bold text-green-600 mb-2">
              {stats?.indexed_docs || 0}
            </div>
            <div className="text-gray-700 font-medium">Indexed</div>
            <div className="text-xs text-gray-500 mt-1">
              Ready for search
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="text-4xl font-bold text-purple-600 mb-2">
              {stats?.total_chunks || 0}
            </div>
            <div className="text-gray-700 font-medium">Vector Chunks</div>
            <div className="text-xs text-gray-500 mt-1">
              Searchable segments
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        {stats && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Document Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <span className="text-gray-600">Pending:</span>
                <span className="font-bold text-yellow-600">{stats.pending_docs || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <span className="text-gray-600">Failed:</span>
                <span className="font-bold text-red-600">{stats.failed_docs || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <span className="text-gray-600">Avg Chunks/Doc:</span>
                <span className="font-bold text-gray-800">
                  {stats.total_docs > 0 
                    ? (stats.total_chunks / stats.total_docs).toFixed(1) 
                    : 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Index Management</h2>
          <p className="text-gray-600 mb-6">
            Rebuild the search index to regenerate all embeddings. 
            Use this if you've updated your embedding model or need to fix indexing issues.
          </p>
          
          <div className="flex gap-4">
            <button
              onClick={handleRebuild}
              disabled={rebuilding}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm flex items-center gap-2"
            >
              {rebuilding ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Rebuilding...</span>
                </>
              ) : (
                <>
                  <span>🔧</span>
                  <span>Rebuild Index</span>
                </>
              )}
            </button>
            
            <button
              onClick={() => {
                loadStats().then(() => {
                  toast.success('Stats refreshed!', { duration: 2000 });
                }).catch(() => {
                  toast.error('Failed to refresh stats');
                });
              }}
              disabled={loading || rebuilding}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
            >
              <span>🔄</span>
              <span>Refresh Stats</span>
            </button>
          </div>

          {stats?.last_rebuild && (
            <div className="mt-4 text-sm text-gray-600">
              Last rebuild: {new Date(stats.last_rebuild).toLocaleString()}
            </div>
          )}

          {stats?.last_error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">Last Error:</p>
              <p className="text-xs text-red-700 mt-1">{stats.last_error}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
