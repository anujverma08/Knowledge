// src/pages/Docs.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Docs() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  // Use env or fallback to localhost for dev
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

  async function fetchDocuments() {
    setLoading(true);
    setMessage(null);
    try {
      let token = null;
      if (isLoaded && user) {
        // useAuth's getToken is the recommended way
        try {
          token = await getToken({ template: 'integration' });
        } catch (e) {
          // some Clerk setups allow getToken() without args, fallback:
          try { token = await getToken(); } catch {}
        }
      }

      const res = await axios.get(`${BACKEND_URL}/api/docs?limit=${limit}&offset=${offset}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      // defensive: accept either res.data.items or res.data
      const data = res.data || {};
      const itemsFromServer = data.items || data.documents || data || [];
      setItems(itemsFromServer);
      if (typeof data.total === 'number') setTotal(data.total);
      else setTotal(Array.isArray(itemsFromServer) ? itemsFromServer.length : 0);
    } catch (err) {
      console.error('Failed to fetch documents', err);
      setMessage('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoaded) fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user, offset]);

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
          try { token = await getToken(); } catch {}
        }
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('visibility', visibility);

      const res = await axios.post(`${BACKEND_URL}/api/docs`, formData, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000,
      });

      setMessage('Upload succeeded');
      // Refresh list (go to first page)
      setOffset(0);
      await fetchDocuments();

      // reset form and file input element
      setFile(null);
      setTitle('');
      setVisibility('private');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Upload failed', err);
      const detail = err?.response?.data?.error || err?.message || 'Upload failed';
      setMessage(String(detail));
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
  }

  function handleDocClick(doc) {
    const id = doc._id || doc.id;
    if (!id) return;
    navigate(`/ask?docId=${id}`);
  }

  return (
    <div className="max-w-6xl mx-auto p-8 font-sans">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold">Documents</h1>
        <p className="text-sm text-gray-600">Upload and manage your documents</p>
      </div>

      {message && (
        <div className="mb-4 text-center text-sm text-red-600">{message}</div>
      )}

      {/* Upload card */}
      <div className="bg-white rounded p-6 mb-8 border">
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt"
              className="block w-full"
            />
            <div className="text-xs text-gray-500 mt-1">
              {file ? file.name : 'PDF, DOCX, or TXT — max 10MB suggested.'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-48 px-2 py-2 border rounded"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : 'Upload Document'}
            </button>
          </div>
        </form>
      </div>

      {/* Documents list */}
      <div className="bg-white rounded p-6 border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Your documents</h2>
          <div className="text-sm text-gray-600">{total} total</div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading documents…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">No documents found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((doc) => (
              <div
                key={doc._id}
                onClick={() => handleDocClick(doc)}
                className="p-4 border rounded hover:shadow cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">{doc.title || doc.original_name}</div>
                  <div className="text-xs px-2 py-1 rounded-full font-medium
                    {doc.visibility === 'public' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}">
                    {doc.visibility === 'public' ? 'Public' : 'Private'}
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-2">
                  {doc.pages ?? '-'} pages
                </div>

                <div className="text-xs">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    doc.status === 'indexed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {doc.status === 'indexed' ? 'Indexed' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination controls */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-600">Showing {Math.min(items.length, limit)} of {total}</div>
          <div className="flex gap-2">
            <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="px-3 py-1 border rounded">Prev</button>
            <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} className="px-3 py-1 border rounded">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
