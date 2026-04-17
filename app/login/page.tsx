"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { apiUrl } from "../../lib/api";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();

  //Auto redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (token && role) {
      if (role === "client") router.push("/form");
      else router.push(`/${role}`);
    }
  }, []);

  const login = async () => {
    if (!email || !password) {
      toast.error("Fill all fields");
      return;
    }

    try {
      const res = await axios.post(apiUrl("/api/auth/login"), {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("user_id", res.data.user.id);

      // Redirect by role
      if (res.data.role === "client") {
        router.push("/client"); // ✅ dashboard first
      }

      if (res.data.role === "admin") {
        router.push("/admin");
      }

      if (res.data.role === "notary") {
        router.push("/notary");
      } else {
        router.push(`/${res.data.role}`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="bg-slate-800 border border-emerald-500/20 rounded-xl shadow-xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-emerald-400 text-center mb-6">
          Login
        </h2>

        <input
          placeholder="Email"
          type="email"
          className="w-full mb-4 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-emerald-500 outline-none"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-6 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-emerald-500 outline-none"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={login}
          className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg text-white font-semibold"
        >
          Login
        </button>

        <p className="text-slate-400 text-sm text-center mt-4">
          Don’t have an account?{" "}
          <a href="/register" className="text-emerald-400 hover:underline">
            Register
          </a>
        </p>
      </div>
    </div>
  );
}
