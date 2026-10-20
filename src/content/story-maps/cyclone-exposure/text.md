<!--
  Cyclone exposure story map: every text shown on the page, in page order.

  How to edit:
  - Change the text under a heading. Keep the {…} at the end of each heading as it is: it
    says where on the page the text goes. The words before it are only a description.
  - **bold** and [links](https://…) work.
  - Several paragraphs under one heading → several paragraphs on the page.
    Lines starting with "- " → a list.
  - Words in {curly braces} inside a text (e.g. {n}) are filled in by the page; keep them.
  - Map layers, data files, colours and numbers are in config.json, not here.
-->

# Overview card (story map list) {storyMap.hero}

## Image description {alt}
Storm over a settlement

## Title {title}
Cyclone exposure, explained

## Subtitle {subtitle}
What does “children under 5 exposed to intensity 3 cyclone winds” actually mean? This page takes one dashboard indicator apart, step by step.

# Sidebar {storyMap.sidebar}

## Title {title}
Cyclone Exposure Story Map

## Subtitle {subtitle}
Understand how cyclone exposure indicators are produced and what they mean.

## Sidebar step: Choose a cyclone intensity {steps.sec-cyclone}

### Title {title}
Choose a cyclone intensity

### Text {body}
Storm strength on the Saffir-Simpson scale.

## Sidebar step: Apply the wind threshold {steps.sec-wind}

### Title {title}
Apply the wind threshold

### Text {body}
Only winds of **34 knots** or more count.

## Sidebar step: Overlay people or facilities {steps.sec-who}

### Title {title}
Overlay people or facilities

### Text {body}
Who or what is in the wind zone.

## Sidebar step: Aggregate to districts {steps.sec-count}

### Title {title}
Aggregate to districts

### Text {body}
From map pixels to one number per district.

## Sidebar step: From count to colour {steps.sec-score}

### Title {title}
From count to colour

### Text {body}
How the dashboard ranks districts.

## Sidebar step: Decode any indicator {steps.sec-decoder}

### Title {title}
Decode any indicator

### Text {body}
Try other combinations.

## About box: title {aside.title}
About this story map

## About box: text {aside.body}
Exposure shows who has been in the path of strong cyclone winds since 2004, not who will be affected or who needs help. Example: Myanmar.

# Header {storyMap.header}

## Description {description}
It estimates how many children under 5 live in places that the strongest storms since 2004, Saffir-Simpson Categories 4 and 5, reached with winds of at least 34 knots (about 63 km/h). The dashboard groups the five storm categories into three intensities: intensity 1 = Category 1, intensity 2 = Categories 2–3, intensity 3 = Categories 4–5. Exposure is one of three parts of risk, next to vulnerability and lack of coping capacity.

## Equation: Cyclone winds {equation.terms.cyclone-winds}

### Label {label}
Cyclone winds

### Small text {sublabel}
where strong winds reach

## Equation: People & places {equation.terms.people-places}

### Label {label}
People & places

### Small text {sublabel}
who or what is there

## Equation: Exposure {equation.terms.exposure}

### Label {label}
Exposure

### Small text {sublabel}
who is in the wind zone

# Header question and cards {storyMap.anatomy}

## Question part: children under 5 {parts.sec-who}

### Words in the question {text}
children under 5

### Hint {hint}
One population group; others work the same way.

## Question part: exposed to {parts.exposed-to}

### Words in the question {text}
exposed to

## Question part: intensity 3 cyclones {parts.sec-cyclone}

### Words in the question {text}
intensity 3 cyclones

### Hint {hint}
Saffir-Simpson Categories 4–5, the strongest storms, e.g. cyclones Nargis (2008) and Mocha (2023).

## Question part: with winds of at least {parts.with-winds-of-at-least}

### Words in the question {text}
with winds of at least

## Question part: 34 knots {parts.sec-wind}

### Words in the question {text}
34 knots

### Hint {hint}
About 63 km/h. Weaker winds don't count.

## Question part: , counted {parts.counted}

### Words in the question {text}
, counted

## Question part: per district {parts.sec-count}

### Words in the question {text}
per district

### Hint {hint}
All exposed children in a district added up.

# Step 1: Choose a cyclone intensity {storyMap.sections.sec-cyclone}

## Title {title}
Choose a cyclone intensity

## Subtitle {subtitle}
Every place that 34-knot winds reached gets one intensity: that of the strongest storm that reached it. The map shows all three; switch the intensity to highlight one.

## Info box {note.body}
**Intensity 1** = Saffir-Simpson Category 1, **intensity 2** = Categories 2–3, **intensity 3** = Categories 4–5. The Saffir-Simpson category describes the storm's **peak wind near its centre** (e.g. 119–153 km/h for Category 1), not the wind at each place. Weaker tropical storms are not included.

The zones come from **6 storms** between 2004 and 2023. Stronger storms have larger wind fields, so intensity 3 covers the largest area.

## Dataset {dataset.title}
Historical cyclone tracks, 2004–2023

## Dataset source {dataset.source}
IBTrACS v04r01, NOAA NCEI

## Button: Intensity 1 {control.options.1}

### Label {label}
Intensity 1

### Map legend entry {layerConfig.legendLabel}
Intensity 1: Category 1 storm

### Key figure {stat.value}
5.9 M

### Key figure text {stat.label}
people live where the strongest storm since 2004 was a Saffir-Simpson Category 1. The smallest zone.

## Button: Intensity 2 {control.options.2}

### Label {label}
Intensity 2

### Map legend entry {layerConfig.legendLabel}
Intensity 2: Category 2–3 storms

### Key figure {stat.value}
7.8 M

### Key figure text {stat.label}
people live where the strongest storm was a Saffir-Simpson Category 2 or 3.

## Button: Intensity 3 {control.options.3}

### Label {label}
Intensity 3

### Map legend entry {layerConfig.legendLabel}
Intensity 3: Category 4–5 storms

### Key figure {stat.value}
27.2 M

### Key figure text {stat.label}
people, about half of Myanmar, live where a Saffir-Simpson Category 4 or 5 storm reached, e.g. cyclones Nargis (2008) or Mocha (2023). This is the zone in our example.

## Map legend title {map.stackLegend.title}
Wind zone (34 kt or more)

## Map legend subtitle {map.stackLegend.subtitle}
Strongest storm that reached the place, by Saffir-Simpson category

## Graphic caption {explainer.caption}
Where zones overlap, the **strongest storm wins**. Unlike flood scenarios, the intensities don't overlap, so they add up: 5.9 M + 7.8 M + 27.2 M ≈ **40.9 M people** (about 3 in 4) live in the wind zone.

# Step 1 graphic: overlapping storms {ui.overlap}

## Left title {before}
Zones of two storms

## Left: weaker storm {weakStorm}
Cat 1 storm

## Left: stronger storm {strongStorm}
Cat 4 storm

## Right title {after}
One intensity per place

## Right: weaker class {weakClass}
Intensity 1

## Right: stronger class {strongClass}
Intensity 3

# Step 2: Apply the wind threshold {storyMap.sections.sec-wind}

## Title {title}
Apply the wind threshold

## Subtitle {subtitle}
Not every windy place is dangerous. A wind-speed threshold splits the area into two parts: places that are considered in the indicator, and places that are left out.

## Info box {note.body}
Only places with winds of **at least 34 knots** (63 km/h) count as exposed. From this speed on, branches break, loose objects fly around and walking becomes dangerous. Set the wind speed to see what it means.

For every piece of the storm track, the track data reports how far 34-knot winds reached (the mean of four directions). The corridor along the track is the wind zone. Every place inside then gets one intensity (step 1). Inside the zone, the wind is only known to be at least 34 knots.

# Step 2 graphic: wind scene {ui.wind}

## Line above the graphic {speed}
Wind speed

## Badge: above the threshold {counts}
Counts as exposed

## Badge: below the threshold {notCounted}
Not counted (below 34 kt)

## What the wind does (one line per speed band: below 20, 50, 62, 89, 118 km/h, and above) {effects}
- Light wind: leaves and small twigs move.
- Strong breeze: small trees sway, large branches move.
- Near gale: whole trees move, walking against the wind is hard.
- Gale: branches break off, loose objects fly around, roof tiles can come off.
- Storm: trees are uprooted, buildings are damaged.
- Hurricane force: severe damage to buildings, trees and power lines.

## Scale: threshold label {threshold}
34 kt threshold

## Scale: category ticks {category}
Cat {n}

## Note under the scale {scaleNote}
Cat 1–5: where the Saffir-Simpson categories start. They measure a storm's peak wind near its centre; the wind zone reaches out to where the wind drops to 34 kt.

## Slider label {setSpeed}
Set the wind speed

# Step 3: Overlay people or facilities {storyMap.sections.sec-who}

## Title {title}
Overlay people or facilities

## Subtitle {subtitle}
Choose a group, then a cyclone intensity.

## Button: Children under 5 {control.options.children_u5}

### Label {label}
Children under 5

## Button: Older people {control.options.elderly}

### Label {label}
Older people

## Button: Women {control.options.female_pop}

### Label {label}
Women

## Button: Everyone {control.options.total}

### Label {label}
Everyone

## Button: Facilities {control.options.facilities}

### Label {label}
Facilities

### Map legend: school {layerConfig.categories.school.label}
School

### Map legend: hospital {layerConfig.categories.hospital.label}
Hospital

### Map legend: clinic {layerConfig.categories.clinic.label}
Clinic

## Info box {note.body}
We lay a population map over the wind zone. Everyone living in a grid cell (about 100 × 100 m) inside the zone counts as exposed.

The population maps are projections for **2030** (WorldPop). “Facilities” are schools, hospitals and health centres from OpenStreetMap.

## Map legend title {map.stackLegend.title}
Wind zone (34 kt or more)

## Map legend subtitle {map.stackLegend.subtitle}
Strongest storm that reached the place, by Saffir-Simpson category

## Second row button: Intensity 1 {baseControl.options.1}

### Label {label}
Intensity 1

### Map legend entry {layerConfig.legendLabel}
Intensity 1: Category 1 storm

## Second row button: Intensity 2 {baseControl.options.2}

### Label {label}
Intensity 2

### Map legend entry {layerConfig.legendLabel}
Intensity 2: Category 2–3 storms

## Second row button: Intensity 3 {baseControl.options.3}

### Label {label}
Intensity 3

### Map legend entry {layerConfig.legendLabel}
Intensity 3: Category 4–5 storms

# Step 4: Aggregate to districts {storyMap.sections.sec-count}

## Title {title}
Aggregate to districts

## Subtitle {subtitle}
Intensity 3 cyclones (Saffir-Simpson Categories 4–5). Choose what to count.

## Button: Children under 5 {control.options.children_u5}

### Label {label}
Children under 5

### Legend title {legend.title}
Exposed children under 5

### Legend entry 1 {legend.items.0.label}
None

### Legend entry 2 {legend.items.1.label}
Up to 25,000

### Legend entry 3 {legend.items.2.label}
25,000–100,000

### Legend entry 4 {legend.items.3.label}
More than 100,000

### Results box title {results.title}
Example results (ADM2)

### Results box unit {results.unit}
children under 5 exposed

### Results box link {results.link.label}
View in dashboard

### Info box {note.body}
We add up all exposed children in the grid cells inside each district (see below). That gives one number per district: the value you see in the dashboard.

In Myanmar, about **1.9 million children under 5** live in places that Category 4–5 storms reached since 2004, almost **1 in 2**. 36 of 80 districts have such places.

## Button: Facilities {control.options.facilities}

### Label {label}
Facilities

### Legend title {legend.title}
Exposed facilities

### Legend entry 1 {legend.items.0.label}
None

### Legend entry 2 {legend.items.1.label}
1–50

### Legend entry 3 {legend.items.2.label}
51–200

### Legend entry 4 {legend.items.3.label}
More than 200

### Results box title {results.title}
Example results (ADM2)

### Results box unit {results.unit}
facilities exposed

### Results box link {results.link.label}
View in dashboard

### Info box {note.body}
Schools, hospitals and health centres come from OpenStreetMap as **points**, not as a grid. A facility counts as exposed if it lies inside the wind zone.

We count the exposed facilities in each district. In Myanmar, about **5,550 facilities** lie in places that Category 4–5 storms reached since 2004.

## Info box {note.body}
We add up all exposed children in the grid cells inside each district (see below). That gives one number per district: the value you see in the dashboard.

In Myanmar, about **1.9 million children under 5** live in places that Category 4–5 storms reached since 2004, almost **1 in 2**. 36 of 80 districts have such places.

# Step 4 graphic {ui.aggregation}

## People: first panel title {raster.caption}
Children per grid cell, wind zone edge in purple

## People: note under the first panel {raster.note}
Raster data (WorldPop): every ~100 m cell holds a number. A cell counts if its centre lies in the wind zone.

## People: totals title {raster.totals}
Cells in the wind zone added up per district

## Facilities: first panel title {points.caption}
Facilities as points, wind zone in purple

## Facilities: note under the first panel {points.note}
Vector data (OpenStreetMap): each facility is a point. Red = inside the wind zone.

## Facilities: totals title {points.totals}
Exposed facilities counted per district

## Key under the graphic: solid line {key.area}
34 kt edge

## Key under the graphic: dashed line {key.other}
storm track

# Step 5: From count to colour {storyMap.sections.sec-score}

## Title {title}
From count to colour

## Info box {note.body}
**Score:** each district gets a value from **0 to 1** within the country: 0 for the lowest district, 1 for the highest. The dashboard averages these scores over all active indicators, using your weights.

**Colour:** the districts are split at the quartiles into four groups. Cyclone winds reach only part of the country, so here **44 of 80 districts** have the value 0 and all fall into the lowest group; the “Moderate” group stays empty. Colours rank districts **within one country** and can't be compared between countries.

## Button: Open in the dashboard {links.open-in-the-dashboard}

### Label {label}
Open in the dashboard

## Subtitle {subtitle}
The dashboard doesn't map raw counts. It turns them into scores, and the scores into four colours.

## Chart unit {visualUnitLabel}
exposed children under 5 (Myanmar districts)

# Step 6: Decode any cyclone exposure indicator {storyMap.sections.sec-decoder}

## Title {title}
Decode any cyclone exposure indicator

## Subtitle {subtitle}
Every cyclone exposure indicator in the dashboard follows the same pattern.

## Label of the first dropdown {decoder.scenarioLabel}
Cyclone

## Dropdown 1 option: Intensity 1 {decoder.scenarios.1}

### Label {label}
Intensity 1

## Dropdown 1 option: Intensity 2 {decoder.scenarios.2}

### Label {label}
Intensity 2

## Dropdown 1 option: Intensity 3 {decoder.scenarios.3}

### Label {label}
Intensity 3

## Label of the second dropdown {decoder.subjectLabel}
Who or what

## Dropdown 2 option: Children under 5 {decoder.subjects.children_u5}

### Label {label}
Children under 5

## Dropdown 2 option: Children under 15 {decoder.subjects.pop_u15}

### Label {label}
Children under 15

## Dropdown 2 option: Older people (65+) {decoder.subjects.elderly}

### Label {label}
Older people (65+)

## Dropdown 2 option: Women {decoder.subjects.female_pop}

### Label {label}
Women

## Dropdown 2 option: Women of reproductive age {decoder.subjects.wra_pop}

### Label {label}
Women of reproductive age

## Dropdown 2 option: Everyone {decoder.subjects.total_pop}

### Label {label}
Everyone

## Dropdown 2 option: Dependency ratio {decoder.subjects.dependency}

### Label {label}
Dependency ratio

## Dropdown 2 option: Schools {decoder.subjects.education}

### Label {label}
Schools

### Third dropdown option {measures.count.label}
Number

### Third dropdown option {measures.perc.label}
Share (%)

## Dropdown 2 option: Hospitals {decoder.subjects.hospitals}

### Label {label}
Hospitals

### Third dropdown option {measures.count.label}
Number

### Third dropdown option {measures.perc.label}
Share (%)

## Dropdown 2 option: Primary healthcare {decoder.subjects.primary_healthcare}

### Label {label}
Primary healthcare

### Third dropdown option {measures.count.label}
Number

### Third dropdown option {measures.perc.label}
Share (%)

## Dropdown 2 option: Cropland (km²) {decoder.subjects.crops}

### Label {label}
Cropland (km²)

## Label of the third dropdown {decoder.measureLabel}
Measure

## Where to find it in the dashboard {decoder.dashboardPath}
Indicators tab → Exposure

# Footer boxes {footer.callouts}

## Green box: title {positive.title}
What this indicator tells us

## Green box: list {positive.items}
- where many people live in places that strong cyclone winds have reached
- which districts to look at first, compared with others in the same country
- how the picture changes for different groups and cyclone intensities

## Orange box: title {warning.title}
What this indicator does not tell us

## Orange box: list {warning.items}
- whether or when a cyclone will hit; it is a footprint of 6 past storms (2004–2023), not a forecast
- how often a place is hit: a place hit five times counts the same as a place hit once
- how many people will be harmed or need help
- the effect of building quality, shelters or early warning
- storm surge and heavy rain; the indicator covers wind only
- storms whose track stayed just outside the country, even if their winds reached it
- anything precise about a single village: wind fields are drawn as simple corridors and results are district totals
