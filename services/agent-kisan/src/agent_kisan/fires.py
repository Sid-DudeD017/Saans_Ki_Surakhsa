"""Satellite fire points near a farm, from P3's GET /v1/fires (NASA FIRMS VIIRS, the last day).

Kisan uses this to know whether fires are already being seen around the farm, which makes a help
request more urgent for the officer. A fire pixel is 375 m across and can be a neighbour's field,
so it is never treated as proof that this farmer burned.

P3's endpoint takes a bounding box (minLon,minLat,maxLon,maxLat); this asks for the box around the
farm and keeps the points inside the circle, nearest first. SAANS_AQI_URL is the base URL of P3's
service (the Next.js app, e.g. http://localhost:3000). Unset means fire data is unavailable.
"""

import math
import os
import time
from collections.abc import Callable
from dataclasses import dataclass

import httpx

from agent_kisan.planner import haversine_km

DEFAULT_RADIUS_KM = 5.0
MAX_RADIUS_KM = 25.0
CACHE_SECONDS = 30 * 60  # FIRMS adds a satellite pass every few hours
KM_PER_DEGREE_LAT = 111.32


class FiresUnavailable(Exception):
    pass


@dataclass(frozen=True)
class Fire:
    lat: float
    lon: float
    distance_km: float
    acquired_at: str
    satellite: str
    confidence: str | None  # low, nominal or high
    frp_mw: float | None

    def to_json(self) -> dict:
        return {"lat": self.lat, "lon": self.lon, "distance_km": round(self.distance_km, 2),
                "acquired_at": self.acquired_at, "satellite": self.satellite, "confidence": self.confidence,
                "frp_mw": self.frp_mw}


@dataclass(frozen=True)
class FiresNear:
    fires: tuple[Fire, ...]  # nearest first
    radius_km: float
    as_of: str | None
    source: str = "nasa-firms via /v1/fires"

    def to_json(self, limit: int = 10) -> dict:
        trusted = [f for f in self.fires if f.confidence != "low"]
        return {
            "source": self.source, "as_of": self.as_of, "radius_km": self.radius_km,
            "count": len(self.fires),
            "count_nominal_or_high": len(trusted),
            "nearest_km": round(self.fires[0].distance_km, 2) if self.fires else None,
            "fires": [f.to_json() for f in self.fires[:limit]],
        }


def bbox(lat: float, lon: float, radius_km: float) -> str:
    """minLon,minLat,maxLon,maxLat of the square around the circle."""
    dlat = radius_km / KM_PER_DEGREE_LAT
    dlon = radius_km / (KM_PER_DEGREE_LAT * max(math.cos(math.radians(lat)), 0.01))
    return ",".join(f"{v:.4f}" for v in (lon - dlon, lat - dlat, lon + dlon, lat + dlat))


def confidence(raw) -> str | None:
    """VIIRS sends l / n / h (or the words); MODIS sends 0-100."""
    text = str(raw if raw is not None else "").strip().lower()
    if text in ("l", "low"):
        return "low"
    if text in ("n", "nominal"):
        return "nominal"
    if text in ("h", "high"):
        return "high"
    try:
        pct = float(text)
    except ValueError:
        return None
    return "low" if pct < 30 else "nominal" if pct < 80 else "high"


def fires_near(lat: float, lon: float, radius_km: float = DEFAULT_RADIUS_KM, *, base_url: str,
               client: httpx.Client | None = None) -> FiresNear:
    """Raises FiresUnavailable when P3's service can't answer."""
    if not 0 < radius_km <= MAX_RADIUS_KM:
        raise ValueError(f"radius_km must be more than 0 and at most {MAX_RADIUS_KM:g}")
    try:
        res = (client or httpx).get(f"{base_url.rstrip('/')}/v1/fires",
                                    params={"bbox": bbox(lat, lon, radius_km)}, timeout=8.0)
        res.raise_for_status()
        body = res.json()
        points = body["fires"]
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
        raise FiresUnavailable(f"fire data unavailable ({type(e).__name__})") from e

    found = []
    for p in points:
        try:
            plat, plon = float(p["lat"]), float(p["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        d = haversine_km((lat, lon), (plat, plon))
        if d <= radius_km:
            frp = p.get("frp")
            found.append(Fire(plat, plon, d, str(p.get("acquisition_time", "")), str(p.get("satellite", "")),
                              confidence(p.get("confidence")), float(frp) if frp is not None else None))
    found.sort(key=lambda f: (f.distance_km, f.acquired_at))
    return FiresNear(tuple(found), radius_km, body.get("as_of"))


_cache: dict[tuple[float, float, float], tuple[float, FiresNear]] = {}


def default_fires(lat: float, lon: float, radius_km: float = DEFAULT_RADIUS_KM) -> FiresNear:
    """fires_near() against SAANS_AQI_URL, cached for 30 minutes per ~1 km cell."""
    base_url = os.environ.get("SAANS_AQI_URL")
    if not base_url:
        raise FiresUnavailable("fire data isn't set up here (SAANS_AQI_URL is not set)")
    key = (round(lat, 2), round(lon, 2), radius_km)
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
        return hit[1]
    result = fires_near(lat, lon, radius_km, base_url=base_url)
    _cache[key] = (time.monotonic(), result)
    return result


FireSource = Callable[[float, float, float], FiresNear]
