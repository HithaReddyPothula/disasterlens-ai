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

export type Shelter = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  currentOccupancy: number;
  hasFood: boolean;
  hasMedical: boolean;
  petFriendly: boolean;
};

export const SHELTERS: Shelter[] = [
  {
    id: 1,
    name: "Tampa Heights Community Center",
    lat: 27.965,
    lng: -82.458,
    capacity: 200,
    currentOccupancy: 85,
    hasFood: true,
    hasMedical: true,
    petFriendly: true,
  },
  {
    id: 2,
    name: "West Tampa High School",
    lat: 27.945,
    lng: -82.485,
    capacity: 350,
    currentOccupancy: 310,
    hasFood: true,
    hasMedical: false,
    petFriendly: false,
  },
  {
    id: 3,
    name: "Ybor City Recreation Hall",
    lat: 27.958,
    lng: -82.435,
    capacity: 150,
    currentOccupancy: 40,
    hasFood: true,
    hasMedical: true,
    petFriendly: true,
  },
];

// Calculates straight-line distance between two points (in miles)
export function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findNearestShelter(lat: number, lng: number) {
  let nearest = SHELTERS[0];
  let minDist = getDistance(lat, lng, nearest.lat, nearest.lng);

  for (const shelter of SHELTERS) {
    const dist = getDistance(lat, lng, shelter.lat, shelter.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = shelter;
    }
  }

  return { shelter: nearest, distance: minDist };
}

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
  const center: [number, number] = [27.9506, -82.4572];

  const shelterIcon = new L.Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

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

      {/* Hazard pins */}
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

      {/* Shelter pins */}
      {SHELTERS.map((shelter) => (
        <Marker
          key={`shelter-${shelter.id}`}
          position={[shelter.lat, shelter.lng]}
          icon={shelterIcon}
        >
          <Popup>
            <strong>{shelter.name}</strong>
            <br />
            Occupancy: {shelter.currentOccupancy}/{shelter.capacity}
            <br />
            {shelter.hasFood ? "✅ Food" : "❌ No food"}
            <br />
            {shelter.hasMedical ? "✅ Medical staff" : "❌ No medical staff"}
            <br />
            {shelter.petFriendly ? "✅ Pet-friendly" : "❌ Not pet-friendly"}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}