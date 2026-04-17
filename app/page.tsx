"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">

      <h1 className="text-5xl font-bold text-emerald-400 mb-4">
        Legal Notary Platform
      </h1>

      <p className="text-slate-400 mb-8">
        Secure Digital Notarization System
      </p>

      <div className="flex gap-6">

        <Link
          href="/login"
          className="bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-lg text-white font-semibold"
        >
          Login
        </Link>

        <Link
          href="/register"
          className="border border-emerald-500 px-8 py-3 rounded-lg text-emerald-400 font-semibold hover:bg-emerald-500/10"
        >
          Register
        </Link>

      </div>

    </div>
  );
}
