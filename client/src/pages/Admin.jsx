import React, { useState, useEffect } from "react";
import axios from "axios";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";

export default function AdminDashboard() {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState({
    total_docs: 0,
    total_chunks: 0,
    last_rebuild: null,
    last_error: null,
  });
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildMessage, setRebuildMessage] = useState("");

  const getToken = async () => {
    if (!user) return null;
    return await user.getToken();
  };

  useEffect(() => {
    if (isLoaded) {
      if (!user) {
        navigate("/sign-in", { replace: true });
      } else {
        const role = user.publicMetadata?.role;
        if (role === "admin") {
          setIsAdmin(true);
        } else {
          toast.error("Not authorized to access Admin Dashboard");
          navigate("/", { replace: true });
        }
      }
    }
  }, [isLoaded, user, navigate]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const token = await getToken();
      const { data } = await axios.get(`${BACKEND_URL}/api/index/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleRebuild = async () => {
    setRebuildLoading(true);
    setRebuildMessage("");
    try {
      const token = await getToken();
      const { data } = await axios.post(`${BACKEND_URL}/api/index/rebuild`, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setRebuildMessage(data.message || "Rebuild started");
      setTimeout(fetchStats, 5000);
    } catch (err) {
      setRebuildMessage("Failed to start rebuild");
      console.error(err);
    } finally {
      setRebuildLoading(false);
    }
  };

  if (!isLoaded || !isAdmin) return null;

  return (
    <>
      <Toaster position="top-right" />
      <main style={{ padding: "2rem", maxWidth: "600px", margin: "auto" }}>
        <h1>Admin Dashboard</h1>
        {loadingStats ? (
          <p>Loading stats...</p>
        ) : (
          <section style={{ marginBottom: "2rem" }}>
            <h2>Indexing Stats</h2>
            <ul>
              <li>Total Documents: <strong>{stats.total_docs}</strong></li>
              <li>Total Chunks (Vectors): <strong>{stats.total_chunks}</strong></li>
              <li>Last Rebuild: <strong>{stats.last_rebuild ? new Date(stats.last_rebuild).toLocaleString() : "Never"}</strong></li>
              <li>Last Error: <strong style={{ color: "red" }}>{stats.last_error || "None"}</strong></li>
            </ul>
          </section>
        )}

        <section>
          <button
            style={{
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              cursor: rebuildLoading ? "wait" : "pointer",
              backgroundColor: rebuildLoading ? "#999" : "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
            }}
            onClick={handleRebuild}
            disabled={rebuildLoading}
          >
            {rebuildLoading ? "Starting Rebuild..." : "Rebuild Index"}
          </button>
          {rebuildMessage && <p style={{ marginTop: "1rem", color: "green" }}>{rebuildMessage}</p>}
        </section>
      </main>
    </>
  );
}
