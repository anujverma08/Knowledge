    // src/pages/AskPage.jsx
    import React, { useState, useEffect } from "react";
    import { useLocation } from "react-router-dom";
    import { useUser } from "@clerk/clerk-react";
    import axios from "axios";

    export default function AskPage() {
    const { user, isLoaded } = useUser();
    const location = useLocation();

    // Backend URL environment variable
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    // Extract docId from query params to support asking with a document context
    const queryParams = new URLSearchParams(location.search);
    const docId = queryParams.get("docId") || null;

    const [question, setQuestion] = useState("");
    const [answers, setAnswers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Get authorization token helper
    const getToken = async () => {
        if (!user) return null;
        return await user.getToken();
    };

    // Submit the question to backend
    const handleAsk = async (e) => {
        e.preventDefault();
        if (!question.trim()) return;
        setLoading(true);
        setError(null);

        try {
        const token = await getToken();
        const body = { query: question, k: 5 };
        if (docId) {
            body.docId = docId; // You can modify backend to accept and filter by doc id if desired
        }

        const { data } = await axios.post(`${BACKEND_URL}/api/ask`, body, {
            headers: { Authorization: `Bearer ${token}` },
        });

        setAnswers(data.answers || []);
        } catch (err) {
        console.error("Failed to get answer", err);
        setError("Failed to get answer. Please try again.");
        setAnswers([]);
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        // Optional: if docId present, pre-fill question or prompt user
        if (docId) {
        setQuestion(""); // or prepopulate with "About document XYZ"
        }
    }, [docId]);

    if (!isLoaded || !user) {
        return <p>Loading user info...</p>;
    }

    return (
        <main className="max-w-4xl mx-auto p-6 font-sans">
        <h1 className="text-3xl font-bold mb-6">Ask a Question</h1>

        <form onSubmit={handleAsk} className="mb-8">
            <textarea
            className="w-full border border-gray-300 rounded-md p-3 mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Enter your question here..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
            />

            <button
            type="submit"
            className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={loading || !question.trim()}
            >
            {loading ? "Getting answer..." : "Ask"}
            </button>
        </form>

        {error && (
            <div className="text-red-600 mb-4 font-medium">
            {error}
            </div>
        )}

        {answers.length > 0 && (
            <section>
            <h2 className="text-2xl font-semibold mb-4">Answer</h2>
            <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
                <p className="whitespace-pre-wrap mb-6">{answers[0].text}</p>

                {/* Show sources with page refs and snippets */}
                <h3 className="font-semibold mb-2">Sources:</h3>
                <ul className="list-disc pl-5 space-y-2">
                {answers[0].sources.map((source, i) => (
                    <li key={i} className="text-sm text-gray-700">
                    <div>
                        Document ID: <code>{source.doc_id}</code>, Page: <strong>{source.page}</strong>, Score:{" "}
                        {source.score.toFixed(4)}
                    </div>
                    <div className="italic text-gray-600 mt-1">
                        {source.snippet.length > 200 ? source.snippet.slice(0, 200) + "…" : source.snippet}
                    </div>
                    </li>
                ))}
                </ul>
            </div>
            </section>
        )}
        </main>
    );
    }
