<!--
  Shared wording for ALL story maps (buttons, chart labels). Text that belongs to one hazard is in that hazard's text.md.

  How to edit:
  - Change the text under a heading. Keep the {…} at the end of each heading as it is: it
    says where on the page the text goes. The words before it are only a description.
  - **bold** and [links](https://…) work.
  - Several paragraphs under one heading → several paragraphs on the page.
    Lines starting with "- " → a list.
  - Words in {curly braces} inside a text (e.g. {n}) are filled in by the page; keep them.
  - Map layers, data files, colours and numbers are in config.json, not here.
-->

# Header button {storyMap.backLink}

## Label {label}
Back to Dashboard

# Shared wording {ui}

## Sidebar link back to the story map overview {back}
Back

## Header: question above the cards {anatomy.question}
What does “{sentence}” mean?

## Header: link on each card {anatomy.seeStep}
See step →

## Maps: opacity slider {map.opacity}
Opacity

## Maps: legend, low end {legend.low}
Low

## Maps: legend, high end {legend.high}
High

## Step 4 graphic: second panel {aggregation.borders}
District borders laid over

## Step 4 graphic: district names {aggregation.district}
District {id}

## Step 4 graphic: hint under the totals (people) {aggregation.raster.hoverHint}
Hover a district to see its cells. This total is the number the dashboard shows for the district.

## Step 4 graphic: hint under the totals (facilities) {aggregation.points.hoverHint}
Hover a district to see its facilities. This total is the number the dashboard shows for the district.

## Step 5 chart: right axis {scoreScale.score}
score

## Step 5 chart: group size {scoreScale.districts}
{n} districts

## Step 5 chart: default unit {scoreScale.unit}
Count

## Step 5 chart: caption {scoreScale.caption}
{unit}, one bar per district, sorted. The colour groups are split at the quartiles, so each holds about a quarter of the districts; districts with the same value stay in the same group. Hover a bar to see the district.

## Step 5 chart: colour groups {scoreScale.classes}

### Lowest {low}
Low

### Second {moderate}
Moderate

### Third {high}
High

### Highest {veryHigh}
Very high

## Step 6 decoder: column name {decoder.inData}
In the data

## Step 6 decoder: dashboard place {decoder.inDashboard}
In the dashboard

## Step 6 decoder: default dashboard place {decoder.dashboardPath}
Indicators tab

## Step 6 decoder: default third dropdown {decoder.measure}
Measure

## Step 6 decoder: unknown column {decoder.noDescription}
No description available for this combination.
