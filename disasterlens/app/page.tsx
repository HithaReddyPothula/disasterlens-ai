"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Hazard } from "./DisasterMap";
import { findNearestShelter } from "./DisasterMap";

// Load the map only in the browser (not on the server)
const DisasterMap = dynamic(() => import("./DisasterMap"), { ssr: false });

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [nearestShelterInfo, setNearestShelterInfo] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

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

  // Turns the AI's text answer into a hazard object we can show on the map
  function parseHazard(text: string) {
    const typeMatch = text.match(/hazard_type:\s*([a-z_]+)/i);
    const severityMatch = text.match(/severity:\s*([a-z]+)/i);
    const descMatch = text.match(/description:\s*(.+)/i);

    return {
      type: typeMatch ? typeMatch[1].toLowerCase() : "none",
      severity: severityMatch ? severityMatch[1].toLowerCase() : "unknown",
      description: descMatch ? descMatch[1].trim() : "No description available.",
    };
  }

  async function handleSubmit() {
    if (!image) return;
    setLoading(true);
    setResult(null);

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: image, notes }),
    });

    const data = await response.json();
    const text = data.result || "";
    setResult(text);

    const parsed = parseHazard(text);

    // Random nearby location around Tampa, for demo purposes
    const newHazard: Hazard = {
      id: Date.now(),
      lat: 27.9506 + (Math.random() - 0.5) * 0.08,
      lng: -82.4572 + (Math.random() - 0.5) * 0.08,
      type: parsed.type,
      severity: parsed.severity,
      description: parsed.description,
    };

    setHazards((prev) => [...prev, newHazard]);
    // Find nearest shelter to this new hazard
    const { shelter, distance } = findNearestShelter(newHazard.lat, newHazard.lng);
    setNearestShelterInfo(
      `Nearest shelter: ${shelter.name} (${distance.toFixed(
        1
      )} miles away) — ${shelter.currentOccupancy}/${shelter.capacity} occupied`
    );
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-4xl font-bold text-orange-400 mb-2 text-center">
        DisasterLens AI
      </h1>
      <p className="text-slate-300 mb-8 text-center max-w-md mx-auto">
        Upload a photo from a hurricane-affected area. Our AI will identify
        the hazard and add it to the live map.
      </p>

      <div className="flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto">
        {/* Upload panel */}
        <div className="border-2 border-dashed border-slate-500 rounded-xl p-10 text-center w-full lg:w-1/3">
          <p className="text-slate-400 mb-4">Choose a photo to analyze</p>

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
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add details: exact location, what's happening, who needs help..."
              className="mt-4 w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm text-white placeholder-slate-500 resize-none"
              rows={3}
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
          {nearestShelterInfo && (
            <div className="mt-4 text-left text-sm bg-purple-900/40 border border-purple-500 p-4 rounded-lg">
              🏠 {nearestShelterInfo}
            </div>
          )}
        </div>

        {/* Map panel */}
        <div className="w-full lg:w-2/3">
          <DisasterMap hazards={hazards} />
        </div>
      </div>
    </main>
  );
}