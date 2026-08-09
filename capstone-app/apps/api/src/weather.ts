type OpenWeatherCurrentResponse = {
  name?: string;
  cod?: number | string;
  weather?: Array<{
    main?: string;
    description?: string;
    icon?: string;
  }>;
  main?: {
    temp?: number;
    feels_like?: number;
    humidity?: number;
  };
  wind?: {
    speed?: number;
  };
};

export async function getCurrentWeather(lat: number, lon: number) {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return null;
  }

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("appid", apiKey);
  url.searchParams.set("units", "metric");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OpenWeather request failed with ${response.status}`);
  }

  const data = (await response.json()) as OpenWeatherCurrentResponse;

  return {
    location: data.name ?? null,
    condition: data.weather?.[0]?.main ?? null,
    description: data.weather?.[0]?.description ?? null,
    temperature: data.main?.temp ?? null,
    feelsLike: data.main?.feels_like ?? null,
    humidity: data.main?.humidity ?? null,
    windSpeed: data.wind?.speed ?? null,
  };
}
