// src/pages/Docs.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Docs() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [message, setMessage] = useState(null);

  const fileInputRef = useRef(null);

  // ✅ Fixed: Memoized fetch with cache busting
  const fetchDocuments = useCallback(async (bustCache = false) => {
    setLoading(true);
    setMessage(null);
    try {
      let token = null;
      if (isLoaded && user) {
        try {
          token = await getToken({ template: 'integration' });
        } catch (e) {
          try { 
            token = await getToken(); 
          } catch {}
        }
      }

      // ✅ Add cache busting parameter when needed
      const cacheBuster = bustCache ? `&_t=${Date.now()}` : '';
      
      const res = await axios.get(
        `${BACKEND_URL}/api/docs?limit=${limit}&offset=${offset}${cacheBuster}`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
            // ✅ Disable browser cache
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        }
      );

      const data = res.data || {};
      const itemsFromServer = data.items || [];
      
      console.log('[Docs] Fetched documents:', itemsFromServer.length, 'User:', user?.id);
      
      setItems(itemsFromServer);
      setTotal(typeof data.total === 'number' ? data.total : itemsFromServer.length);
    } catch (err) {
      console.error('Failed to fetch documents', err);
      const errorMsg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to fetch documents';
      setMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, user, offset, limit, BACKEND_URL, getToken]);

  useEffect(() => {
    if (isLoaded) {
      fetchDocuments();
    }
  }, [isLoaded, fetchDocuments]);

  // Upload handler
  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setMessage('Please choose a file to upload.');
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      let token = null;
      if (isLoaded && user) {
        try {
          token = await getToken({ template: 'integration' });
        } catch (e) {
          try { 
            token = await getToken(); 
          } catch {}
        }
      }

      if (!token) {
        setMessage('Please sign in to upload documents');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title || file.name);
      formData.append('visibility', visibility);

      console.log('[Upload] Starting upload:', file.name, 'Size:', file.size, 'User:', user?.id);

      const res = await axios.post(`${BACKEND_URL}/api/docs`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000,
      });

      console.log('[Upload] Success:', res.data);
      
      setMessage('✅ Upload succeeded! Processing document...');
      
      // Reset form
      setFile(null);
      setTitle('');
      setVisibility('private');
      if (fileInputRef.current) fileInputRef.current.value = '';

      // ✅ Fixed: Refresh with cache busting after 2 seconds
      setTimeout(async () => {
        await fetchDocuments(true); // bust cache
        setMessage('✅ Document uploaded and indexed successfully!');
      }, 2000);

    } catch (err) {
      console.error('Upload failed', err);
      const detail = err?.response?.data?.error || err?.response?.data?.detail || err?.message || 'Upload failed';
      setMessage(`❌ ${String(detail)}`);
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) {
      console.log('[File selected]:', f.name, 'Type:', f.type, 'Size:', f.size);
    }
  }

  function handleDocClick(doc) {
    const id = doc._id || doc.id;
    if (!id) return;
    console.log('[Navigate to doc]:', id);
    navigate(`/ask?docId=${id}`);
  }

  return (
    <div className="max-w-6xl mx-auto p-8 font-sans">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold">Documents</h1>
        <p className="text-sm text-gray-600">
          {user ? `Signed in as ${user.primaryEmailAddress?.emailAddress || user.username}` : 'Upload and manage your documents'}
        </p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded text-center text-sm ${
          message.includes('✅') || message.includes('success')
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Upload card */}
      {user && (
        <div className="bg-white rounded-lg shadow p-6 mb-8 border">
          <h2 className="text-xl font-semibold mb-4">Upload Document</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.docx,.txt"
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              <div className="text-xs text-gray-500 mt-1">
                {file ? `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'PDF, DOCX, or TXT — max 10MB'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title (Optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Leave empty to use filename"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                disabled={uploading || !file}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? 'Uploading…' : 'Upload Document'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Documents list */}
      <div className="bg-white rounded-lg shadow p-6 border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {user ? 'Your Documents' : 'Public Documents'}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchDocuments(true)}
              disabled={loading}
              className="text-sm px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              🔄 Refresh
            </button>
            <div className="text-sm text-gray-600">
              {total} total document{total !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading documents…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2">No documents found</p>
            <p className="text-sm">
              {user ? 'Upload your first document above' : 'Sign in to upload documents'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((doc) => (
              <div
                key={doc._id}
                onClick={() => handleDocClick(doc)}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-sm font-medium text-gray-900 flex-1 mr-2 line-clamp-2">
                    {doc.title || doc.original_name || 'Untitled'}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                    doc.visibility === 'public' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {doc.visibility === 'public' ? 'Public' : 'Private'}
                  </span>
                </div>

                <div className="text-sm text-gray-600 mb-2">
                  {doc.pages || 0} page{doc.pages !== 1 ? 's' : ''}
                </div>

                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    doc.status === 'indexed' 
                      ? 'bg-green-100 text-green-800' 
                      : doc.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {doc.status === 'indexed' ? '✓ Indexed' : doc.status === 'pending' ? '⏳ Pending' : '✗ Failed'}
                  </span>
                  
                  {doc.createdAt && (
                    <span className="text-xs text-gray-500">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination controls */}
        {total > limit && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Showing {offset + 1} - {Math.min(offset + limit, total)} of {total}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setOffset(Math.max(0, offset - limit))} 
                disabled={offset === 0} 
                className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button 
                onClick={() => setOffset(offset + limit)} 
                disabled={offset + limit >= total} 
                className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
