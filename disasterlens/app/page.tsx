"use client";

import { useState } from "react";

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!image) return;
    setLoading(true);
    setResult(null);

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: image }),
    });

    const data = await response.json();
    setResult(data.result || "Something went wrong.");
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-orange-400 mb-2">
        DisasterLens AI
      </h1>
      <p className="text-slate-300 mb-8 text-center max-w-md">
        Upload a photo from a hurricane-affected area. Our AI will identify
        the hazard and add it to the live map.
      </p>

      <div className="border-2 border-dashed border-slate-500 rounded-xl p-10 text-center w-full max-w-md">
        <p className="text-slate-400 mb-4">Choose a photo to analyze</p>

        {/* Custom styled upload button */}
        <label className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-medium px-5 py-2 rounded-lg cursor-pointer transition">
          Choose File
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>

        <p className="mt-3 text-sm text-slate-400">
          {fileName ? fileName : "No file chosen"}
        </p>

        {image && (
          <img
            src={image}
            alt="Uploaded preview"
            className="mt-6 rounded-lg max-h-64 mx-auto"
          />
        )}

        {image && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium px-6 py-2 rounded-lg transition"
          >
            {loading ? "Analyzing..." : "Submit for Analysis"}
          </button>
        )}

        {result && (
          <pre className="mt-6 text-left text-sm bg-slate-800 p-4 rounded-lg whitespace-pre-wrap">
            {result}
          </pre>
        )}
      </div>
    </main>
  );
}