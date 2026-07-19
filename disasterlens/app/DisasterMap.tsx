"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icons not showing in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type Hazard = {
  id: number;
  lat: number;
  lng: number;
  type: string;
  severity: string;
  description: string;
};

// Colors for each hazard type
function getColorIcon(type: string) {
  const colors: Record<string, string> = {
    flood: "blue",
    fire: "red",
    downed_tree: "green",
    damaged_building: "orange",
    blocked_road: "yellow",
    none: "grey",
  };
  const color = colors[type] || "grey";

  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
}

export default function DisasterMap({ hazards }: { hazards: Hazard[] }) {
  // Centered on Tampa, Florida
  const center: [number, number] = [27.9506, -82.4572];

  return (
    <MapContainer
      center={center}
      zoom={11}
      style={{ height: "500px", width: "100%", borderRadius: "12px" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />

      {hazards.map((hazard) => (
        <Marker
          key={hazard.id}
          position={[hazard.lat, hazard.lng]}
          icon={getColorIcon(hazard.type)}
        >
          <Popup>
            <strong>{hazard.type.replace("_", " ").toUpperCase()}</strong>
            <br />
            Severity: {hazard.severity}
            <br />
            {hazard.description}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}