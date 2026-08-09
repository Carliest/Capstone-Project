"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import mapboxgl from "mapbox-gl";
import { FormEvent, useEffect, useRef, useState } from "react";

type MapboxSearchResult = {
  status: string;
  mapbox?: {
    found: boolean;
    query: string;
    placeName: string | null;
    coordinates: [number, number] | null;
    text: string | null;
    id: string | null;
  };
  message?: string;
};

type InteractiveMapProps = {
  apiBaseUrl: string;
  accessToken?: string;
  initialCenter?: {
    lat: number;
    lon: number;
  };
  onCoordinatesChange?: (coords: { lat: number; lon: number }) => void;
};

export function InteractiveMap({
  apiBaseUrl,
  accessToken,
  initialCenter = { lat: -31.9505, lon: 115.8605 },
  onCoordinatesChange,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onCoordinatesChangeRef = useRef(onCoordinatesChange);
  const [query, setQuery] = useState("Perth");
  const [status, setStatus] = useState<string>("Ready");
  const [error, setError] = useState<string | null>(null);
  const [currentCenter, setCurrentCenter] = useState(initialCenter);

  useEffect(() => {
    onCoordinatesChangeRef.current = onCoordinatesChange;
  }, [onCoordinatesChange]);

  useEffect(() => {
    if (!accessToken) {
      setError("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is missing");
      return;
    }

    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [initialCenter.lon, initialCenter.lat],
      zoom: 9,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    const marker = new mapboxgl.Marker({ color: "#38bdf8" })
      .setLngLat([initialCenter.lon, initialCenter.lat])
      .addTo(map);

    map.on("click", (event) => {
      const { lng, lat } = event.lngLat;
      marker.setLngLat([lng, lat]);
      setCurrentCenter({ lat, lon: lng });
      setStatus(`Marker moved to ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      onCoordinatesChangeRef.current?.({ lat, lon: lng });
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [accessToken, initialCenter.lat, initialCenter.lon]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("Searching...");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/mapbox/health?q=${encodeURIComponent(query)}`
      );
      const data = (await response.json()) as MapboxSearchResult;

      if (!response.ok) {
        throw new Error(data.message ?? "Mapbox lookup failed");
      }

      const mapboxResult = data.mapbox;
      const coordinates = mapboxResult?.coordinates;
      if (!coordinates || !mapRef.current || !markerRef.current) {
        setStatus(
          mapboxResult?.placeName ?? mapboxResult?.query ?? "No result found"
        );
        return;
      }

      const [lon, lat] = coordinates;
      markerRef.current.setLngLat([lon, lat]);
      mapRef.current.flyTo({
        center: [lon, lat],
        zoom: 12,
        essential: true,
      });
      setCurrentCenter({ lat, lon });
      setStatus(mapboxResult?.placeName ?? mapboxResult?.query ?? "Mapbox");
      onCoordinatesChangeRef.current?.({ lat, lon });
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : "Unknown error"
      );
      setStatus("Search failed");
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/30">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Interactive Mapbox</h2>
          <p className="mt-1 text-sm text-slate-400">
            Search a place through the backend or click anywhere on the map.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
          <div className="font-medium text-white">Current coordinates</div>
          <div className="mt-1 font-mono text-sky-200">
            {currentCenter.lat.toFixed(4)}, {currentCenter.lon.toFixed(4)}
          </div>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a place like Perth or London"
        />
        <button
          type="submit"
          className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
        >
          Find on Map
        </button>
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-200">
          {status}
        </span>
        {error ? (
          <span className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-red-200">
            {error}
          </span>
        ) : null}
      </div>

      <div
        ref={mapContainerRef}
        className="h-[520px] w-full overflow-hidden rounded-3xl border border-white/10"
      />
    </section>
  );
}
