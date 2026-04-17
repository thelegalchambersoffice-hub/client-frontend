"use client";

import axios from "axios";
import { apiUrl } from "../../lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function Admin() {
  const router = useRouter();

  const [requests, setRequests] = useState<any[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [notaries, setNotaries] = useState([]);

  useEffect(() => {
    const role = localStorage.getItem("role");
    const token = localStorage.getItem("token");

    if (!token || role !== "admin") {
      router.push("/login");
      return;
    }

    loadNotaries();
    load();
  }, []);

  const logout = () => {
    localStorage.clear();
    router.push("/login");
  };

  // Load Requests
  const load = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get(apiUrl("/api/admin/requests"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setRequests(res.data);
    } catch (err) {
      console.error("LOAD ERROR:", err);

      toast.error("Failed to load requests");
    }
  };

  // Approve
  const approve = async (id: string, notaryId: string) => {
    if (!notaryId) {
      toast.error("Please select a notary");
      return;
    }

    try {
      const token = localStorage.getItem("token");

      await axios.post(
        apiUrl("/api/admin/approve"),
        {
          requestId: id,
          notaryId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      toast.success("Approved");

      load();
    } catch (err) {
      console.error("APPROVE ERROR:", err);

      toast.error("Approve failed");
    }
  };

  const loadNotaries = async () => {
    const token = localStorage.getItem("token");

    const res = await axios.get(apiUrl("/api/admin/notaries"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setNotaries(res.data);
  };

  // Reject
  const reject = async (id: string) => {
    const msg = messages[id];

    if (!msg) {
      toast.error("Enter message");
      return;
    }

    try {
      const token = localStorage.getItem("token");

      await axios.post(
        apiUrl("/api/admin/reject"),

        {
          requestId: id,
          message: msg,
        },

        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      toast.success("Rejected");

      // Clear only this message
      setMessages({
        ...messages,
        [id]: "",
      });

      load();
    } catch (err) {
      console.error(err);

      toast.error("Reject failed");
    }
  };

  // View uploaded file (Aadhaar / Photo / Document)
  const viewFile = async (path: string) => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get(apiUrl("/api/download"), {
        params: { path },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Open in new tab
      window.open(res.data.url, "_blank");
    } catch (err) {
      console.error("VIEW FILE ERROR:", err);

      toast.error("Failed to load file");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl text-emerald-400">Admin Dashboard</h1>
        <button
          onClick={logout}
          className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-white"
        >
          Logout
        </button>
        </div>

        {!requests.length && (
        <p className="rounded-xl border border-slate-700 bg-slate-800 p-6 text-slate-300">
          No requests yet.
        </p>
      )}

        {requests.map((r) => (
        <div
          key={r.id}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-4"
        >
          <p className="text-slate-300">
            <b>Name:</b> {r.name}
          </p>

          <p className="text-slate-300">
            <b>Email:</b> {r.email}
          </p>

          <p className="text-slate-300">
            <b>Type:</b> {r.document_type}
          </p>

          {/* Uploaded Files */}
          <div className="mt-3 space-y-2">
            {r.aadhaar_url && (
              <button
                onClick={() => viewFile(r.aadhaar_url)}
                className="text-emerald-400 underline block"
              >
                View Aadhaar
              </button>
            )}

            {r.photo_url && (
              <button
                onClick={() => viewFile(r.photo_url)}
                className="text-emerald-400 underline block"
              >
                View Photo
              </button>
            )}

            {r.document_url && (
              <button
                onClick={() => viewFile(r.document_url)}
                className="text-emerald-400 underline block"
              >
                View Document
              </button>
            )}
          </div>

          <p className="text-slate-400">Status: {r.status}</p>

          {r.status === "pending" && (
            <div className="mt-4 space-y-3">
              {/* Notary Selector */}
              <select
                onChange={(e) => approve(r.id, e.target.value)}
                className="bg-slate-900 border border-slate-600 px-3 py-2 rounded text-white w-full"
              >
                <option value="">Select Notary</option>

                {notaries.map((n: any) => (
                  <option key={n.id} value={n.id}>
                    #{n.notary_number} - {n.name}
                  </option>
                ))}
              </select>

              {/* Reject Button */}
              <button
                onClick={() => reject(r.id)}
                className="bg-red-600 px-4 py-2 rounded text-white w-full"
              >
                Reject
              </button>
            </div>
          )}

          {(r.status === "rejected" || r.status === "notary_rejected") && (

            <p className="text-red-400 mt-2">Message: {r.admin_message}</p>
          )}

          <input
            placeholder="Rejection message"
            value={messages[r.id] || ""}
            onChange={(e) =>
              setMessages({
                ...messages,
                [r.id]: e.target.value,
              })
            }
            className="w-full mt-3 bg-slate-900 border border-slate-600 px-3 py-2 rounded text-white"
          />
        </div>
        ))}
      </div>
    </div>
  );
}
