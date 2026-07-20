"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Hazard, Volunteer } from "./DisasterMap";
import {
  findNearestShelter,
  findMatchingVolunteers,
  checkVerification,
  checkRouteForBlockedRoads,
  TAMPA_NEIGHBORHOODS,
  SHELTERS,
} from "./DisasterMap";

// Load the map only in the browser (not on the server)
const DisasterMap = dynamic(() => import("./DisasterMap"), { ssr: false });

const SKILL_OPTIONS = [
  { value: "medical", label: "Medical" },
  { value: "boat_rescue", label: "Boat Rescue" },
  { value: "firefighting", label: "Firefighting" },
  { value: "chainsaw", label: "Chainsaw / Debris Removal" },
  { value: "electrician", label: "Electrician" },
  { value: "construction", label: "Construction" },
  { value: "search_and_rescue", label: "Search & Rescue" },
  { value: "heavy_equipment", label: "Heavy Equipment Operator" },
  { value: "traffic_support", label: "Traffic Support" },
  { value: "supplies", label: "Supply Delivery" },
  { value: "evacuation_support", label: "Evacuation Support" },
];

const NEIGHBORHOOD_OPTIONS = Object.keys(TAMPA_NEIGHBORHOODS);

type RouteResult = {
  start: [number, number];
  end: [number, number];
  blocked: boolean;
  blockageCount: number;
};

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [nearestShelterInfo, setNearestShelterInfo] = useState<string | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [showIntro, setShowIntro] = useState(true);
  const [verificationInfo, setVerificationInfo] = useState<{
    verified: boolean;
    reportCount: number;
  } | null>(null);

  // Voice recording state
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // Directions state
  const [myLocation, setMyLocation] = useState(NEIGHBORHOOD_OPTIONS[0]);
  const [destinationShelterId, setDestinationShelterId] = useState(SHELTERS[0].id);
  const [route, setRoute] = useState<RouteResult | null>(null);

  // Volunteer state
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [volunteerName, setVolunteerName] = useState("");
  const [volunteerSkill, setVolunteerSkill] = useState("medical");
  const [volunteerContact, setVolunteerContact] = useState("");
  const [volunteerNeighborhood, setVolunteerNeighborhood] = useState(
    NEIGHBORHOOD_OPTIONS[0]
  );
  const [matchedVolunteers, setMatchedVolunteers] = useState<Volunteer[]>([]);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      setAudioBlob(blob);
      await transcribeAudio(blob);
    };

    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorder?.stop();
    setIsRecording(false);
  }

  async function transcribeAudio(blob: Blob) {
    setTranscribing(true);
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (data.text) {
      setNotes((prev) => (prev ? prev + " " + data.text : data.text));
    }
    setTranscribing(false);
  }

  function handleGetDirections() {
    const start = TAMPA_NEIGHBORHOODS[myLocation];
    const destination = SHELTERS.find((s) => s.id === destinationShelterId);
    if (!start || !destination) return;

    const { hasBlockages, blockages } = checkRouteForBlockedRoads(
      start.lat,
      start.lng,
      destination.lat,
      destination.lng,
      hazards
    );

    setRoute({
      start: [start.lat, start.lng],
      end: [destination.lat, destination.lng],
      blocked: hasBlockages,
      blockageCount: blockages.length,
    });
  }

  function handleVolunteerSignup() {
    if (!volunteerName.trim() || !volunteerContact.trim()) return;

    const coords = TAMPA_NEIGHBORHOODS[volunteerNeighborhood];

    const newVolunteer: Volunteer = {
      id: Date.now(),
      name: volunteerName,
      skill: volunteerSkill,
      contact: volunteerContact,
      neighborhood: volunteerNeighborhood,
      lat: coords.lat,
      lng: coords.lng,
    };

    setVolunteers((prev) => [...prev, newVolunteer]);
    setVolunteerName("");
    setVolunteerContact("");
  }

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
    const costMatch = text.match(/estimated_cost:\s*(.+)/i);

    return {
      type: typeMatch ? typeMatch[1].toLowerCase() : "none",
      severity: severityMatch ? severityMatch[1].toLowerCase() : "unknown",
      description: descMatch ? descMatch[1].trim() : "No description available.",
      estimatedCost: costMatch ? costMatch[1].trim() : "Unable to estimate",
    };
  }

  async function handleSubmit() {
    if (!image) return;
    setLoading(true);
    setResult(null);
    setMatchedVolunteers([]);
    setVerificationInfo(null);
    setEstimatedCost(null);

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: image, notes }),
    });

    const data = await response.json();
    const text = data.result || "";
    setResult(text);

    const parsed = parseHazard(text);
    setEstimatedCost(parsed.estimatedCost);

    // Random nearby location around Tampa, for demo purposes
    const newLat = 27.9506 + (Math.random() - 0.5) * 0.08;
    const newLng = -82.4572 + (Math.random() - 0.5) * 0.08;

    // Check verification against existing hazards BEFORE adding this new one
    const { verified, reportCount } = checkVerification(
      newLat,
      newLng,
      parsed.type,
      hazards
    );
    setVerificationInfo({ verified, reportCount });

    const newHazard: Hazard = {
      id: Date.now(),
      lat: newLat,
      lng: newLng,
      type: parsed.type,
      severity: parsed.severity,
      description: parsed.description,
      verified,
      reportCount,
    };

    setHazards((prev) => [...prev, newHazard]);

    // Find nearest shelter to this new hazard
    const { shelter, distance } = findNearestShelter(newLat, newLng);
    setNearestShelterInfo(
      `Nearest shelter: ${shelter.name} (${distance.toFixed(
        1
      )} miles away) — ${shelter.currentOccupancy}/${shelter.capacity} occupied`
    );

    // Find matching volunteers for this hazard type
    const matches = findMatchingVolunteers(parsed.type, volunteers);
    setMatchedVolunteers(matches);

    setLoading(false);
  }

  if (showIntro) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-5xl font-bold text-orange-400 mb-4">
          DisasterLens AI
        </h1>
        <p className="text-slate-300 max-w-xl mb-2 text-lg">
          When disaster strikes, every second matters.
        </p>
        <p className="text-slate-400 max-w-xl mb-10">
          DisasterLens turns community-submitted photos into real-time
          emergency intelligence — helping first responders identify hazards,
          locate shelters, and save lives faster.
        </p>

        <button
          onClick={() => setShowIntro(false)}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-lg text-lg transition"
        >
          Get Started →
        </button>

        <p className="mt-10 text-xs text-slate-500 max-w-md">
          "Building with AI: Empowering Communities, Transforming Futures"
        </p>
      </main>
    );
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
        {/* Left column: Upload panel + Directions + Volunteer signup */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          {/* Upload panel */}
          <div className="border-2 border-dashed border-slate-500 rounded-xl p-10 text-center">
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
              <>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add details: exact location, what's happening, who needs help..."
                  className="mt-4 w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm text-white placeholder-slate-500 resize-none"
                  rows={3}
                />

                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={transcribing}
                  className={`mt-2 w-full px-4 py-2 rounded-lg text-sm font-medium transition ${
                    isRecording
                      ? "bg-red-600 hover:bg-red-700 animate-pulse"
                      : "bg-slate-700 hover:bg-slate-600"
                  }`}
                >
                  {transcribing
                    ? "Transcribing..."
                    : isRecording
                    ? "⏹ Stop Recording"
                    : "🎤 Record Voice Note"}
                </button>
              </>
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

            {verificationInfo && (
              <div
                className={`mt-4 text-left text-sm p-4 rounded-lg border ${
                  verificationInfo.verified
                    ? "bg-green-900/40 border-green-500"
                    : "bg-yellow-900/40 border-yellow-500"
                }`}
              >
                {verificationInfo.verified
                  ? `✅ Verified — confirmed by ${verificationInfo.reportCount} independent reports in this area`
                  : "⚠️ Unverified — only 1 report so far. Will auto-upgrade if others report nearby."}
              </div>
            )}

            {nearestShelterInfo && (
              <div className="mt-4 text-left text-sm bg-purple-900/40 border border-purple-500 p-4 rounded-lg">
                🏠 {nearestShelterInfo}
              </div>
            )}

            {estimatedCost && (
              <div className="mt-4 text-left text-sm bg-slate-800 border border-slate-500 p-4 rounded-lg">
                <p className="text-orange-300 font-semibold mb-1">
                  💰 Estimated Damage Cost:
                </p>
                <p className="text-slate-300">{estimatedCost}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Rough AI visual estimate — not a professional appraisal
                </p>
              </div>
            )}

            {matchedVolunteers.length > 0 && (
              <div className="mt-4 text-left text-sm bg-slate-800 border border-slate-500 p-4 rounded-lg">
                <p className="font-semibold text-orange-300 mb-2">
                  🤝 Matched Volunteers:
                </p>
                {matchedVolunteers.map((v) => (
                  <div key={v.id} className="text-slate-300 mb-2">
                    <p className="font-medium text-white">{v.name}</p>
                    <p className="text-xs text-slate-400">
                      {v.skill.replace("_", " ")} · {v.neighborhood}
                    </p>
                    <p className="text-xs text-green-400">📞 {v.contact}</p>
                  </div>
                ))}
              </div>
            )}

            {result && matchedVolunteers.length === 0 && (
              <div className="mt-4 text-left text-sm bg-slate-800 border border-slate-600 p-4 rounded-lg text-slate-400">
                🤝 No matching volunteers signed up yet for this hazard type.
              </div>
            )}
          </div>

          {/* Get Directions panel */}
          <div className="bg-slate-800 rounded-xl p-6">
            <p className="font-semibold text-orange-300 mb-3">
              🧭 Get Directions to a Shelter
            </p>

            <label className="text-xs text-slate-400 mb-1 block">
              Your location
            </label>
            <select
              value={myLocation}
              onChange={(e) => setMyLocation(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-white mb-3"
            >
              {NEIGHBORHOOD_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <label className="text-xs text-slate-400 mb-1 block">
              Destination shelter
            </label>
            <select
              value={destinationShelterId}
              onChange={(e) => setDestinationShelterId(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-white mb-3"
            >
              {SHELTERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleGetDirections}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg transition"
            >
              Get Directions
            </button>

            {route && (
              <div
                className={`mt-4 text-sm p-3 rounded-lg border ${
                  route.blocked
                    ? "bg-red-900/40 border-red-500"
                    : "bg-green-900/40 border-green-500"
                }`}
              >
                {route.blocked
                  ? `⚠️ Warning: ${route.blockageCount} blocked road${
                      route.blockageCount > 1 ? "s" : ""
                    } reported near this route. Consider an alternative shelter.`
                  : "✅ Route looks clear — no reported blockages nearby."}
              </div>
            )}
          </div>

          {/* Volunteer sign-up panel */}
          <div className="bg-slate-800 rounded-xl p-6">
            <p className="font-semibold text-orange-300 mb-3">
              Want to help? Sign up as a volunteer:
            </p>

            <input
              type="text"
              value={volunteerName}
              onChange={(e) => setVolunteerName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-white placeholder-slate-500 mb-3"
            />

            <input
              type="text"
              value={volunteerContact}
              onChange={(e) => setVolunteerContact(e.target.value)}
              placeholder="Phone or email"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-white placeholder-slate-500 mb-3"
            />

            <select
              value={volunteerNeighborhood}
              onChange={(e) => setVolunteerNeighborhood(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-white mb-3"
            >
              {NEIGHBORHOOD_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <select
              value={volunteerSkill}
              onChange={(e) => setVolunteerSkill(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-white mb-3"
            >
              {SKILL_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <button
              onClick={handleVolunteerSignup}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg transition"
            >
              Sign Up
            </button>

            {volunteers.length > 0 && (
              <p className="mt-3 text-xs text-slate-400">
                {volunteers.length} volunteer{volunteers.length > 1 ? "s" : ""} registered
              </p>
            )}
          </div>
        </div>

        {/* Map panel */}
        <div className="w-full lg:w-2/3">
          <DisasterMap hazards={hazards} volunteers={volunteers} route={route} />

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm bg-slate-800 p-4 rounded-lg">
            <LegendItem color="#3388ff" label="Flood" />
            <LegendItem color="#ff3333" label="Fire" />
            <LegendItem color="#33cc33" label="Downed Tree" />
            <LegendItem color="#ff9900" label="Damaged Building" />
            <LegendItem color="#ffcc00" label="Blocked Road" />
            <LegendItem color="#9b59b6" label="Shelter" />
            <LegendItem color="#333333" label="Volunteer" />
          </div>
        </div>
      </div>
    </main>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-3 h-3 rounded-full inline-block"
        style={{ backgroundColor: color }}
      ></span>
      <span className="text-slate-300">{label}</span>
    </div>
  );
}