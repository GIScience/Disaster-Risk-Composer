"""
Generate public/data/cyclone-storms.json: for every dashboard country with cyclone indicators,
the historical storms the indicators are built from (count, period, names). The dashboard shows
it in the analysis panel ("Based on 6 storms, 2004–2023").

GAIA computes the cyclone indicators but doesn't export the storm list, so this script repeats
GAIA's selection (src/gaia/scripts/fetch_cyclones_ncei.py, build_cyclone_buffers):
  1. IBTrACS v04r01 since-1980 track segments with Saffir-Simpson category >= 1 (USA_SSHS),
  2. that touch the bounding box of the country's boundaries,
  3. buffered by the mean of the four 34-knot radii (USA_R34_*) in the country's UTM zone;
     segments without radii drop out,
  4. clipped to the country.
A storm counts if at least one of its zones reaches the country. If GAIA changes its method or
reruns with newer IBTrACS data, rerun this script (or replace it with a file exported by GAIA).

Only track points up to DATA_DATE are used: the date of GAIA's cyclone exposure data, so storms
that IBTrACS added later don't count. Update it (or pass --until) when GAIA reruns.

Boundaries come from the dashboard's own boundary files (<ISO>_<ADM2|ADM1>.pmtiles on the HeiGIT
storage), read at a moderate zoom level - precise enough to tell whether a wind zone reaches the
country. Countries with cyclone indicators are found by looking for a "risk_cyclone" column in
their risk parquet.

Run (needs network; downloads IBTrACS, ~22 MB, once into scripts/.cache/; takes ~15 min).
Pass ISO codes (e.g. "MMR IDN") to recompute only these countries, --refresh to download the
current IBTrACS file again (needed when DATA_DATE is later than the cached file):
  uv run --with geopandas --with pyogrio --with duckdb --with pyyaml --with requests \
    --with pmtiles --with mapbox-vector-tile python scripts/generate_cyclone_storms.py [--refresh]
"""

import argparse
import gzip
import json
import math
import sys
import time
import warnings
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import duckdb
import geopandas as gpd
import mapbox_vector_tile
import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import yaml
from pmtiles.reader import Reader
from shapely.geometry import shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "cyclone-storms.json"
CACHE = Path(__file__).resolve().parent / ".cache"
STORAGE = "https://hot.storage.heigit.org/heigit-hdx-public"
COUNTRIES_YAML = f"{STORAGE}/oqapi_hdx/countries/countries.yaml"
IBTRACS_URL = (
    "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/"
    "v04r01/access/shapefile/IBTrACS.since1980.list.v04r01.lines.zip"
)
R34 = ["USA_R34_NE", "USA_R34_SE", "USA_R34_SW", "USA_R34_NW"]
# Date of GAIA's cyclone exposure data (published indicators)
DATA_DATE = "2026-10-14"
# Read boundaries at the highest zoom at which the country's extent needs at most this many tiles
MAX_TILES = 64


def exists(url):
    for attempt in range(5):
        try:
            return requests.head(url, timeout=60).status_code == 200
        except requests.RequestException:
            time.sleep(2**attempt)
    raise RuntimeError(f"Storage not reachable: {url}")


def risk_level(con, code):
    """The admin level whose risk parquet has a cyclone column (as the dashboard loads it), or None."""
    # Like the dashboard: ADM2 if its boundary file exists, otherwise ADM1
    base = f"{STORAGE}/risk_assessment_inputs/{code.lower()}/{code}"
    level = "ADM2" if exists(f"{base}_ADM2.pmtiles") else "ADM1"
    url = f"{base}_{level}_risk.parquet"
    if not exists(url):
        return None
    # Retry: a timeout must not make a country silently drop out
    for attempt in range(5):
        try:
            cols = [r[0] for r in con.execute(f"DESCRIBE SELECT * FROM '{url}'").fetchall()]
            return level if "risk_cyclone" in cols else None
        except duckdb.Error:
            time.sleep(2**attempt)
    raise RuntimeError(f"Could not read {url}")


def cyclone_countries(only=None):
    codes = only or sorted(yaml.safe_load(requests.get(COUNTRIES_YAML, timeout=60).text))

    def check(code):
        con = duckdb.connect()
        con.execute("INSTALL httpfs; LOAD httpfs;")
        return code, risk_level(con, code)

    with ThreadPoolExecutor(12) as ex:
        return [(c, lvl) for c, lvl in ex.map(check, codes) if lvl]


def load_boundary(code, level):
    """The country's outline (EPSG:4326) from the dashboard's boundary PMTiles."""
    url = f"{STORAGE}/risk_assessment_inputs/{code.lower()}/{code}_{level}.pmtiles"
    # The storage sometimes drops a connection; retry instead of failing the whole run
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=Retry(total=5, connect=5, backoff_factor=2)))

    def get_bytes(offset, length):
        r = session.get(url, headers={"Range": f"bytes={offset}-{offset + length - 1}"}, timeout=60)
        r.raise_for_status()
        return r.content

    reader = Reader(get_bytes)
    h = reader.header()
    west, south = h["min_lon_e7"] / 1e7, h["min_lat_e7"] / 1e7
    east, north = h["max_lon_e7"] / 1e7, h["max_lat_e7"] / 1e7

    def tile_range(z):
        n = 2**z
        x = lambda lon: min(n - 1, max(0, int((lon + 180) / 360 * n)))
        y = lambda lat: min(n - 1, max(0, int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)))
        return range(x(west), x(east) + 1), range(y(north), y(south) + 1)

    z = h["min_zoom"]
    while z < h["max_zoom"]:
        xs, ys = tile_range(z + 1)
        if len(xs) * len(ys) > MAX_TILES:
            break
        z += 1

    parts = []
    xs, ys = tile_range(z)
    for x in xs:
        for y in ys:
            data = reader.get(z, x, y)
            if not data:
                continue
            if data[:2] == b"\x1f\x8b":
                data = gzip.decompress(data)
            for layer in mapbox_vector_tile.decode(data).values():
                extent = layer.get("extent", 4096)

                def to_lonlat(px, py, _z=z, _x=x, _y=y, _e=extent):
                    n = 2**_z
                    lon = (_x + px / _e) / n * 360 - 180
                    # mapbox_vector_tile flips y by default (origin bottom-left)
                    merc_y = (_y + 1 - py / _e) / n
                    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * merc_y))))
                    return lon, lat

                for f in layer["features"]:
                    g = shape(f["geometry"])
                    if g.geom_type in ("Polygon", "MultiPolygon"):
                        parts.append(transform(lambda xx, yy: tuple(zip(*map(lambda p: to_lonlat(*p), zip(xx, yy)))), g).buffer(0))
    return gpd.GeoDataFrame(geometry=[unary_union(parts)], crs="EPSG:4326")


def ibtracs(until, refresh=False):
    CACHE.mkdir(exist_ok=True)
    zip_path = CACHE / "IBTrACS.since1980.list.v04r01.lines.zip"
    shp_dir = CACHE / "IBTrACS"
    if refresh or not zip_path.exists():
        print("Downloading IBTrACS ...")
        r = requests.get(IBTRACS_URL, timeout=600)
        r.raise_for_status()
        zip_path.write_bytes(r.content)
        if shp_dir.exists():
            for f in shp_dir.iterdir():
                f.unlink()
    if not any(shp_dir.glob("*.shp")):
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(shp_dir)
    gdf = gpd.read_file(next(shp_dir.glob("*.shp")))
    latest = str(gdf["ISO_TIME"].max())[:10]
    if latest < until:
        print(f"WARNING: IBTrACS file ends {latest}, before {until}; run with --refresh")
    # ISO_TIME is "YYYY-MM-DD hh:mm:ss": keep the points up to and including the data date
    gdf = gdf[gdf["ISO_TIME"].astype(str).str[:10] <= until]
    return gdf[gdf["USA_SSHS"].fillna(0) >= 1]


def estimate_utm(gdf):
    # As GAIA: UTM zone of the country's centroid
    c = gdf.dissolve().centroid.iloc[0]
    zone = min(int((c.x + 180) / 6) + 1, 60)
    return f"EPSG:{32600 + zone if c.y >= 0 else 32700 + zone}"


def storms_for(tracks, country):
    xmin, ymin, xmax, ymax = country.total_bounds
    segs = tracks.cx[xmin:xmax, ymin:ymax]
    if segs.empty:
        return []
    utm = estimate_utm(country)
    segs = segs.to_crs(utm).copy()
    country = country.to_crs(utm)
    segs["geometry"] = segs.buffer(segs[R34].mean(axis=1, skipna=True).fillna(0) * 1852)
    segs = segs[~segs.geometry.is_empty & segs.geometry.notnull()]
    segs["geometry"] = segs.geometry.buffer(0)
    land = country.geometry.buffer(0).union_all()
    segs = segs[segs.intersects(land)]
    out = []
    for sid, g in segs.groupby("SID"):
        out.append(
            {
                # IBTrACS marks storms without a name as "NOT_NAMED" or "UNNAMED"
                "name": None if str(g["NAME"].iloc[0]) in ("None", "NOT_NAMED", "UNNAMED") else str(g["NAME"].iloc[0]).title(),
                "year": int(g["SEASON"].iloc[0]),
                "category": int(g["USA_SSHS"].max()),
            }
        )
    return sorted(out, key=lambda s: (s["year"], s["name"] or ""))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("codes", nargs="*", help="recompute only these countries, keep the others")
    parser.add_argument("--until", default=DATA_DATE, help="last date of track data (YYYY-MM-DD)")
    parser.add_argument("--refresh", action="store_true", help="download IBTrACS again")
    args = parser.parse_args()
    only = [c.upper() for c in args.codes]
    tracks = ibtracs(args.until, args.refresh)
    countries = cyclone_countries(only)
    print(f"{len(countries)} countries with cyclone indicators, tracks up to {args.until}")
    previous = json.loads(OUT.read_text()) if only and OUT.exists() else {}
    if previous.get("until") not in (None, args.until):
        sys.exit(f"{OUT.name} is for tracks up to {previous['until']}; recompute all countries")
    result = previous.get("countries", {})
    for code, level in countries:
        storms = storms_for(tracks, load_boundary(code, level))
        years = [s["year"] for s in storms]
        result[code] = {
            "storms": len(storms),
            "from": min(years) if years else None,
            "to": max(years) if years else None,
            "list": storms,
        }
        print(f"  {code} ({level}): {len(storms)} storm{'' if len(storms) == 1 else 's'}" + (f", {min(years)}–{max(years)}" if years else ""))
    out = {"until": args.until, "countries": dict(sorted(result.items()))}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    pd.options.mode.copy_on_write = True
    # GAIA takes the UTM zone from the centroid in degrees too; precise enough to pick a zone
    warnings.filterwarnings("ignore", "Geometry is in a geographic CRS")
    warnings.filterwarnings("ignore", "GeoSeries.notna")
    main()
