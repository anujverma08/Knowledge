// src/pages/AskPage.jsx
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useUser, useAuth } from "@clerk/clerk-react";
import axios from "axios";

export default function AskPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const location = useLocation();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

  // Extract docId from query params
  const queryParams = new URLSearchParams(location.search);
  const docId = queryParams.get("docId") || null;

  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cached, setCached] = useState(false);

  // helper to get a token (returns null if not available)
  const fetchToken = async () => {
    try {
      return await getToken({ template: "integration" }).catch(() => getToken());
    } catch {
      return null;
    }
  };

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

    try {
      const token = (isLoaded && user) ? await fetchToken() : null;

      const body = { query: trimmed, k: 5 };
      if (docId) body.docId = docId;

      const res = await axios.post(`${BACKEND_URL}/api/ask`, body, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        timeout: 120000,
      });

      const data = res.data || {};
      // server may return { cached: true, ... } so capture it
      setCached(Boolean(data.cached));

      const serverAnswers = data.answers || [];
      if (!Array.isArray(serverAnswers) || serverAnswers.length === 0) {
        setError("No answer returned by the server.");
        setAnswers([]);
      } else {
        setAnswers(serverAnswers);
      }
    } catch (err) {
      console.error("Failed to get answer", err);
      // Try to show helpful message from server
      const serverMsg = err?.response?.data?.error || err?.response?.data || err?.message;
      setError(typeof serverMsg === "string" ? serverMsg : JSON.stringify(serverMsg));
      setAnswers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // optional: pre-fill or prompt when docId present
    if (docId) {
      // Example: you could pre-set question to "Summarize document" or leave blank
      // setQuestion(`About document ${docId}: `);
    }
  }, [docId]);

  if (!isLoaded) {
    return <p>Loading user info...</p>;
  }

  return (
    <main className="max-w-4xl mx-auto p-6 font-sans">
      <h1 className="text-3xl font-bold mb-6">Ask a Question</h1>

      <form onSubmit={handleAsk} className="mb-6">
        <textarea
          className="w-full border border-gray-300 rounded-md p-3 mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          placeholder={docId ? "Ask about the selected document..." : "Enter your question here..."}
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
            <span className="text-sm text-gray-600">Returned from cache</span>
          )}
        </div>
      </form>

      {error && (
        <div className="text-red-600 mb-4 font-medium">{error}</div>
      )}

      {answers.length > 0 ? (
        <section>
          <h2 className="text-2xl font-semibold mb-4">Answer</h2>
          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
            <p className="whitespace-pre-wrap mb-6">{answers[0].text}</p>

            <h3 className="font-semibold mb-2">Sources:</h3>
            {Array.isArray(answers[0].sources) && answers[0].sources.length > 0 ? (
              <ul className="list-disc pl-5 space-y-3">
                {answers[0].sources.map((source, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    <div>
                      Document ID: <code>{source.doc_id}</code>, Page: <strong>{source.page}</strong>
                      {typeof source.score === "number" && (
                        <> — Score: {Number(source.score).toFixed(4)}</>
                      )}
                    </div>
                    {source.snippet ? (
                      <div className="italic text-gray-600 mt-1">
                        {source.snippet.length > 250 ? source.snippet.slice(0, 250) + "…" : source.snippet}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-600">No sources provided.</div>
            )}
          </div>
        </section>
      ) : (
        !loading && !error && (
          <div className="text-sm text-gray-600">No answers yet — ask a question above.</div>
        )
      )}
    </main>
  );
}
