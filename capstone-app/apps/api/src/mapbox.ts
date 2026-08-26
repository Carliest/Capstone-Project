type MapboxGeocodingResponse = {
  features?: Array<{
    place_name?: string;
    center?: [number, number];
    text?: string;
    id?: string;
  }>;
};

export async function searchPlace(query: string) {
  const accessToken = process.env.MAPBOX_ACCESS_TOKEN;

  if (!accessToken) {
    return null;
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  );
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("limit", "1");

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as MapboxGeocodingResponse;
    const feature = data.features?.[0];

    if (!feature) {
      return {
        found: false,
        query,
      };
    }

    return {
      found: true,
      query,
      placeName: feature.place_name ?? null,
      coordinates: feature.center ?? null,
      text: feature.text ?? null,
      id: feature.id ?? null,
    };
  } catch {
    return null;
  }
}
