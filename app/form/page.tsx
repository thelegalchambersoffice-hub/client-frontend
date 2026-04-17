"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import axios from "axios";
import { apiUrl } from "../../lib/api";
import { toast } from "react-toastify";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

function FormPageContent() {

  const router = useRouter();
  const searchParams = useSearchParams();

  const editId = searchParams.get("edit");
  const isEdit = Boolean(editId);


  /* ================= AUTH ================= */

  useEffect(() => {

    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "client") {
      router.push("/login");
    }

  }, [router]);


  /* ================= STATE ================= */

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    documentType: "",
  });

  const [aadhaar, setAadhaar] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [document, setDocument] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [existingFiles, setExistingFiles] = useState({
    aadhaar_url: "",
    photo_url: "",
    document_url: "",
  });

  const [loading, setLoading] = useState(false);

  const loadRazorpayScript = async () => {
    if (window.Razorpay) return true;

    const script = window.document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    const loaded = await new Promise<boolean>((resolve) => {
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      window.document.body.appendChild(script);
    });

    return loaded;
  };

  const startRazorpayPayment = async (token: string) => {
    const orderRes = await axios.post(
      apiUrl("/api/payment/create-order"),
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) {
      throw new Error("Razorpay checkout failed to load");
    }

    const paymentData = await new Promise<{
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    } | null>((resolve) => {
      const razorpay = new window.Razorpay({
        key: orderRes.data.keyId,
        amount: orderRes.data.amount,
        currency: orderRes.data.currency,
        name: "The Legal Chamber",
        description: "Notary service payment",
        order_id: orderRes.data.orderId,
        prefill: {
          name: form.name,
          email: form.email,
          contact: form.phone,
        },
        theme: {
          color: "#059669",
        },
        handler: (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => resolve(response),
        modal: {
          ondismiss: () => resolve(null),
        },
      });

      razorpay.open();
    });

    return paymentData;
  };


  /* ================= LOAD OLD DATA ================= */

  useEffect(() => {

    if (!isEdit) return;

    const loadOld = async () => {

      try {

        const token = localStorage.getItem("token");

        const res = await axios.get(
          apiUrl(`/api/client/request/${editId}`),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = res.data;

        setForm({
          name: data.name,
          email: data.email,
          phone: data.phone,
          documentType: data.document_type,
        });
        setExistingFiles({
          aadhaar_url: data.aadhaar_url || "",
          photo_url: data.photo_url || "",
          document_url: data.document_url || "",
        });

      } catch {
        toast.error("Failed to load old form");
      }
    };

    loadOld();

  }, [isEdit, editId]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return;

    const video = videoRef.current;
    const stream = streamRef.current;
    setCameraReady(false);

    video.srcObject = stream;
    const tryPlay = async () => {
      try {
        await video.play();
        setCameraReady(true);
      } catch (err) {
        console.error("VIDEO PLAY ERROR:", err);
        setCameraError("Unable to start camera preview.");
      }
    };

    video.onloadedmetadata = () => {
      tryPlay();
    };

    if (video.readyState >= 1) {
      tryPlay();
    }

    return () => {
      video.onloadedmetadata = null;
    };
  }, [cameraOpen]);

  useEffect(() => {
    if (!photo) {
      setPhotoPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(photo);
    setPhotoPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [photo]);


  /* ================= FILE UPLOAD ================= */

  const uploadFile = async (file: File, token: string) => {

    const formData = new FormData();
    formData.append("document", file);

    const res = await axios.post(
      apiUrl("/api/upload"),
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return res.data.path;
  };

  const getFileName = (path: string) => {
    if (!path) return "";
    const parts = path.split("/");
    return parts[parts.length - 1];
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCameraReady(false);
  };

  const openCamera = async () => {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOpen(true);
      setCameraReady(false);
    } catch (err) {
      console.error("CAMERA ERROR:", err);
      setCameraError("Camera access failed. Check camera permission.");
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    if (!cameraReady || !video.videoWidth || !video.videoHeight) {
      setCameraError("Camera preview is not ready yet.");
      return;
    }

    const canvas = window.document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );

    if (!blob) return;

    const file = new File([blob], `live-photo-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });

    setPhoto(file);
    closeCamera();
  };


  /* ================= HANDLERS ================= */

  const handleChange = (e: any) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };


  /* ================= SUBMIT ================= */

  const submitForm = async () => {

    if (!form.name || !form.email || !form.phone || !form.documentType) {
      toast.error("Fill all fields");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);

    try {

      /* ===== EDIT MODE ===== */

      if (isEdit) {

        const [aadhaarPath, photoPath, documentPath] = await Promise.all([
          aadhaar ? uploadFile(aadhaar, token) : existingFiles.aadhaar_url,
          photo ? uploadFile(photo, token) : existingFiles.photo_url,
          document ? uploadFile(document, token) : existingFiles.document_url,
        ]);

        await axios.post(

          apiUrl("/api/client/resubmit"),

          {
            id: editId,
            ...form,
            aadhaar_url: aadhaarPath,
            photo_url: photoPath,
            document_url: documentPath,
          },

          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        toast.success("Resubmitted successfully");

        router.push("/client");

        return;
      }


      /* ===== NEW SUBMIT ===== */

      if (!aadhaar || !photo || !document) {
        toast.error("Upload all files");
        return;
      }

      toast.info("Opening payment gateway...");
      const paymentResult = await startRazorpayPayment(token);
      if (!paymentResult) {
        toast.info("Payment cancelled");
        return;
      }
      toast.success("Payment successful");


      const [aadhaarPath, photoPath, documentPath] = await Promise.all([

        uploadFile(aadhaar, token),
        uploadFile(photo, token),
        uploadFile(document, token),

      ]);


      await axios.post(

        apiUrl("/api/client/submit"),

        {
          ...form,

          aadhaar_url: aadhaarPath,
          photo_url: photoPath,
          document_url: documentPath,
          ...paymentResult,
        },

        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );


      toast.success("Form submitted");

      router.push("/client");


    } catch (err: any) {

      console.error(err);

      toast.error(err?.response?.data?.error || err?.message || "Submission failed");

    } finally {

      setLoading(false);
    }
  };

  const submitFormBypassPayment = async () => {
    if (!form.name || !form.email || !form.phone || !form.documentType) {
      toast.error("Fill all fields");
      return;
    }

    if (!aadhaar || !photo || !document) {
      toast.error("Upload all files");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const [aadhaarPath, photoPath, documentPath] = await Promise.all([
        uploadFile(aadhaar, token),
        uploadFile(photo, token),
        uploadFile(document, token),
      ]);

      await axios.post(
        apiUrl("/api/client/submit-test"),
        {
          ...form,
          aadhaar_url: aadhaarPath,
          photo_url: photoPath,
          document_url: documentPath,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      toast.success("Submitted in test mode");
      router.push("/client");
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.error || err?.message || "Test submit failed",
      );
    } finally {
      setLoading(false);
    }
  };


  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-slate-900">

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="text-center mb-16">

          <h1 className="text-5xl font-bold text-emerald-400 mb-3">
            Legal Notary Services
          </h1>

          <p className="text-slate-300 text-lg">
            Professional Digital Notarization
          </p>

        </div>


        {/* Card */}
        <div className="bg-slate-800 border border-emerald-500/20 rounded-xl shadow-xl overflow-hidden">

          <div className="border-b border-slate-700 px-8 py-6">

            <h2 className="text-2xl text-emerald-400 font-semibold">
              Application Form
            </h2>

          </div>


          <div className="p-8">

            {/* Name */}
            <input
              name="name"
              value={form.name}
              placeholder="Full Name"
              onChange={handleChange}
              className="w-full mb-4 bg-slate-900 border border-slate-600 px-4 py-3 rounded-lg text-white"
            />


            {/* Email */}
            <input
              name="email"
              value={form.email}
              placeholder="Email"
              onChange={handleChange}
              className="w-full mb-4 bg-slate-900 border border-slate-600 px-4 py-3 rounded-lg text-white"
            />


            {/* Phone */}
            <input
              name="phone"
              value={form.phone}
              placeholder="Phone"
              onChange={handleChange}
              className="w-full mb-4 bg-slate-900 border border-slate-600 px-4 py-3 rounded-lg text-white"
            />


            {/* Type */}
            <select
              name="documentType"
              value={form.documentType}
              onChange={handleChange}
              className="w-full mb-6 bg-slate-900 border border-slate-600 px-4 py-3 rounded-lg text-white"
            >
              <option value="">Select Type</option>
              <option value="affidavit">Affidavit</option>
              <option value="rent">Rent Agreement</option>
              <option value="service">Service Agreement</option>
            </select>


            {/* FILE UPLOAD UI */}
            {(

              <div className="space-y-6">

                {/* Aadhaar */}
                <div>

                  <label className="block text-slate-300 mb-3 text-lg font-medium">
                    Aadhaar Card {isEdit && "(optional)"}
                  </label>

                  <div className="relative">

                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setAadhaar(e.target.files?.[0] || null)}
                      className="hidden"
                      id="aadhaar-input"
                    />

                    <label
                      htmlFor="aadhaar-input"
                      className="flex items-center justify-between w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 cursor-pointer hover:border-emerald-500 transition-all"
                    >

                      <span className="text-slate-400 text-sm">
                        {aadhaar ? aadhaar.name : "Choose file..."}
                      </span>

                      <svg
                        className="w-5 h-5 text-emerald-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>

                    </label>

                  </div>

                  {aadhaar && (
                    <p className="text-emerald-400 text-xs mt-2">
                      ✓ File uploaded
                    </p>
                  )}

                  {!aadhaar && isEdit && existingFiles.aadhaar_url && (
                    <p className="text-slate-400 text-xs mt-2">
                      Current: {getFileName(existingFiles.aadhaar_url)}
                    </p>
                  )}

                </div>


                                {/* Photo */}
                <div>

                  <label className="block text-slate-300 mb-3 text-lg font-medium">
                    Photograph {isEdit && "(optional)"}
                  </label>

                  <button
                    type="button"
                    onClick={openCamera}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-left hover:border-emerald-500 transition-all text-slate-300"
                  >
                    {photo ? "Retake photo" : "Open camera and capture photo"}
                  </button>

                  {cameraError && (
                    <p className="text-red-400 text-xs mt-2">{cameraError}</p>
                  )}

                  {cameraOpen && (
                    <div className="mt-3 rounded-lg border border-slate-600 p-3 bg-slate-900">
                      <video
                        ref={videoRef}
                        className="h-60 w-55 rounded-md bg-black object-cover"
                        playsInline
                        muted
                        autoPlay
                      />
                      {!cameraReady && (
                        <p className="text-slate-400 text-xs mt-2">
                          Starting camera preview...
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          disabled={!cameraReady}
                          className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-white"
                        >
                          Capture
                        </button>
                        <button
                          type="button"
                          onClick={closeCamera}
                          className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {photo && (
                    <p className="text-emerald-400 text-xs mt-2">
                      Captured: {photo.name}
                    </p>
                  )}

                  {photoPreviewUrl && (
                    <img
                      src={photoPreviewUrl}
                      alt="Captured preview"
                      className="mt-3 h-32 w-32 rounded border border-slate-600 object-cover"
                    />
                  )}

                  {!photo && isEdit && existingFiles.photo_url && (
                    <p className="text-slate-400 text-xs mt-2">
                      Current: {getFileName(existingFiles.photo_url)}
                    </p>
                  )}

                </div>


                {/* Document */}
                <div>

                  <label className="block text-slate-300 mb-3 text-lg font-medium">
                    Document to be Notarized {isEdit && "(optional)"}
                  </label>

                  <div className="relative">

                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setDocument(e.target.files?.[0] || null)}
                      className="hidden"
                      id="document-input"
                    />

                    <label
                      htmlFor="document-input"
                      className="flex items-center justify-between w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 cursor-pointer hover:border-emerald-500 transition-all"
                    >

                      <span className="text-slate-400 text-sm">
                        {document ? document.name : "Choose file..."}
                      </span>

                      <svg
                        className="w-5 h-5 text-emerald-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>

                    </label>

                  </div>

                  {document && (
                    <p className="text-emerald-400 text-xs mt-2">
                      ✓ File uploaded
                    </p>
                  )}

                  {!document && isEdit && existingFiles.document_url && (
                    <p className="text-slate-400 text-xs mt-2">
                      Current: {getFileName(existingFiles.document_url)}
                    </p>
                  )}

                </div>

              </div>
            )}


            {/* Submit */}
            <button
              onClick={submitForm}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg text-white font-semibold mt-8 disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : isEdit
                  ? "Resubmit Form"
                  : "Proceed to Payment - ₹500"}
            </button>

            {!isEdit && (
              <button
                type="button"
                onClick={submitFormBypassPayment}
                disabled={loading}
                className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-lg text-white font-semibold mt-3 disabled:opacity-50"
              >
                Test Submit (Bypass Payment)
              </button>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}

export default function FormPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <FormPageContent />
    </Suspense>
  );
}




