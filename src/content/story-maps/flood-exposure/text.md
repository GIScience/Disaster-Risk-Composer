<!--
  Flood exposure story map: every text shown on the page, in page order.

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
Flooded settlement

## Title {title}
River Flood Exposure Story Map

## Subtitle {subtitle}
What does “children under 5 exposed to a 1-in-50-year river flood above 30 cm” actually mean? This page takes one dashboard indicator apart, step by step.

# Sidebar {storyMap.sidebar}

## Title {title}
River Flood Exposure Story Map

## Subtitle {subtitle}
Understand how river flood exposure indicators are produced and what they mean.

## Sidebar step: Choose a flood scenario {steps.sec-flood}

### Title {title}
Choose a flood scenario

### Text {body}
Flood scenarios and their chance each year.

## Sidebar step: Apply the flood-depth threshold {steps.sec-depth}

### Title {title}
Apply the flood-depth threshold

### Text {body}
Only water deeper than **30 cm** counts.

## Sidebar step: Overlay people or facilities {steps.sec-who}

### Title {title}
Overlay people or facilities

### Text {body}
Who or what is in the flooded area.

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
Exposure shows who could be affected in a modelled river flood, not who will be affected or who needs help. Example: Myanmar.

# Header {storyMap.header}

## Description {description}
It estimates how many children under 5 live in areas that could be flooded with more than 30 cm of water during a river flood with a 2% chance of happening in any given year. Only river floods are covered, not flash floods from heavy rain, coastal floods or storm surge. Exposure is one of three parts of risk, next to vulnerability and lack of coping capacity.

# Header question and cards {storyMap.anatomy}

## Question part: children under 5 {parts.sec-who}

### Words in the question {text}
children under 5

### Hint {hint}
One population group; others work the same way.

## Question part: exposed to a {parts.exposed-to-a}

### Words in the question {text}
exposed to a

## Question part: 1-in-50-year flood {parts.sec-flood}

### Words in the question {text}
1-in-50-year river flood

### Hint {hint}
A river flood with a 2% chance in any given year.

## Question part: deeper than {parts.deeper-than}

### Words in the question {text}
deeper than

## Question part: 30 cm {parts.sec-depth}

### Words in the question {text}
30 cm

### Hint {hint}
Shallower water doesn't count.

## Question part: , counted {parts.counted}

### Words in the question {text}
, counted

## Question part: per district {parts.sec-count}

### Words in the question {text}
per district

### Hint {hint}
All exposed children in a district added up.

# Step 1: Choose a flood scenario {storyMap.sections.sec-flood}

## Title {title}
Choose a flood scenario

## Subtitle {subtitle}
River floods are described by how likely they are. Switch the scenario to see how far the water reaches.

## Button: 1-in-10 {control.options.10}

### Label {label}
1-in-10

### Key figure {stat.value}
10%

### Key figure text {stat.label}
chance of this flood in any given year. A frequent, smaller flood.

## Button: 1-in-50 {control.options.50}

### Label {label}
1-in-50

### Key figure {stat.value}
2%

### Key figure text {stat.label}
chance in any given year. This is the flood in our example.

## Button: 1-in-100 {control.options.100}

### Label {label}
1-in-100

### Key figure {stat.value}
1%

### Key figure text {stat.label}
chance in any given year.

## Button: 1-in-500 {control.options.500}

### Label {label}
1-in-500

### Key figure {stat.value}
0.2%

### Key figure text {stat.label}
chance in any given year. Rare, but very large.

## Dataset {dataset.title}
Modelled river floods

## Dataset source {dataset.source}
JRC Global River Flood Hazard Maps

## Info box {note.body}
The maps show **river floods only**: rivers overflowing their banks. Flash floods from heavy local rain, coastal floods and storm surge are not included.

Bigger, rarer floods reach further. The dashboard has indicators for all four scenarios.

# Step 2: Apply the flood-depth threshold {storyMap.sections.sec-depth}

## Title {title}
Apply the flood-depth threshold

## Info box {note.body}
Only places where the water is **deeper than 30 cm** count as exposed.

At that depth, water can knock people off their feet, stop vehicles and enter the ground floor of most homes. Set the flood depth to see what it means for different people.

## Subtitle {subtitle}
Not every wet place is dangerous. A depth threshold splits the flooded area into two parts: places that are considered in the indicator, and places that are left out.

# Step 2 graphic: people in the water {ui.depth}

## Line above the graphic {waterDepth}
Water depth

## Badge: above the threshold {counts}
Counts as exposed

## Badge: below the threshold {notCounted}
Not counted (below {threshold} cm)

## Label under the threshold value {threshold}
threshold

## People {people}

### Child {child}
Child

### Adult {adult}
Adult

### Older person {senior}
Older person

## Slider label {setDepth}
Set the flood depth

# Step 3: Overlay people or facilities {storyMap.sections.sec-who}

## Title {title}
Overlay people or facilities

## Subtitle {subtitle}
Choose a group, then a flood scenario.

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

## Second row button: 1-in-10 {baseControl.options.10}

### Label {label}
1-in-10

## Second row button: 1-in-50 {baseControl.options.50}

### Label {label}
1-in-50

## Second row button: 1-in-100 {baseControl.options.100}

### Label {label}
1-in-100

## Second row button: 1-in-500 {baseControl.options.500}

### Label {label}
1-in-500

## Info box {note.body}
We lay a population map over the flood map. Everyone living in a flooded grid cell (about 100 × 100 m) counts as exposed.

The population maps are projections for **2030** (WorldPop). “Facilities” are schools, hospitals and health centres from OpenStreetMap.

# Step 4: Aggregate to districts {storyMap.sections.sec-count}

## Title {title}
Aggregate to districts

## Subtitle {subtitle}
1-in-50-year river flood. Choose what to count.

## Info box {note.body}
We add up all exposed children in the grid cells inside each district (see below). That gives one number per district: the value you see in the dashboard.

In Myanmar, about **980,000 children under 5** would be exposed in this scenario, roughly **1 in 4**.

## Button: Children under 5 {control.options.children_u5}

### Label {label}
Children under 5

### Legend title {legend.title}
Exposed children under 5

### Legend entry 1 {legend.items.0.label}
Up to 1,700

### Legend entry 2 {legend.items.1.label}
1,700–5,500

### Legend entry 3 {legend.items.2.label}
5,500–12,500

### Legend entry 4 {legend.items.3.label}
More than 12,500

### Results box title {results.title}
Example results (ADM2)

### Results box unit {results.unit}
children under 5 exposed

### Results box link {results.link.label}
View in dashboard

### Info box {note.body}
We add up all exposed children in the grid cells inside each district (see below). That gives one number per district: the value you see in the dashboard.

In Myanmar, about **980,000 children under 5** would be exposed in this scenario, roughly **1 in 4**.

## Button: Facilities {control.options.facilities}

### Label {label}
Facilities

### Legend title {legend.title}
Exposed facilities

### Legend entry 1 {legend.items.0.label}
None

### Legend entry 2 {legend.items.1.label}
1–3

### Legend entry 3 {legend.items.2.label}
4–11

### Legend entry 4 {legend.items.3.label}
More than 11

### Results box title {results.title}
Example results (ADM2)

### Results box unit {results.unit}
facilities exposed

### Results box link {results.link.label}
View in dashboard

### Info box {note.body}
Schools, hospitals and health centres come from OpenStreetMap as **points**, not as a grid. A facility counts as exposed if it lies where the water is deeper than 30 cm.

We count the flooded facilities in each district. In Myanmar, about **1,040 facilities** would be in the water in this scenario.

# Step 4 graphic {ui.aggregation}

## People: first panel title {raster.caption}
Children per grid cell, flood deeper than 30 cm in blue

## People: note under the first panel {raster.note}
Raster data (WorldPop): every ~100 m cell holds a number. A cell counts if the water there is deeper than 30 cm.

## People: totals title {raster.totals}
Flooded cells added up per district

## Facilities: first panel title {points.caption}
Facilities as points, flood deeper than 30 cm in blue

## Facilities: note under the first panel {points.note}
Vector data (OpenStreetMap): each facility is a point. Red = inside water deeper than 30 cm.

## Facilities: totals title {points.totals}
Exposed facilities counted per district

## Key under the graphic: blue line {key.area}
deeper than 30 cm

## Key under the graphic: pale blue {key.other}
shallower

# Step 5: From count to colour {storyMap.sections.sec-score}

## Title {title}
From count to colour

## Info box {note.body}
**Score:** each district gets a value from **0 to 1** within the country: 0 for the lowest district, 1 for the highest. The dashboard averages these scores over all active indicators, using your weights.

**Colour:** the districts are split into four equal groups (quartiles), so each colour always holds a quarter of them. That's why colours rank districts **within one country** and can't be compared between countries.

## Button: Open in the dashboard {links.open-in-the-dashboard}

### Label {label}
Open in the dashboard

## Subtitle {subtitle}
The dashboard doesn't map raw counts. It turns them into scores, and the scores into four colours.

## Chart unit {visualUnitLabel}
exposed children under 5 (Myanmar districts)

# Step 6: Decode any flood exposure indicator {storyMap.sections.sec-decoder}

## Title {title}
Decode any flood exposure indicator

## Subtitle {subtitle}
Every flood exposure indicator in the dashboard follows the same pattern.

## Label of the first dropdown {decoder.scenarioLabel}
Flood

## Dropdown 1 option: 1-in-10-year {decoder.scenarios.RP10}

### Label {label}
1-in-10-year

## Dropdown 1 option: 1-in-50-year {decoder.scenarios.RP50}

### Label {label}
1-in-50-year

## Dropdown 1 option: 1-in-100-year {decoder.scenarios.RP100}

### Label {label}
1-in-100-year

## Dropdown 1 option: 1-in-500-year {decoder.scenarios.RP500}

### Label {label}
1-in-500-year

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

## Dropdown 2 option: Dependency ratio {decoder.subjects.dependency}

### Label {label}
Dependency ratio

## Dropdown 2 option: Schools {decoder.subjects.education}

### Label {label}
Schools

### Third dropdown option {measures.count.label}
Number

### Third dropdown option {measures.pct.label}
Share (%)

## Dropdown 2 option: Hospitals {decoder.subjects.hospitals}

### Label {label}
Hospitals

### Third dropdown option {measures.count.label}
Number

### Third dropdown option {measures.pct.label}
Share (%)

## Dropdown 2 option: Primary healthcare {decoder.subjects.primary_healthcare}

### Label {label}
Primary healthcare

### Third dropdown option {measures.count.label}
Number

### Third dropdown option {measures.pct.label}
Share (%)

## Dropdown 2 option: Cropland {decoder.subjects.crops}

### Label {label}
Cropland

### Third dropdown option {measures.km2.label}
Area (km²)

### Third dropdown option {measures.croppct.label}
% of cropland

### Third dropdown option {measures.areapct.label}
% of district area

## Label of the third dropdown {decoder.measureLabel}
Measure

## Where to find it in the dashboard {decoder.dashboardPath}
Indicators tab → Exposure

# Footer boxes {footer.callouts}

## Green box: title {positive.title}
What this indicator tells us

## Green box: list {positive.items}
- where many people could be in harm's way in a given flood scenario
- which districts to look at first, compared with others in the same country
- how the picture changes for different groups and flood sizes

## Orange box: title {warning.title}
What this indicator does not tell us

## Orange box: list {warning.items}
- whether or when a flood will happen; it is not a forecast
- how many people will be harmed or need help
- the effect of local protection, building quality or early warning
- flash floods from heavy local rain, coastal floods or storm surge; the maps cover river floods only
- anything precise about a single village: results are district totals from models
