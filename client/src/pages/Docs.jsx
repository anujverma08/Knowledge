import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Docs() {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();

  // Backend URL from environment variable
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const [items, setItems] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState('private');

  // Get Clerk token for Authorization header
  const getToken = async () => {
    if (!user) return null;
    return await user.getToken();
  };

  // Fetch documents from backend
  const fetchDocuments = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get(`${BACKEND_URL}/api/docs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to fetch documents', err);
    }
  };

  useEffect(() => {
    if (isLoaded && user) {
      fetchDocuments();
    }
  }, [isLoaded, user]);

  // Handle file upload form submission
  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);

    try {
      const token = await getToken();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('visibility', visibility);

      await axios.post(`${BACKEND_URL}/api/docs`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      // Refresh document list after upload
      await fetchDocuments();

      // Reset form
      setFile(null);
      setTitle('');
      setVisibility('private');
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  }

  // File input change handler
  function handleFileChange(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
  }

  // Navigate to /ask with selected doc id
  function handleDocClick(doc) {
    navigate(`/ask?docId=${doc._id || doc.id}`);
  }

  if (!isLoaded || !user) return null;

  return (
    <div className="max-w-6xl mx-auto p-8 font-sans">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Documents</h1>
        <p className="text-lg text-gray-600">Manage and organize your documents</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-200">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-1">
            Upload New Document
          </h2>
          <p className="text-gray-600">
            Share your knowledge with the community
          </p>
        </div>

        <form onSubmit={handleUpload} className="space-y-6">
          <div>
            <label className="cursor-pointer block">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10,9 9,9 8,9" />
                </svg>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-700">
                    {file ? file.name : 'Click to upload or drag and drop'}
                  </span>
                  <span className="text-sm text-gray-500 mt-1">
                    PDF, DOC, DOCX up to 10MB
                  </span>
                </div>
              </div>
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx"
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a descriptive title"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Visibility
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors"
              >
                <option value="private">🔒 Private</option>
                <option value="public">🌍 Public</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-indigo-600 hover:to-purple-700 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 text-sm"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Uploading...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7,10 12,15 17,10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Upload Document
              </>
            )}
          </button>
        </form>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Your Documents</h2>
          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
            {items.length} documents
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((doc) => (
            <div
              key={doc.id || doc._id}
              onClick={() => handleDocClick(doc)}
              className="border border-gray-200 rounded-lg p-5 hover:border-gray-300 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer"
            >
              <div className="text-indigo-500 mb-3">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                </svg>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">{doc.title}</h3>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-gray-600">{doc.pages} pages</span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      doc.status === 'processed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {doc.status === 'processed' ? '✓ Processed' : '⏳ Processing'}
                  </span>
                </div>
                <div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      doc.visibility === 'private'
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {doc.visibility === 'private' ? '🔒 Private' : '🌍 Public'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
