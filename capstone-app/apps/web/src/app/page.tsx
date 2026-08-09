"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { InteractiveMap } from "../components/mapbox-interactive-map";

type MapboxResponse = {
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

type WeatherResponse = {
  status: string;
  weather?: {
    location: string | null;
    condition: string | null;
    description: string | null;
    temperature: number | null;
    feelsLike: number | null;
    humidity: number | null;
    windSpeed: number | null;
  };
  message?: string;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export default function Home() {
  const [mapQuery, setMapQuery] = useState("Perth");
  const [lat, setLat] = useState("-31.9505");
  const [lon, setLon] = useState("115.8605");
  const [mapboxResult, setMapboxResult] = useState<MapboxResponse | null>(null);
  const [weatherResult, setWeatherResult] = useState<WeatherResponse | null>(
    null
  );
  const [mapboxLoading, setMapboxLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [mapboxError, setMapboxError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const mapboxSummary = useMemo(() => {
    if (!mapboxResult?.mapbox) {
      return null;
    }

    return mapboxResult.mapbox.found
      ? mapboxResult.mapbox.placeName ?? mapboxResult.mapbox.query
      : `No results for "${mapboxResult.mapbox.query}"`;
  }, [mapboxResult]);

  const handleCoordinatesChange = useCallback(
    (coords: { lat: number; lon: number }) => {
      setLat(coords.lat.toFixed(4));
      setLon(coords.lon.toFixed(4));
    },
    []
  );

  async function handleMapboxSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMapboxLoading(true);
    setMapboxError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/mapbox/health?q=${encodeURIComponent(mapQuery)}`
      );
      const data = (await response.json()) as MapboxResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Mapbox request failed");
      }

      setMapboxResult(data);
      if (data.mapbox?.coordinates) {
        const [lng, latValue] = data.mapbox.coordinates;
        setLat(latValue.toFixed(4));
        setLon(lng.toFixed(4));
      }
    } catch (error) {
      setMapboxError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setMapboxLoading(false);
    }
  }

  async function handleWeatherSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWeatherLoading(true);
    setWeatherError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/weather/current?lat=${encodeURIComponent(
          lat
        )}&lon=${encodeURIComponent(lon)}`
      );
      const data = (await response.json()) as WeatherResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Weather request failed");
      }

      setWeatherResult(data);
    } catch (error) {
      setWeatherError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setWeatherLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.14),_transparent_30%),linear-gradient(180deg,_#0b1020_0%,_#111827_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 lg:px-10">
        <header className="mb-10 flex flex-col gap-4 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">
              Backend demo
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Real Mapbox map, connected to your backend
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
              Click around the map or search a place, and the backend will still
              power the Mapbox lookup and weather check.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 backdrop-blur">
            <div className="font-medium text-white">API base URL</div>
            <div className="mt-1 break-all font-mono text-xs text-sky-200">
              {apiBaseUrl}
            </div>
          </div>
        </header>

        <div className="space-y-6">
          <InteractiveMap
            apiBaseUrl={apiBaseUrl}
            accessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
            initialCenter={{ lat: -31.9505, lon: 115.8605 }}
            onCoordinatesChange={handleCoordinatesChange}
          />

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/30">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">
                    Mapbox test
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Search for a place through your backend.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  /api/mapbox/health
                </span>
              </div>

              <form onSubmit={handleMapboxSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">
                    Place name
                  </span>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
                    value={mapQuery}
                    onChange={(event) => setMapQuery(event.target.value)}
                    placeholder="Try Perth, London, New York..."
                  />
                </label>
                <button
                  type="submit"
                  disabled={mapboxLoading}
                  className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {mapboxLoading ? "Checking Mapbox..." : "Check Mapbox"}
                </button>
              </form>

              <div className="mt-6 space-y-4">
                {mapboxError ? (
                  <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {mapboxError}
                  </div>
                ) : null}

                {mapboxSummary ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-medium text-slate-300">
                      Result
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {mapboxSummary}
                    </div>
                    <pre className="mt-4 overflow-x-auto rounded-2xl bg-black/30 p-4 text-xs leading-6 text-slate-200">
                      {JSON.stringify(mapboxResult, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                    Run a place search to confirm the Mapbox API is connected.
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/30">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">
                    Weather test
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Call OpenWeather through your backend.
                  </p>
                </div>
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
                  /api/weather/current
                </span>
              </div>

              <form
                onSubmit={handleWeatherSubmit}
                className="grid gap-4 sm:grid-cols-2"
              >
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">
                    Latitude
                  </span>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
                    value={lat}
                    onChange={(event) => setLat(event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">
                    Longitude
                  </span>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
                    value={lon}
                    onChange={(event) => setLon(event.target.value)}
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={weatherLoading}
                    className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {weatherLoading ? "Checking weather..." : "Check weather"}
                  </button>
                </div>
              </form>

              <div className="mt-6 space-y-4">
                {weatherError ? (
                  <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {weatherError}
                  </div>
                ) : null}

                {weatherResult?.weather ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-sm text-slate-400">Location</div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        {weatherResult.weather.location ?? "Unknown"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-sm text-slate-400">Condition</div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        {weatherResult.weather.condition ?? "Unknown"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-sm text-slate-400">Temperature</div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        {weatherResult.weather.temperature ?? "N/A"} °C
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-sm text-slate-400">Humidity</div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        {weatherResult.weather.humidity ?? "N/A"} %
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                    Run a weather lookup to confirm OpenWeather is connected.
                  </div>
                )}

                {weatherResult ? (
                  <pre className="overflow-x-auto rounded-2xl bg-black/30 p-4 text-xs leading-6 text-slate-200">
                    {JSON.stringify(weatherResult, null, 2)}
                  </pre>
                ) : null}
              </div>
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}
