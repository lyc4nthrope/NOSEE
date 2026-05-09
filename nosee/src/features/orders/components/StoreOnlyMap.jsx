import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { parseStoreCoords } from '../utils/parseStoreCoords';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default Leaflet icon (Vite asset issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Inline SVG icon — sin dependencia de red externa (raw.githubusercontent.com se bloquea)
const userIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="42" viewBox="0 0 28 42">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 28 14 28S28 24.5 28 14C28 6.268 21.732 0 14 0z"
      fill="#22c55e" stroke="#fff" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="#fff"/>
  </svg>`,
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -42],
});

// Auto-fit bounds to all markers
function FitBoundsEffect({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions.map(({ lat, lng }) => [lat, lng]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  }, []); // run only on mount
  return null;
}

export function StoreOnlyMap({ stores = [], userCoords = null }) {
  const storePositions = stores
    .map((s) => ({ ...parseStoreCoords(s.store?.location), name: s.store?.name ?? 'Tienda' }))
    .filter((p) => p.lat && p.lng);

  const allPositions = [
    ...storePositions,
    ...(userCoords?.lat && userCoords?.lng ? [userCoords] : []),
  ];

  const defaultCenter = storePositions[0]
    ? [storePositions[0].lat, storePositions[0].lng]
    : [4.7110, -74.0721]; // Bogotá fallback

  return (
    <MapContainer
      center={defaultCenter}
      zoom={14}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {storePositions.map((p, i) => (
        <Marker key={i} position={[p.lat, p.lng]}>
          <Popup>{p.name}</Popup>
        </Marker>
      ))}
      {userCoords?.lat && userCoords?.lng && (
        <Marker position={[userCoords.lat, userCoords.lng]} icon={userIcon}>
          <Popup>Tu ubicación</Popup>
        </Marker>
      )}
      <FitBoundsEffect positions={allPositions} />
    </MapContainer>
  );
}
