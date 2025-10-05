// src/pages/AskPage.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser, useAuth } from "@clerk/clerk-react";
import axios from "axios";

export default function AskPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

  // Extract docId from query params
  const queryParams = new URLSearchParams(location.search);
  const docId = queryParams.get("docId") || null;

  const [docInfo, setDocInfo] = useState(null);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cached, setCached] = useState(false);
  const [meta, setMeta] = useState(null);

  // Fetch document info if docId present
  useEffect(() => {
    if (!docId || !isLoaded) return;

    const fetchDoc = async () => {
      try {
        const token = user ? await getToken({ template: "integration" }).catch(() => getToken()) : null;
        
        const res = await axios.get(`${BACKEND_URL}/api/docs/${docId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        setDocInfo(res.data);
      } catch (err) {
        console.error('Failed to fetch document:', err);
        setError(`Failed to load document: ${err?.response?.data?.error || err.message}`);
      }
    };

    fetchDoc();
  }, [docId, isLoaded, user, BACKEND_URL, getToken]);

  // Submit question
  const handleAsk = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmed = question?.trim();
    if (!trimmed) {
      setError("Please enter a question.");
      return;
    }

    setLoading(true);
    setAnswers([]);
    setCached(false);
    setMeta(null);

    try {
      const token = (isLoaded && user) ? await getToken({ template: "integration" }).catch(() => getToken()) : null;

      const body = { 
        query: trimmed, 
        k: 5,
        ...(docId && { docId }) // ✅ Include docId in request
      };

      console.log('[AskPage] Sending request:', body);

      const res = await axios.post(`${BACKEND_URL}/api/ask`, body, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        timeout: 120000,
      });

      const data = res.data || {};
      console.log('[AskPage] Response:', data);

      setCached(Boolean(data.cached));
      setMeta(data.meta || null);

      const serverAnswers = data.answers || [];
      if (!Array.isArray(serverAnswers) || serverAnswers.length === 0) {
        setError("No answer returned by the server.");
        setAnswers([]);
      } else {
        setAnswers(serverAnswers);
      }
    } catch (err) {
      console.error("Failed to get answer", err);
      const serverMsg = err?.response?.data?.error || err?.response?.data?.detail || err?.message;
      setError(typeof serverMsg === "string" ? serverMsg : JSON.stringify(serverMsg));
      setAnswers([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 font-sans">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Ask a Question</h1>
        {docId && docInfo && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <button
              onClick={() => navigate('/docs')}
              className="text-blue-600 hover:underline"
            >
              ← Back to Documents
            </button>
            <span>•</span>
            <span>
              Asking about: <strong className="text-gray-900">{docInfo.title || docInfo.original_name}</strong>
            </span>
            <span className={`px-2 py-1 rounded text-xs ${
              docInfo.visibility === 'public' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
            }`}>
              {docInfo.visibility}
            </span>
          </div>
        )}
        {docId && !docInfo && !error && (
          <p className="text-sm text-gray-500">Loading document info...</p>
        )}
        {!docId && (
          <p className="text-sm text-gray-600">Searching across all accessible documents</p>
        )}
      </div>

      {/* Question Form */}
      <form onSubmit={handleAsk} className="mb-6">
        <textarea
          className="w-full border border-gray-300 rounded-md p-3 mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          placeholder={
            docId 
              ? "Ask anything about this document..." 
              : "Ask a question about your documents..."
          }
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
        />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={loading || !question.trim()}
          >
            {loading ? "Getting answer..." : "Ask"}
          </button>

          {cached && (
            <span className="text-sm px-3 py-1 bg-yellow-100 text-yellow-800 rounded">
              📦 Cached result
            </span>
          )}

          {meta && (
            <span className="text-xs text-gray-500">
              {meta.vector_results} matches • {meta.elapsed_ms}ms
              {meta.document_filtered && ' • 🎯 Document-specific'}
            </span>
          )}
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Answer Display */}
      {answers.length > 0 ? (
        <section>
          <h2 className="text-2xl font-semibold mb-4">Answer</h2>
          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
            <div className="prose max-w-none mb-6">
              <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                {answers[0].text}
              </p>
            </div>

            {answers[0].confidence !== null && answers[0].confidence !== undefined && (
              <div className="mb-4 text-sm text-gray-600">
                Confidence: <strong>{(answers[0].confidence * 100).toFixed(1)}%</strong>
              </div>
            )}

            <h3 className="font-semibold mb-3 text-lg">Sources:</h3>
            {Array.isArray(answers[0].sources) && answers[0].sources.length > 0 ? (
              <div className="space-y-3">
                {answers[0].sources.map((source, i) => (
                  <div 
                    key={i} 
                    className="p-3 bg-gray-50 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-900">
                        [{i + 1}] {source.doc_title || `Document ${source.doc_id}`}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          Page {source.page}
                        </span>
                        {typeof source.score === "number" && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                            {(source.score * 100).toFixed(1)}% match
                          </span>
                        )}
                      </div>
                    </div>
                    {source.snippet && (
                      <div className="text-sm text-gray-700 italic mt-2 pl-3 border-l-2 border-gray-300">
                        "{source.snippet.length > 300 ? source.snippet.slice(0, 300) + "…" : source.snippet}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-600 italic">No sources provided.</div>
            )}
          </div>
        </section>
      ) : (
        !loading && !error && (
          <div className="text-center py-12 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium">No answers yet</p>
            <p className="text-sm mt-1">Ask a question above to get started</p>
          </div>
        )
      )}
    </main>
  );
}
