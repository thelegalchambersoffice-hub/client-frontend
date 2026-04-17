"use client";

import axios from "axios";
import { apiUrl } from "../../lib/api";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "react-toastify";

const PdfPagePreview = dynamic(() => import("../../components/PdfPagePreview"), {
  ssr: false,
});

type Placement = {
  x: number;
  y: number;
  page: number;
  widthPct: number;
  heightPct: number;
};

type NotaryAssets = {
  signaturePath: string | null;
  stampPath: string | null;
  signatureUrl: string | null;
  stampUrl: string | null;
};

export default function Notary() {
  const router = useRouter();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const pdfPageRef = useRef<HTMLDivElement | null>(null);

  const [requests, setRequests] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState<File | null>(null);
  const [stamp, setStamp] = useState<File | null>(null);
  const [removeSignatureBg, setRemoveSignatureBg] = useState(true);
  const [removeStampBg, setRemoveStampBg] = useState(true);

  const [notaryAssets, setNotaryAssets] = useState<NotaryAssets>({
    signaturePath: null,
    stampPath: null,
    signatureUrl: null,
    stampUrl: null,
  });

  const [placementOpen, setPlacementOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [documentSignedUrl, setDocumentSignedUrl] = useState("");
  const [activeTool, setActiveTool] = useState<"signature" | "stamp">(
    "signature",
  );
  const [placementMode, setPlacementMode] = useState(false);
  const [signaturePlacements, setSignaturePlacements] = useState<Placement[]>([]);
  const [stampPlacements, setStampPlacements] = useState<Placement[]>([]);
  const [placementPage, setPlacementPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pdfWidth, setPdfWidth] = useState(900);
  const [dragging, setDragging] = useState<{
    type: "signature" | "stamp";
    index: number;
  } | null>(null);
  const [resizing, setResizing] = useState<{
    type: "signature" | "stamp";
    index: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [signatureAspect, setSignatureAspect] = useState(3);
  const [stampAspect, setStampAspect] = useState(1);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "notary") {
      router.push("/login");
      return;
    }

    load();
    loadNotaryAssets();
  }, [router]);

  useEffect(() => {
    const updatePdfWidth = () => {
      const next = Math.max(280, Math.min(1000, window.innerWidth - 120));
      setPdfWidth(next);
    };

    updatePdfWidth();
    window.addEventListener("resize", updatePdfWidth);
    return () => window.removeEventListener("resize", updatePdfWidth);
  }, []);

  const logout = () => {
    localStorage.clear();
    router.push("/login");
  };

  const load = async () => {
    const token = localStorage.getItem("token");

    const res = await axios.get(apiUrl("/api/notary/requests"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setRequests(res.data);
  };

  const loadNotaryAssets = async (silent = false) => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get(apiUrl("/api/notary/assets"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNotaryAssets(res.data);
      const getAspect = (url?: string | null) =>
        new Promise<number>((resolve) => {
          if (!url) return resolve(1);
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1);
          img.onerror = () => resolve(1);
          img.src = url;
        });

      const [sigAspect, stAspect] = await Promise.all([
        getAspect(res.data.signatureUrl),
        getAspect(res.data.stampUrl),
      ]);
      setSignatureAspect(sigAspect);
      setStampAspect(stAspect);
      return res.data as NotaryAssets;
    } catch (err: any) {
      if (!silent) {
        console.error("LOAD ASSETS ERROR:", err);
      }
      return null;
    }
  };

  const removeWhiteBackground = async (file: File) => {
    const src = URL.createObjectURL(file);

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      });

      const canvas = window.document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return file;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Remove near-white pixels to transparent.
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 245 && g > 245 && b > 245) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );

      if (!blob) return file;

      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      return new File([blob], `${cleanName}-transparent.png`, {
        type: "image/png",
      });
    } catch (err) {
      console.error("REMOVE BG ERROR:", err);
      return file;
    } finally {
      URL.revokeObjectURL(src);
    }
  };

  const uploadAssets = async () => {
    if (!signature && !stamp) {
      toast.error("Select signature or stamp");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();

      const finalSignature =
        signature && removeSignatureBg
          ? await removeWhiteBackground(signature)
          : signature;
      const finalStamp =
        stamp && removeStampBg ? await removeWhiteBackground(stamp) : stamp;

      if (finalSignature) formData.append("signature", finalSignature);
      if (finalStamp) formData.append("stamp", finalStamp);

      await axios.post(apiUrl("/api/notary/upload-assets"), formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      await loadNotaryAssets(true);
      setSignature(null);
      setStamp(null);
      toast.success("Uploaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    }
  };

  const viewFile = async (path: string) => {
    const token = localStorage.getItem("token");

    const res = await axios.get(apiUrl("/api/download"), {
      params: { path },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    window.open(res.data.url, "_blank");
  };

  const verify = async (
    id: string,
    signaturePositions?: Placement[],
    stampPositions?: Placement[],
  ) => {
    const token = localStorage.getItem("token");

    try {
      await axios.post(
        apiUrl("/api/notary/verify"),
        {
          id,
          signaturePositions: signaturePositions || [],
          stampPositions: stampPositions || [],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      toast.success("Verified successfully");
      setPlacementOpen(false);
      setSelectedRequest(null);
      setDocumentSignedUrl("");
      setSignaturePlacements([]);
      setStampPlacements([]);
      setPlacementPage(1);
      setNumPages(1);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Verify failed");
    }
  };

  const reject = async (id: string) => {
    if (!message) {
      toast.error("Enter reason");
      return;
    }

    const token = localStorage.getItem("token");

    await axios.post(
      apiUrl("/api/notary/reject"),
      { requestId: id, message },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    setMessage("");
    toast.success("Rejected");
    load();
  };

  const openPlacement = async (request: any) => {
    try {
      const latestAssets = (await loadNotaryAssets(true)) || notaryAssets;

      if (!latestAssets.signatureUrl || !latestAssets.stampUrl) {
        toast.error("Upload signature and stamp first");
        return;
      }

      const token = localStorage.getItem("token");

      const res = await axios.get(apiUrl("/api/download"), {
        params: { path: request.document_url },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSelectedRequest(request);
      setDocumentSignedUrl(res.data.url);
      setSignaturePlacements([]);
      setStampPlacements([]);
      setPlacementPage(1);
      setNumPages(1);
      setActiveTool("signature");
      setPlacementMode(false);
      setPlacementOpen(true);
    } catch (err) {
      console.error("OPEN PLACEMENT ERROR:", err);
      toast.error("Failed to load document preview");
    }
  };

  const isImageDocument = (path: string) => {
    const lower = path.toLowerCase();
    return (
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".webp")
    );
  };

  const isPdfDocument = (path: string) => {
    return path.toLowerCase().endsWith(".pdf");
  };

  const getPlacementRect = () => {
    const isPdf = selectedRequest && isPdfDocument(selectedRequest.document_url);
    if (isPdf && pdfPageRef.current) {
      return pdfPageRef.current.getBoundingClientRect();
    }
    if (previewRef.current) {
      return previewRef.current.getBoundingClientRect();
    }
    return null;
  };

  const removeSignaturePlacement = (index: number) => {
    setSignaturePlacements((prev) => prev.filter((_, i) => i !== index));
  };

  const removeStampPlacement = (index: number) => {
    setStampPlacements((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSignaturePlacement = (
    index: number,
    patch: Partial<Placement>,
  ) => {
    setSignaturePlacements((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
  };

  const updateStampPlacement = (index: number, patch: Partial<Placement>) => {
    setStampPlacements((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
  };

  const onPreviewClick = (e: MouseEvent<HTMLElement>) => {
    const rect = getPlacementRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const nextPlacement = {
      x,
      y,
      page: placementPage,
      widthPct: activeTool === "signature" ? 24 : 18,
      heightPct: activeTool === "signature" ? 10 : 18,
    };

    if (activeTool === "signature") {
      setSignaturePlacements((prev) => [...prev, nextPlacement]);
      setPlacementMode(false);
      return;
    }

    setStampPlacements((prev) => [...prev, nextPlacement]);
    setPlacementMode(false);
  };

  useEffect(() => {
    const onMouseMove = (e: globalThis.MouseEvent) => {
      const rect = getPlacementRect();
      if (!rect) return;

      if (e.buttons !== 1) {
        if (dragging) setDragging(null);
        if (resizing) setResizing(null);
        return;
      }

      if (resizing) {
        const deltaX = e.clientX - resizing.startX;
        const factor = Math.max(0.2, 1 + deltaX / 240);
        const nextWidth = Math.max(1, Math.min(100, resizing.startWidth * factor));

        if (resizing.type === "signature") {
          updateSignaturePlacement(resizing.index, {
            widthPct: nextWidth,
          });
        } else {
          updateStampPlacement(resizing.index, {
            widthPct: nextWidth,
          });
        }
        return;
      }

      if (!dragging) return;

      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      if (dragging.type === "signature") {
        updateSignaturePlacement(dragging.index, { x, y });
      } else {
        updateStampPlacement(dragging.index, { x, y });
      }
    };

    const onMouseUp = () => {
      if (dragging) {
        setDragging(null);
      }
      if (resizing) {
        setResizing(null);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, resizing, selectedRequest]);

  const onConfirmPlacement = async () => {
    if (!selectedRequest) return;

    if (signaturePlacements.length === 0 || stampPlacements.length === 0) {
      toast.error("Add at least one signature and one stamp placement");
      return;
    }

    setVerifying(true);
    await verify(selectedRequest.id, signaturePlacements, stampPlacements);
    setVerifying(false);
  };

  const renderPlacementMarkers = () => (
    <div className="pointer-events-none absolute inset-0 z-20">
      {signaturePlacements.map((p, idx) =>
        p.page !== placementPage ? null : (
          <div
            key={`sig-${idx}`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging({ type: "signature", index: idx });
            }}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-move"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.widthPct}%`,
              aspectRatio: `${signatureAspect}`,
            }}
          >
            <img
              src={notaryAssets.signatureUrl || ""}
              alt="Signature"
              className="pointer-events-none h-full w-full rounded object-cover"
            />
            <div className="pointer-events-none absolute inset-0 rounded border-2 border-emerald-400/70" />
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragging({ type: "signature", index: idx });
              }}
              className="pointer-events-auto absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-emerald-500"
              aria-label="Drag signature marker"
              title="Drag to move"
            />
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setResizing({
                  type: "signature",
                  index: idx,
                  startX: e.clientX,
                  startWidth: p.widthPct,
                });
              }}
              className="pointer-events-auto absolute -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize rounded border-2 border-white bg-emerald-600"
              aria-label="Resize signature marker"
              title="Drag to resize"
            />
          </div>
        ),
      )}

      {stampPlacements.map((p, idx) =>
        p.page !== placementPage ? null : (
          <div
            key={`stamp-${idx}`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging({ type: "stamp", index: idx });
            }}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-move"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.widthPct}%`,
              aspectRatio: `${stampAspect}`,
            }}
          >
            <img
              src={notaryAssets.stampUrl || ""}
              alt="Stamp"
              className="pointer-events-none h-full w-full rounded object-cover"
            />
            <div className="pointer-events-none absolute inset-0 rounded border-2 border-amber-400/70" />
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragging({ type: "stamp", index: idx });
              }}
              className="pointer-events-auto absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-amber-500"
              aria-label="Drag stamp marker"
              title="Drag to move"
            />
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setResizing({
                  type: "stamp",
                  index: idx,
                  startX: e.clientX,
                  startWidth: p.widthPct,
                });
              }}
              className="pointer-events-auto absolute -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize rounded border-2 border-white bg-amber-600"
              aria-label="Resize stamp marker"
              title="Drag to resize"
            />
          </div>
        ),
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl text-emerald-400">Notary Dashboard</h1>
        <button
          onClick={logout}
          className="rounded bg-red-600 px-4 py-2 hover:bg-red-500"
        >
          Logout
        </button>
      </div>

      <div className="mb-8 rounded-xl border border-slate-700 bg-slate-800 p-6">
        <h2 className="mb-4 text-xl text-emerald-400">
          Upload Digital Signature and Stamp
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-slate-700 bg-slate-900 p-3">
            <p className="mb-2 text-sm text-slate-300">Current Signature</p>
            {notaryAssets.signatureUrl ? (
              <img
                src={notaryAssets.signatureUrl}
                alt="Current signature"
                className="mb-2 h-24 w-full rounded border border-slate-700 object-contain"
              />
            ) : (
              <p className="mb-2 text-sm text-slate-400">Not uploaded yet</p>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSignature(e.target.files?.[0] || null)}
              className="block w-full text-white"
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={removeSignatureBg}
                onChange={(e) => setRemoveSignatureBg(e.target.checked)}
              />
              Remove white background before upload
            </label>
            {signature && (
              <p className="mt-1 text-xs text-emerald-300">
                Selected: {signature.name}
              </p>
            )}
          </div>

          <div className="rounded border border-slate-700 bg-slate-900 p-3">
            <p className="mb-2 text-sm text-slate-300">Current Stamp</p>
            {notaryAssets.stampUrl ? (
              <img
                src={notaryAssets.stampUrl}
                alt="Current stamp"
                className="mb-2 h-24 w-full rounded border border-slate-700 object-contain"
              />
            ) : (
              <p className="mb-2 text-sm text-slate-400">Not uploaded yet</p>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setStamp(e.target.files?.[0] || null)}
              className="block w-full text-white"
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={removeStampBg}
                onChange={(e) => setRemoveStampBg(e.target.checked)}
              />
              Remove white background before upload
            </label>
            {stamp && (
              <p className="mt-1 text-xs text-emerald-300">
                Selected: {stamp.name}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={uploadAssets}
          className="mt-4 rounded bg-emerald-600 px-4 py-2 text-white"
        >
          Save Signature/Stamp Changes
        </button>
      </div>

      {requests.length === 0 && (
        <div className="rounded bg-slate-800 p-6 text-slate-300">
          No assigned requests right now.
        </div>
      )}

      {requests.map((r) => (
        <div key={r.id} className="mb-4 rounded bg-slate-800 p-6">
          <p>
            <b>Name:</b> {r.name}
          </p>
          <p>
            <b>Email:</b> {r.email}
          </p>
          <p>
            <b>Type:</b> {r.document_type}
          </p>

          <div className="mt-3 space-x-3">
            <button
              onClick={() => viewFile(r.aadhaar_url)}
              className="rounded bg-blue-600 px-3 py-1"
            >
              Aadhaar
            </button>

            <button
              onClick={() => viewFile(r.photo_url)}
              className="rounded bg-blue-600 px-3 py-1"
            >
              Photo
            </button>

            <button
              onClick={() => viewFile(r.document_url)}
              className="rounded bg-blue-600 px-3 py-1"
            >
              Document
            </button>
          </div>

          {r.status === "approved" && (
            <>
              <div className="mt-4 space-x-3">
                <button
                  onClick={() => openPlacement(r)}
                  className="rounded bg-green-600 px-4 py-2"
                >
                  Verify and Sign
                </button>

                <button
                  onClick={() => reject(r.id)}
                  className="rounded bg-red-600 px-4 py-2"
                >
                  Reject
                </button>
              </div>

              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Rejection message"
                className="mt-3 w-full rounded border bg-slate-900 px-3 py-2"
              />
            </>
          )}

          {r.status === "verified" && (
            <p className="mt-4 rounded bg-emerald-900/30 px-3 py-2 text-emerald-300">
              Approved and signed. Document sent to admin and client.
            </p>
          )}

          {r.status === "notary_rejected" && (
            <p className="mt-4 rounded bg-red-900/30 px-3 py-2 text-red-300">
              Rejected and sent back to admin/client.
            </p>
          )}
        </div>
      ))}

      {placementOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[95vh] w-full max-w-6xl overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl text-emerald-400">
                Place Signature and Stamp
              </h3>
              <button
                onClick={() => setPlacementOpen(false)}
                className="rounded bg-slate-700 px-3 py-2"
              >
                Close
              </button>
            </div>

            <div className="mb-4 flex gap-3">
              <button
                onClick={() => {
                  setActiveTool("signature");
                  setPlacementMode(true);
                }}
                className={`rounded px-3 py-2 ${
                  activeTool === "signature" ? "bg-emerald-600" : "bg-slate-700"
                }`}
              >
                {activeTool === "signature" && placementMode
                  ? "Click on document for Signature"
                  : "Place Signature"}
              </button>
              <button
                onClick={() => {
                  setActiveTool("stamp");
                  setPlacementMode(true);
                }}
                className={`rounded px-3 py-2 ${
                  activeTool === "stamp" ? "bg-emerald-600" : "bg-slate-700"
                }`}
              >
                {activeTool === "stamp" && placementMode
                  ? "Click on document for Stamp"
                  : "Place Stamp"}
              </button>
              <input
                type="number"
                min={1}
                max={isPdfDocument(selectedRequest.document_url) ? numPages : 1}
                value={placementPage}
                onChange={(e) =>
                  setPlacementPage(
                    Math.max(
                      1,
                      Math.min(
                        isPdfDocument(selectedRequest.document_url) ? numPages : 1,
                        Number(e.target.value) || 1,
                      ),
                    ),
                  )
                }
                className="w-32 rounded bg-slate-800 px-3 py-2 text-white"
                placeholder="Page"
              />
            </div>

            <div
              ref={previewRef}
              className="relative mx-auto h-[70vh] w-full overflow-auto rounded border border-slate-700 bg-slate-950 p-2"
            >
              {isImageDocument(selectedRequest.document_url) ? (
                <div className="relative mx-auto h-full w-full">
                  <img
                    src={documentSignedUrl}
                    alt="Document Preview"
                    className="h-full w-full object-contain"
                  />
                  {placementMode && (
                    <button
                      type="button"
                      className="absolute inset-0 z-10 cursor-crosshair bg-transparent"
                      onClick={onPreviewClick}
                      aria-label="Click to place selected asset"
                    />
                  )}
                  {renderPlacementMarkers()}
                </div>
              ) : (
                <div ref={pdfPageRef}>
                  <PdfPagePreview
                    file={documentSignedUrl}
                    onLoadSuccess={(total) => {
                      setNumPages(total || 1);
                      setPlacementPage((prev) => Math.min(Math.max(prev, 1), total || 1));
                    }}
                    pageNumber={placementPage}
                    width={pdfWidth}
                  >
                    {placementMode && (
                      <button
                        type="button"
                        className="absolute inset-0 z-10 cursor-crosshair bg-transparent"
                        onClick={onPreviewClick}
                        aria-label="Click to place selected asset"
                      />
                    )}
                    {renderPlacementMarkers()}
                  </PdfPagePreview>
                </div>
              )}
            </div>

            <p className="mt-3 text-sm text-slate-300">
              Scroll and inspect the document normally. Click Place Signature or
              Place Stamp, then click once to add a point.
              Set page number before placing if document has multiple pages.
              Drag center dot to move, drag bottom-right square to resize width.
              Repeat for more placements.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded bg-slate-800 p-3">
                <div className="mb-2 font-semibold text-emerald-300">
                  Signature placements: {signaturePlacements.length}
                </div>
                {signaturePlacements.map((p, i) => (
                  <div
                    key={`sig-list-${i}`}
                    className="mb-2 rounded bg-slate-900 px-2 py-2 text-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span>
                        #{i + 1} ({p.x.toFixed(1)}%, {p.y.toFixed(1)}%)
                      </span>
                      <button
                        onClick={() => removeSignaturePlacement(i)}
                        className="rounded bg-red-700 px-2 py-0.5"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={1}
                        value={p.page}
                        onChange={(e) =>
                          updateSignaturePlacement(i, {
                            page: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="rounded bg-slate-800 px-2 py-1"
                        placeholder="Page"
                      />
                      <div />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={Number(p.x.toFixed(1))}
                        onChange={(e) =>
                          updateSignaturePlacement(i, {
                            x: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          })
                        }
                        className="rounded bg-slate-800 px-2 py-1"
                        placeholder="X %"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={Number(p.y.toFixed(1))}
                        onChange={(e) =>
                          updateSignaturePlacement(i, {
                            y: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          })
                        }
                        className="rounded bg-slate-800 px-2 py-1"
                        placeholder="Y %"
                      />
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={Math.round(p.widthPct)}
                        onChange={(e) =>
                          updateSignaturePlacement(i, {
                            widthPct: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="rounded bg-slate-800 px-2 py-1"
                        placeholder="Width %"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded bg-slate-800 p-3">
                <div className="mb-2 font-semibold text-emerald-300">
                  Stamp placements: {stampPlacements.length}
                </div>
                {stampPlacements.map((p, i) => (
                  <div
                    key={`stamp-list-${i}`}
                    className="mb-2 rounded bg-slate-900 px-2 py-2 text-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span>
                        #{i + 1} ({p.x.toFixed(1)}%, {p.y.toFixed(1)}%)
                      </span>
                      <button
                        onClick={() => removeStampPlacement(i)}
                        className="rounded bg-red-700 px-2 py-0.5"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={1}
                        value={p.page}
                        onChange={(e) =>
                          updateStampPlacement(i, {
                            page: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="rounded bg-slate-800 px-2 py-1"
                        placeholder="Page"
                      />
                      <div />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={Number(p.x.toFixed(1))}
                        onChange={(e) =>
                          updateStampPlacement(i, {
                            x: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          })
                        }
                        className="rounded bg-slate-800 px-2 py-1"
                        placeholder="X %"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={Number(p.y.toFixed(1))}
                        onChange={(e) =>
                          updateStampPlacement(i, {
                            y: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          })
                        }
                        className="rounded bg-slate-800 px-2 py-1"
                        placeholder="Y %"
                      />
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={Math.round(p.widthPct)}
                        onChange={(e) =>
                          updateStampPlacement(i, {
                            widthPct: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="rounded bg-slate-800 px-2 py-1"
                        placeholder="Width %"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={onConfirmPlacement}
                disabled={verifying}
                className="rounded bg-emerald-600 px-4 py-2 disabled:opacity-50"
              >
                {verifying ? "Verifying..." : "Confirm Verify and Sign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
