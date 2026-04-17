"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { apiUrl } from "../../lib/api";
import { toast } from "react-toastify";

export default function Client() {
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.clear();
    router.push("/login");
  };

  const loadRequests = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        logout();
        return;
      }

      const res = await axios.get(apiUrl("/api/client/requests"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setRequests(res.data);
    } catch (err: any) {
      console.error("LOAD ERROR:", err);

      if (err?.response?.status === 401) {
        logout();
      } else {
        toast.error("Failed to load requests");
      }
    } finally {
      setLoading(false);
    }
  };

  const viewFile = async (path: string) => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get(apiUrl("/api/download"), {
        params: { path },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      window.open(res.data.url, "_blank");
    } catch (err) {
      console.error("VIEW FILE ERROR:", err);
      toast.error("Failed to open signed document");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "client") {
      router.push("/login");
      return;
    }

    loadRequests();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl text-emerald-400">Client Dashboard</h1>
        <button
          onClick={logout}
          className="rounded bg-red-600 px-4 py-2 hover:bg-red-500"
        >
          Logout
        </button>
      </div>

      <div className="mb-6">
        <button
          onClick={() => router.push("/form")}
          className="rounded bg-emerald-600 px-6 py-3 font-semibold hover:bg-emerald-500"
        >
          + New Request
        </button>
      </div>

      {loading && <p className="text-slate-400">Loading your requests...</p>}

      {!loading && requests.length === 0 && (
        <p className="text-slate-400">No requests submitted yet</p>
      )}

      {!loading &&
        requests.map((r) => {
          const isRejected =
            r.status === "rejected" || r.status === "notary_rejected";
          const isVerified =
            !isRejected &&
            (r.status === "verified" || r.notary_status === "verified");

          return (
          <div
            key={r.id}
            className="mb-5 rounded-xl border border-slate-700 bg-slate-800 p-6"
          >
            <h2 className="mb-1 text-lg font-semibold">{r.document_type}</h2>

            <p>
              Status:
              <span
                className={`ml-2 font-semibold ${
                  r.status === "approved" || isVerified
                    ? "text-green-400"
                    : r.status === "rejected" || r.status === "notary_rejected"
                    ? "text-red-400"
                    : "text-yellow-400"
                }`}
              >
                {isVerified ? "verified" : r.status}
              </span>
            </p>

            {(r.status === "rejected" || r.status === "notary_rejected") && (
              <div className="mt-3 rounded bg-red-900/30 p-3">
                <p className="font-semibold text-red-400">Rejected</p>
                <p className="mt-1 text-sm">
                  Reason: {r.admin_message || "No reason provided"}
                </p>
                <button
                  onClick={() => router.push(`/form?edit=${r.id}`)}
                  className="mt-3 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
                >
                  Edit and Resubmit
                </button>
              </div>
            )}

            {r.status === "approved" && (
              <p className="mt-3 font-semibold text-green-400">
                Approved by admin. Notary will sign the document soon.
              </p>
            )}

            {isVerified && (
              <div className="mt-3">
                <p className="font-semibold text-green-400">
                  Signed and verified by notary.
                </p>
                {r.document_url && (
                  <button
                    onClick={() => viewFile(r.document_url)}
                    className="mt-2 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
                  >
                    View Signed Document
                  </button>
                )}
              </div>
            )}

            {r.status === "pending" && (
              <p className="mt-3 font-semibold text-yellow-400">Under review</p>
            )}
          </div>
          );
        })}
    </div>
  );
}
