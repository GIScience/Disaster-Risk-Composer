#!/usr/bin/env python3
"""
Build a combined world.json-style GeoJSON from the same per-country ADM
boundary data the dashboard already loads from S3 (ADM2, falling back to
ADM1 - see src/composables/useRiskLogic.ts), instead of Natural Earth.

For each country in available_countries.json:
  1. download its ADM2 (or ADM1) .pmtiles from HeiGIT's S3 bucket
  2. convert it to GeoJSON with ogr2ogr
  3. dissolve all admin-unit polygons into one national outline
  4. append it as a single Feature (with iso_a3) to the combined output
  5. delete the temporary downloads

Only covers countries with risk data (the ones the dashboard can actually
show). Countries without S3 boundary data are skipped and logged - merging
the result with the existing Natural-Earth world.json for those is a
separate, manual step.

Requirements:
  - Python packages: requests, shapely  (pip install requests shapely)
  - GDAL's `ogr2ogr` CLI tool available on PATH
      macOS:  brew install gdal
      Ubuntu: sudo apt-get install gdal-bin

Usage:
  python3 scripts/generate_world_boundaries.py
  python3 scripts/generate_world_boundaries.py --limit 5
  python3 scripts/generate_world_boundaries.py --country YEM --country SAU
  python3 scripts/generate_world_boundaries.py --output world_osm.geojson --simplify-tolerance 0.0005
"""

from __future__ import annotations

import argparse
import json
import logging
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Optional

import requests
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

BASE_URL = "https://hot.storage.heigit.org/heigit-hdx-public/risk_assessment_inputs"
LAYER_NAME = "boundary"
DEFAULT_COUNTRIES_FILE = Path(__file__).resolve().parent.parent / "public" / "data" / "available_countries.json"
DEFAULT_OUTPUT = Path("world_osm.geojson")

# Degrees used to close micro-gaps between neighbouring admin-unit polygons
# that don't perfectly share edges (buffer out, then back in by the same
# amount). ~0.0001 deg is roughly 10m at the equator - small enough not to
# visibly distort the outline, large enough to close typical sliver gaps.
GAP_CLOSE_BUFFER_DEG = 0.0001

# quad_segs controls how many line segments approximate a quarter-circle in
# buffer(). The default (8) is meant for smooth curves; here buffer() is only
# used to close gaps, so a low value avoids exploding the vertex count on
# complex multi-polygon countries (seen with Saudi Arabia: 1.8M vertices at
# the default before this was added).
GAP_CLOSE_QUAD_SEGS = 1

# Pre-simplify each admin unit before dissolving, to cut the base vertex
# density that comes from tippecanoe's near-full-resolution tiling. This
# matters much more for vertex count than the final --simplify-tolerance
# pass, since it also makes the union/buffer steps below cheaper.
PRE_SIMPLIFY_TOLERANCE_DEG = 0.0005

REQUEST_TIMEOUT = 120  # seconds, some countries' pmtiles are large

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("world_boundaries")


def check_ogr2ogr_available() -> None:
    if shutil.which("ogr2ogr") is None:
        log.error(
            "ogr2ogr (GDAL) not found on PATH. Install it first:\n"
            "  macOS:  brew install gdal\n"
            "  Ubuntu: sudo apt-get install gdal-bin"
        )
        sys.exit(1)


def load_country_codes(countries_file: Path) -> list[str]:
    log.info("Reading country list from %s", countries_file)
    with open(countries_file) as f:
        codes: list[str] = json.load(f)
    log.info("Found %d countries processed by the dashboard", len(codes))
    return codes


def find_pmtiles_url(session: requests.Session, code: str) -> tuple[Optional[str], Optional[str]]:
    """Mirror useRiskLogic.ts: try ADM2 first, fall back to ADM1. Returns (url, level)."""
    folder = code.lower()
    for level in ("ADM2", "ADM1"):
        url = f"{BASE_URL}/{folder}/{code}_{level}.pmtiles"
        try:
            resp = session.head(url, timeout=30)
        except requests.RequestException as exc:
            log.warning("  [%s] HEAD request failed for %s: %s", code, level, exc)
            continue
        if resp.ok:
            return url, level
    return None, None


def download(session: requests.Session, url: str, dest: Path) -> None:
    with session.get(url, timeout=REQUEST_TIMEOUT, stream=True) as resp:
        resp.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                f.write(chunk)


def pmtiles_to_geojson(pmtiles_path: Path, geojson_path: Path) -> None:
    result = subprocess.run(
        [
            "ogr2ogr",
            "-f", "GeoJSON",
            "-t_srs", "EPSG:4326",
            str(geojson_path),
            str(pmtiles_path),
            LAYER_NAME,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ogr2ogr failed: {result.stderr.strip()}")


def dissolve_to_national_boundary(geojson_path: Path) -> tuple[dict, int, int]:
    """Union all admin-unit polygons into one national outline.

    Returns (geometry_dict, fragment_count_before_cleanup, vertex_count_after).
    """
    with open(geojson_path) as f:
        data = json.load(f)

    geoms = [
        shape(feat["geometry"]).buffer(0).simplify(PRE_SIMPLIFY_TOLERANCE_DEG, preserve_topology=True)
        for feat in data["features"]
    ]
    dissolved = unary_union(geoms)

    fragments_before = len(dissolved.geoms) if hasattr(dissolved, "geoms") else 1

    # Close micro-gaps/slivers between neighbouring admin units.
    cleaned = dissolved.buffer(GAP_CLOSE_BUFFER_DEG, quad_segs=GAP_CLOSE_QUAD_SEGS).buffer(
        -GAP_CLOSE_BUFFER_DEG, quad_segs=GAP_CLOSE_QUAD_SEGS
    )

    polys = cleaned.geoms if hasattr(cleaned, "geoms") else [cleaned]
    vertex_count = sum(
        len(p.exterior.coords) + sum(len(i.coords) for i in p.interiors) for p in polys
    )

    return mapping(cleaned), fragments_before, vertex_count


def process_country(session: requests.Session, code: str, tmp_dir: Path) -> Optional[dict]:
    start = time.monotonic()
    url, level = find_pmtiles_url(session, code)
    if url is None:
        log.warning("  [%s] no ADM2 or ADM1 pmtiles found on S3 - skipping", code)
        return None

    pmtiles_path = tmp_dir / f"{code}.pmtiles"
    geojson_path = tmp_dir / f"{code}.geojson"

    try:
        log.info("  [%s] downloading %s (%s)", code, url, level)
        download(session, url, pmtiles_path)
        size_kb = pmtiles_path.stat().st_size / 1024
        log.info("  [%s] downloaded %.0f KB, converting with ogr2ogr", code, size_kb)

        pmtiles_to_geojson(pmtiles_path, geojson_path)

        geometry, fragments_before, vertex_count = dissolve_to_national_boundary(geojson_path)
        elapsed = time.monotonic() - start
        log.info(
            "  [%s] dissolved %d fragments -> cleaned geometry (%d vertices) in %.1fs",
            code, fragments_before, vertex_count, elapsed,
        )

        return {
            "type": "Feature",
            "properties": {"iso_a3": code, "adm_level_source": level},
            "geometry": geometry,
        }
    except Exception as exc:  # noqa: BLE001 - keep the batch going on a per-country failure
        log.error("  [%s] failed: %s", code, exc)
        return None
    finally:
        pmtiles_path.unlink(missing_ok=True)
        geojson_path.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--countries-file", type=Path, default=DEFAULT_COUNTRIES_FILE, help="Path to available_countries.json")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output combined GeoJSON path")
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N countries (for testing)")
    parser.add_argument("--country", action="append", dest="countries", metavar="ISO3", help="Only process specific country code(s); repeatable")
    parser.add_argument("--simplify-tolerance", type=float, default=0.0, help="Optional shapely simplify tolerance in degrees (e.g. 0.0005). 0 disables simplification.")
    args = parser.parse_args()

    check_ogr2ogr_available()

    codes = load_country_codes(args.countries_file)
    if args.countries:
        wanted = {c.upper() for c in args.countries}
        codes = [c for c in codes if c in wanted]
        log.info("Filtered to %d requested countries: %s", len(codes), ", ".join(codes))
    if args.limit:
        codes = codes[: args.limit]
        log.info("Limiting to first %d countries", len(codes))

    features: list[dict] = []
    skipped: list[str] = []
    failed: list[str] = []

    session = requests.Session()
    run_start = time.monotonic()

    with tempfile.TemporaryDirectory(prefix="world_boundaries_") as tmp:
        tmp_dir = Path(tmp)
        try:
            for i, code in enumerate(codes, start=1):
                log.info("[%d/%d] %s", i, len(codes), code)
                feature = process_country(session, code, tmp_dir)
                if feature is None:
                    skipped.append(code)
                else:
                    features.append(feature)
        except KeyboardInterrupt:
            log.warning("Interrupted - writing out the %d countries collected so far", len(features))

    if args.simplify_tolerance > 0:
        log.info("Simplifying all geometries with tolerance %s deg", args.simplify_tolerance)
        for feat in features:
            geom = shape(feat["geometry"]).simplify(args.simplify_tolerance, preserve_topology=True)
            feat["geometry"] = mapping(geom)

    collection = {"type": "FeatureCollection", "features": features}
    with open(args.output, "w") as f:
        json.dump(collection, f)

    elapsed_total = time.monotonic() - run_start
    size_mb = args.output.stat().st_size / (1024 * 1024)

    log.info("=" * 60)
    log.info("Done in %.1f min", elapsed_total / 60)
    log.info("Succeeded: %d countries", len(features))
    if skipped:
        log.info("Skipped (no S3 boundary data): %s", ", ".join(skipped))
    if failed:
        log.info("Failed (error during processing): %s", ", ".join(failed))
    log.info("Output: %s (%.1f MB)", args.output, size_mb)
    log.info(
        "Note: only covers the %d countries the dashboard has risk data for. "
        "Countries not in available_countries.json still need boundaries from "
        "elsewhere (e.g. kept from the existing Natural Earth world.json).",
        len(codes),
    )


if __name__ == "__main__":
    main()
