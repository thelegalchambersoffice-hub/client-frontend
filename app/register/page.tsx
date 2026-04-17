"use client";

import { useState } from "react";
import axios from "axios";
import { apiUrl } from "../../lib/api";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function Register() {

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "client",
  });

  const router = useRouter();

  const register = async () => {
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
    };

    if (!payload.name || !payload.email || !payload.password) {
      toast.error("Fill all fields");
      return;
    }

    try {
      await axios.post(
        apiUrl("/api/auth/register"),
        payload
      );

      toast.success("Registered successfully!");
      router.push("/login");

    } catch {
      toast.error("Register failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">

      <div className="bg-slate-800 border border-emerald-500/20 rounded-xl shadow-xl p-8 w-full max-w-md">

        <h2 className="text-3xl font-bold text-emerald-400 text-center mb-6">
          Register
        </h2>

        <input
          placeholder="Full Name"
          value={form.name}
          className="w-full mb-3 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white"
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
        />

        <input
          placeholder="Email"
          type="email"
          value={form.email}
          className="w-full mb-3 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white"
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
        />

        <input
          type="password"
          placeholder="Password"
          value={form.password}
          className="w-full mb-3 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white"
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
        />

        <select
          value={form.role}
          className="w-full mb-6 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white"
          onChange={(e) =>
            setForm({ ...form, role: e.target.value })
          }
        >
          <option value="client">Client</option>
          <option value="admin">Admin</option>
          <option value="notary">Notary</option>
        </select>

        <button
          onClick={register}
          className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg text-white font-semibold"
        >
          Register
        </button>

      </div>
    </div>
  );
}
