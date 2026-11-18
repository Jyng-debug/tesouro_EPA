export type GpsStatus = "ok" | "denied" | "unavailable";

export interface GpsReading {
  status: GpsStatus;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
}

/** Distância em metros entre dois pontos (fórmula de Haversine). Igual à do servidor. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/**
 * Lê a posição UMA vez (só no momento do envio — não há rastreamento contínuo).
 * Nunca rejeita: devolve status "denied" ou "unavailable" em caso de falha.
 */
export function readPositionOnce(timeoutMs = 12000): Promise<GpsReading> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ status: "unavailable", lat: null, lng: null, accuracy: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          status: "ok",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) =>
        resolve({
          status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
          lat: null,
          lng: null,
          accuracy: null,
        }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15000 },
    );
  });
}
