"""
Generate public/data/world-labels.json: the country name labels on the dashboard's world map
(RiskMap.vue, layers "world-country-labels-*"). The country dropdown uses the same names.

- Names: OCHA's preferred terms from the "Countries and Territories" taxonomy (OCHA Digital
  Services), https://data.humdata.org/dataset/countries-and-territories (retrieved 2026-10-14).
- Positions: Natural Earth's hand-placed label points (LABEL_X / LABEL_Y).
- Area: planar area in square degrees, only used to show large countries first (see the
  label tiers in RiskMap.vue: >= 100 from zoom 0, >= 10 from zoom 2, the rest from zoom 4).

Run:  python3 scripts/generate_world_labels.py
"""

import json
import urllib.request
from pathlib import Path

NATURAL_EARTH_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/"
    "geojson/ne_50m_admin_0_countries.geojson"
)
OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "world-labels.json"

# Natural Earth ADM0_A3 code -> label: OCHA's preferred term for the country's ISO code
# (Kosovo: OCHA code XKX), except the short names chosen for Bolivia, Iran, Laos, Micronesia,
# Netherlands, North Korea, Russia, South Korea, Taiwan, Tanzania, United Kingdom and Venezuela. Somaliland and Northern Cyprus are not in OCHA's list and get no
# label of their own.
NAMES = {
    "AFG": "Afghanistan",
    "ALB": "Albania",
    "DZA": "Algeria",
    "AGO": "Angola",
    "ATA": "Antarctica",
    "ATG": "Antigua and Barbuda",
    "ARG": "Argentina",
    "ARM": "Armenia",
    "AUS": "Australia",
    "AUT": "Austria",
    "AZE": "Azerbaijan",
    "BHS": "Bahamas",
    "BGD": "Bangladesh",
    "BLR": "Belarus",
    "BEL": "Belgium",
    "BLZ": "Belize",
    "BEN": "Benin",
    "BTN": "Bhutan",
    "BOL": "Bolivia",
    "BIH": "Bosnia and Herzegovina",
    "BWA": "Botswana",
    "BRA": "Brazil",
    "BRN": "Brunei Darussalam",
    "BGR": "Bulgaria",
    "BFA": "Burkina Faso",
    "BDI": "Burundi",
    "CPV": "Cabo Verde",
    "KHM": "Cambodia",
    "CMR": "Cameroon",
    "CAN": "Canada",
    "CAF": "Central African Republic",
    "TCD": "Chad",
    "CHL": "Chile",
    "CHN": "China",
    "COL": "Colombia",
    "COM": "Comoros",
    "COG": "Congo",
    "CRI": "Costa Rica",
    "HRV": "Croatia",
    "CUB": "Cuba",
    "CYP": "Cyprus",
    "CZE": "Czechia",
    "CIV": "Côte d'Ivoire",
    "PRK": "North Korea",
    "COD": "Democratic Republic of the Congo",
    "DNK": "Denmark",
    "DJI": "Djibouti",
    "DMA": "Dominica",
    "DOM": "Dominican Republic",
    "ECU": "Ecuador",
    "EGY": "Egypt",
    "SLV": "El Salvador",
    "GNQ": "Equatorial Guinea",
    "ERI": "Eritrea",
    "EST": "Estonia",
    "SWZ": "Eswatini",
    "ETH": "Ethiopia",
    "FLK": "Falkland Islands (Malvinas)",
    "FJI": "Fiji",
    "FIN": "Finland",
    "FRA": "France",
    "ATF": "French Southern Territories",
    "GAB": "Gabon",
    "GMB": "Gambia",
    "GEO": "Georgia",
    "DEU": "Germany",
    "GHA": "Ghana",
    "GRC": "Greece",
    "GRL": "Greenland",
    "GRD": "Grenada",
    "GTM": "Guatemala",
    "GIN": "Guinea",
    "GNB": "Guinea-Bissau",
    "GUY": "Guyana",
    "HTI": "Haiti",
    "HND": "Honduras",
    "HUN": "Hungary",
    "ISL": "Iceland",
    "IND": "India",
    "IDN": "Indonesia",
    "IRN": "Iran",
    "IRQ": "Iraq",
    "IRL": "Ireland",
    "ISR": "Israel",
    "ITA": "Italy",
    "JAM": "Jamaica",
    "JPN": "Japan",
    "JOR": "Jordan",
    "KAZ": "Kazakhstan",
    "KEN": "Kenya",
    "KOS": "Kosovo",
    "KWT": "Kuwait",
    "KGZ": "Kyrgyzstan",
    "LAO": "Laos",
    "LVA": "Latvia",
    "LBN": "Lebanon",
    "LSO": "Lesotho",
    "LBR": "Liberia",
    "LBY": "Libya",
    "LTU": "Lithuania",
    "LUX": "Luxembourg",
    "MDG": "Madagascar",
    "MWI": "Malawi",
    "MYS": "Malaysia",
    "MDV": "Maldives",
    "MLI": "Mali",
    "MRT": "Mauritania",
    "MUS": "Mauritius",
    "MEX": "Mexico",
    "FSM": "Micronesia",
    "MNG": "Mongolia",
    "MNE": "Montenegro",
    "MAR": "Morocco",
    "MOZ": "Mozambique",
    "MMR": "Myanmar",
    "NAM": "Namibia",
    "NPL": "Nepal",
    "NLD": "Netherlands",
    "NCL": "New Caledonia",
    "NZL": "New Zealand",
    "NIC": "Nicaragua",
    "NER": "Niger",
    "NGA": "Nigeria",
    "MKD": "North Macedonia",
    "NOR": "Norway",
    "OMN": "Oman",
    "PAK": "Pakistan",
    "PAN": "Panama",
    "PNG": "Papua New Guinea",
    "PRY": "Paraguay",
    "PER": "Peru",
    "PHL": "Philippines",
    "POL": "Poland",
    "PRT": "Portugal",
    "PRI": "Puerto Rico",
    "QAT": "Qatar",
    "KOR": "South Korea",
    "MDA": "Republic of Moldova",
    "ROU": "Romania",
    "RUS": "Russia",
    "RWA": "Rwanda",
    "KNA": "Saint Kitts and Nevis",
    "LCA": "Saint Lucia",
    "VCT": "Saint Vincent and the Grenadines",
    "STP": "Sao Tome and Principe",
    "SAU": "Saudi Arabia",
    "SEN": "Senegal",
    "SRB": "Serbia",
    "SYC": "Seychelles",
    "SLE": "Sierra Leone",
    "SVK": "Slovakia",
    "SVN": "Slovenia",
    "SLB": "Solomon Islands",
    "SOM": "Somalia",
    "ZAF": "South Africa",
    "SDS": "South Sudan",
    "ESP": "Spain",
    "LKA": "Sri Lanka",
    "PSX": "State of Palestine",
    "SDN": "Sudan",
    "SUR": "Suriname",
    "SWE": "Sweden",
    "CHE": "Switzerland",
    "SYR": "Syrian Arab Republic",
    "TWN": "Taiwan",
    "TJK": "Tajikistan",
    "THA": "Thailand",
    "TLS": "Timor-Leste",
    "TGO": "Togo",
    "TON": "Tonga",
    "TTO": "Trinidad and Tobago",
    "TUN": "Tunisia",
    "TKM": "Turkmenistan",
    "TUR": "Türkiye",
    "UGA": "Uganda",
    "UKR": "Ukraine",
    "ARE": "United Arab Emirates",
    "GBR": "United Kingdom",
    "TZA": "Tanzania",
    "USA": "United States of America",
    "URY": "Uruguay",
    "UZB": "Uzbekistan",
    "VUT": "Vanuatu",
    "VEN": "Venezuela",
    "VNM": "Viet Nam",
    "SAH": "Western Sahara",
    "YEM": "Yemen",
    "ZMB": "Zambia",
    "ZWE": "Zimbabwe"
}


# Natural Earth draws borders as they are on the ground, so only the strip east of the Moroccan
# wall is "W. Sahara" there. Use the whole territory (UN practice) for the zoom tier.
AREA_OVERRIDES = {"SAH": 24.0}


def ring_area(ring):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:])) / 2


def planar_area(geometry):
    polygons = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        polygons = [polygons]
    return sum(abs(ring_area(p[0])) - sum(abs(ring_area(h)) for h in p[1:]) for p in polygons)


def main():
    with urllib.request.urlopen(NATURAL_EARTH_URL) as response:
        countries = json.load(response)["features"]
    by_code = {f["properties"]["ADM0_A3"]: f for f in countries}

    missing = sorted(set(NAMES) - set(by_code))
    if missing:
        raise SystemExit(f"Not in Natural Earth: {missing}")

    features = []
    for code, name in NAMES.items():
        country = by_code[code]
        p = country["properties"]
        iso = p["ISO_A3"] if p["ISO_A3"] != "-99" else p["ISO_A3_EH"]
        features.append({
            "type": "Feature",
            "properties": {
                "iso_a3": iso if iso != "-99" else code,
                "name": name,
                "area": AREA_OVERRIDES.get(code, round(planar_area(country["geometry"]), 2)),
            },
            "geometry": {"type": "Point", "coordinates": [p["LABEL_X"], p["LABEL_Y"]]},
        })

    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False))
    print(f"{len(features)} labels -> {OUT}")


if __name__ == "__main__":
    main()
