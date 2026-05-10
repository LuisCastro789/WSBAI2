import { useState, useRef, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

const MAX_IMAGES = 5;

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [previousCode, setPreviousCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("desktop");
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("builder");
  const [uploadedImages, setUploadedImages] = useState([]);
  const [error, setError] = useState("");
  const iframeRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (generatedCode && iframeRef.current) {
      injectImagesIntoPreview(generatedCode);
    }
  }, [generatedCode, uploadedImages]);

  async function fetchHistory() {
    try {
      const q = query(collection(db, "sites"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setHistory(items);
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  }

  function injectImagesIntoPreview(code) {
    if (!iframeRef.current) return;
    let finalCode = code;
    uploadedImages.forEach((img, idx) => {
      const placeholder = `USER_IMAGE_PLACEHOLDER_${idx + 1}`;
      finalCode = finalCode.replaceAll(placeholder, img.dataUrl);
    });
    // Also replace generic placeholder
    if (uploadedImages.length > 0) {
      finalCode = finalCode.replaceAll(
        "USER_IMAGE_PLACEHOLDER",
        uploadedImages[0].dataUrl
      );
    }
    const blob = new Blob([finalCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframeRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }

  async function handleGenerate(isRefine = false) {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");

    let fullPrompt = prompt;
    if (isRefine && previousCode) {
      fullPrompt = `Here is the current website HTML:\n\n${previousCode}\n\nUser refinement request: ${prompt}`;
    }

    const imageContext =
      uploadedImages.length > 0
        ? `\n\nThe user has uploaded ${uploadedImages.length} image(s). Use the placeholders USER_IMAGE_PLACEHOLDER_1 through USER_IMAGE_PLACEHOLDER_${uploadedImages.length} as the src attributes for img tags where user images should appear. These will be replaced with real images at render time.`
        : "";

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt + imageContext }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      const code = data.code;

      setPreviousCode(code);
      setGeneratedCode(code);

      // Save to Firestore (store prompt + code only, no images)
      try {
        await addDoc(collection(db, "sites"), {
          prompt: prompt,
          code: code,
          createdAt: serverTimestamp(),
        });
        fetchHistory();
      } catch (fsErr) {
        console.warn("Firestore save failed:", fsErr);
      }
    } catch (e) {
      setError(e.message || "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    if (uploadedImages.length + files.length > MAX_IMAGES) {
      setError(`You can upload a maximum of ${MAX_IMAGES} images.`);
      return;
    }
    setError("");
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedImages((prev) => [
          ...prev,
          { name: file.name, dataUrl: ev.target.result },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removeImage(idx) {
    setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function loadFromHistory(item) {
    setGeneratedCode(item.code);
    setPreviousCode(item.code);
    setPrompt(item.prompt);
    setActiveTab("builder");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between bg-gray-900">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            AI
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            AI Website Builder
          </h1>
        </div>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("builder")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === "builder"
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Builder
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === "history"
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            History
            {history.length > 0 && (
              <span className="ml-1.5 bg-violet-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {activeTab === "builder" ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel */}
          <div className="w-80 flex-shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col overflow-y-auto">
            <div className="p-5 flex flex-col gap-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  Describe Your Website
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  placeholder="e.g. A luxury fashion brand landing page with dark aesthetic, large hero image, product gallery, and newsletter signup..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none transition"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  Upload Images ({uploadedImages.length}/{MAX_IMAGES})
                </label>
                {uploadedImages.length < MAX_IMAGES && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-700 rounded-lg p-3 text-sm text-gray-400 hover:border-violet-500 hover:text-violet-400 transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Add Image
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {uploadedImages.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {uploadedImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-gray-800 rounded-lg px-2.5 py-1.5"
                      >
                        <img
                          src={img.dataUrl}
                          alt=""
                          className="w-8 h-8 rounded object-cover flex-shrink-0"
                        />
                        <span className="text-xs text-gray-300 truncate flex-1">
                          {img.name}
                        </span>
                        <span className="text-xs text-violet-400 flex-shrink-0">
                          #{idx + 1}
                        </span>
                        <button
                          onClick={() => removeImage(idx)}
                          className="text-gray-500 hover:text-red-400 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500 mt-1">
                      Reference as USER_IMAGE_PLACEHOLDER_1, _2, etc. in your prompt.
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2 mt-auto">
                <button
                  onClick={() => handleGenerate(false)}
                  disabled={loading || !prompt.trim()}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    "✨ Generate Website"
                  )}
                </button>
                {previousCode && (
                  <button
                    onClick={() => handleGenerate(true)}
                    disabled={loading || !prompt.trim()}
                    className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition text-sm"
                  >
                    🔄 Refine Design
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-1 flex flex-col bg-gray-950">
            {/* Toolbar */}
            <div className="border-b border-gray-800 px-4 py-2 flex items-center justify-between bg-gray-900">
              <span className="text-xs text-gray-500 font-medium">Preview</span>
              <div className="flex gap-1 bg-gray-800 rounded-md p-0.5">
                <button
                  onClick={() => setViewMode("desktop")}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    viewMode === "desktop"
                      ? "bg-gray-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  🖥 Desktop
                </button>
                <button
                  onClick={() => setViewMode("mobile")}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    viewMode === "mobile"
                      ? "bg-gray-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  📱 Mobile
                </button>
              </div>
              {generatedCode && (
                <button
                  onClick={() => {
                    const blob = new Blob([generatedCode], { type: "text/html" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "website.html";
                    a.click();
                  }}
                  className="text-xs text-violet-400 hover:text-violet-300 transition"
                >
                  ⬇ Download HTML
                </button>
              )}
            </div>

            {/* Preview Frame */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
              {generatedCode ? (
                <div
                  className={`transition-all duration-300 bg-white rounded shadow-2xl overflow-hidden ${
                    viewMode === "mobile"
                      ? "w-96 h-[812px]"
                      : "w-full h-full"
                  }`}
                >
                  <iframe
                    ref={iframeRef}
                    title="preview"
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              ) : (
                <div className="text-center text-gray-600 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center text-3xl">
                    🌐
                  </div>
                  <p className="text-sm">
                    Describe your website and click <strong className="text-gray-400">Generate</strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-lg font-semibold mb-4">Generation History</h2>
          {history.length === 0 ? (
            <p className="text-gray-500 text-sm">No history yet. Generate your first website!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-violet-600 transition cursor-pointer group"
                  onClick={() => loadFromHistory(item)}
                >
                  <div className="aspect-video bg-gray-800 rounded-lg mb-3 overflow-hidden">
                    <iframe
                      srcDoc={item.code}
                      title="preview"
                      className="w-full h-full border-0 pointer-events-none scale-75 origin-top-left"
                      style={{ width: "133%", height: "133%" }}
                      sandbox=""
                    />
                  </div>
                  <p className="text-sm text-gray-300 line-clamp-2">{item.prompt}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {item.createdAt?.toDate?.()?.toLocaleDateString?.() || "Recent"}
                  </p>
                  <span className="text-xs text-violet-400 opacity-0 group-hover:opacity-100 transition mt-2 block">
                    Click to load →
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
