"use client";

import { useState } from "react";
import axios from "axios";
import { apiUrl } from "../../../lib/api";
import { toast } from "react-toastify";

export default function NotaryProfile() {

  const [sign, setSign] = useState<File|null>(null);
  const [stamp, setStamp] = useState<File|null>(null);

  const upload = async () => {

    const token = localStorage.getItem("token");

    if (!token) {
      toast.error("Login again");
      return;
    }

    const fd = new FormData();

    if (sign) fd.append("signature", sign);
    if (stamp) fd.append("stamp", stamp);

    await axios.post(
      apiUrl("/api/notary/upload-assets"),
      fd,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    toast.success("Uploaded successfully");
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">

      <h1 className="text-2xl mb-6 text-emerald-400">
        Notary Profile
      </h1>

      <div className="space-y-5 max-w-md">

        <div>
          <p>Upload Signature</p>
          <input
            type="file"
            onChange={e=>setSign(e.target.files?.[0]||null)}
          />
        </div>

        <div>
          <p>Upload Stamp</p>
          <input
            type="file"
            onChange={e=>setStamp(e.target.files?.[0]||null)}
          />
        </div>

        <button
          onClick={upload}
          className="bg-emerald-600 px-5 py-2 rounded"
        >
          Save
        </button>

      </div>

    </div>
  );
}
