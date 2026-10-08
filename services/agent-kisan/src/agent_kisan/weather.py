"""Rain days from the Open-Meteo forecast (free, no key). P3 owns the shared Open-Meteo client;
swap this for theirs once it lands, keeping rain_forecast()'s shape.

Machines can't work a wet field. A day counts as a rain day if the forecast is at
least RAIN_MM; after a heavy day (WET_AFTER_MM or more) the next day is lost too.
Both are planning values, to check with the KVK. Open-Meteo forecasts 16 days
ahead, so days past `forecast_until` are unknown and treated as dry.
"""

import time
from dataclasses import dataclass
from datetime import date, timedelta

import httpx

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
FORECAST_DAYS = 16
RAIN_MM = 5.0
WET_AFTER_MM = 20.0
CACHE_SECONDS = 3 * 3600


@dataclass(frozen=True)
class RainForecast:
    rain_dates: frozenset[date]
    forecast_until: date
    daily_mm: dict[date, float]
    source: str = "open-meteo"

    def to_json(self, window: tuple[date, date] | None = None) -> dict:
        dates = sorted(self.rain_dates)
        out = {"source": self.source, "forecast_until": self.forecast_until.isoformat(),
               "rain_dates": [d.isoformat() for d in dates]}
        if window:
            start, end = window
            out["rain_dates"] = [d.isoformat() for d in dates if start <= d < end]
            if end - timedelta(1) > self.forecast_until:
                out["note"] = (f"the forecast only reaches {self.forecast_until.isoformat()}; "
                               "later days are assumed dry")
        return out


def rain_days(daily_mm: dict[date, float], rain_mm: float = RAIN_MM, wet_after_mm: float = WET_AFTER_MM) -> set[date]:
    days = {d for d, mm in daily_mm.items() if mm >= rain_mm}
    days |= {d + timedelta(1) for d, mm in daily_mm.items() if mm >= wet_after_mm}
    return days


def fetch_daily_mm(lat: float, lon: float, client: httpx.Client | None = None) -> dict[date, float]:
    params = {
        "latitude": round(lat, 3), "longitude": round(lon, 3),
        "daily": "precipitation_sum", "timezone": "Asia/Kolkata", "forecast_days": FORECAST_DAYS,
    }
    res = (client or httpx).get(FORECAST_URL, params=params, timeout=5.0)
    res.raise_for_status()
    daily = res.json()["daily"]
    return {date.fromisoformat(t): float(mm or 0.0) for t, mm in zip(daily["time"], daily["precipitation_sum"])}


_cache: dict[tuple[float, float], tuple[float, RainForecast]] = {}


def rain_forecast(lat: float, lon: float, client: httpx.Client | None = None) -> RainForecast:
    """Rain days near (lat, lon), cached for 3 hours per ~10 km cell. Raises httpx errors on failure."""
    key = (round(lat, 1), round(lon, 1))
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
        return hit[1]
    daily = fetch_daily_mm(lat, lon, client)
    forecast = RainForecast(frozenset(rain_days(daily)), max(daily), daily)
    _cache[key] = (time.monotonic(), forecast)
    return forecast
