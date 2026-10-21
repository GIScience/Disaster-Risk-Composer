
export interface StoryMapConfig {
  meta: Meta;
  app?: AppConfig;
  storyMap: StoryMapContent;
  footer: FooterConfig;
  /** Wording used inside the components (from the `ui` part of the text.md files). */
  ui?: Record<string, unknown>;
}

export interface Meta {
  id: string;
  type: string;
  version: number;
  category: string;
  locale: string;
  updatedAt: string;
  notes?: string;
}

export interface AppConfig {
  brand: { name: string; tagline: string };
  nav: { items: NavItem[]; context: CountrySelector };
}
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  active?: boolean;
}
export interface CountrySelector {
  type: string;
  icon: string;
  value: string;
  label: string;
}

export interface StoryMapContent {
  hero: HeroConfig;
  backLink: LinkRef;
  sidebar: Sidebar;
  header: Header;
  /** Optional: one real dashboard indicator taken apart, shown at the top of the page. */
  anatomy?: Anatomy;
  sections: Section[];
}

/**
 * An example indicator sentence split into parts. Parts with a `role` are shown as chips that
 * jump to the step explaining them (`sectionRef`); plain parts are connecting words.
 */
export interface Anatomy {
  intro?: string;
  parts: {
    /** Identifies the part in text.md (parts without a sectionRef). */
    key?: string;
    text: string;
    role?: string;
    sectionRef?: string;
    /** One-line explanation shown on the part's card, e.g. "2% chance in any given year". */
    hint?: string;
    icon?: string;
  }[];
  /** The indicator's column name, as found in the dashboard data and downloads. */
  column?: string;
  outro?: string;
}

/**
 * Interactive "decode any indicator of this group" block. Each subject has a column-name
 * pattern with {scenario} and optionally {measure} placeholders; the resulting column is
 * explained with the same describeIndicator() the dashboard uses for its tooltips.
 */
export interface IndicatorDecoder {
  scenarioLabel: string;
  scenarios: { value: string; label: string; selected?: boolean }[];
  subjectLabel: string;
  subjects: {
    value: string;
    label: string;
    pattern: string;
    measures?: { value: string; label: string }[];
    selected?: boolean;
  }[];
  measureLabel?: string;
  /** Where the indicator appears in the dashboard, e.g. "Indicators tab → Exposure". */
  dashboardPath?: string;
}
export interface HeroConfig {
  image: string;
  alt: string;
  title: string;
  subtitle: string;
}
export interface LinkRef {
  label: string;
  href: string;
  external?: boolean;
}

export interface Sidebar {
  icon: string;
  title: string;
  subtitle: string;
  steps: SidebarStep[];
  aside: Aside;
}
export interface SidebarStep {
  number: number;
  sectionRef: string;
  title: string;
  body: string;
}
export interface Aside {
  variant: string;
  icon: string;
  title: string;
  body: string;
}

export interface Header {
  /** Shown only when the story map has no `anatomy` question. */
  title?: string;
  description: string;
  equation?: { terms: EquationTerm[] };
}
export type EquationTerm =
  | {
      kind: "operand" | "result";
      image?: string;
      icon?: string;
      alt?: string;
      label: string;
      sublabel: string | null;
    }
  | { kind: "operator"; symbol: string };

export interface Section {
  id: string;
  number: number;
  title: string;
  subtitle?: string;
  hasInfoIcon?: boolean;
  icon?: string;
  control?: Control;
  // Secondary segmented control driving a base/underlay map layer rendered
  // beneath `control`'s layer (e.g. flood extent under population/facilities).
  baseControl?: Control;
  // Compact equation strip combining baseControl's and control's active
  // selections (e.g. "Flood Extent (50-years) + Facilities"). The base term's
  // label/icon are static content here; the operand for `control` and the
  // base term's sublabel are filled in dynamically from the active selection.
  equation?: {
    baseLabel: string;
    baseIcon: string;
    operator?: string;
  };
  note?: Note;
  figure?: Figure;
  dataset?: Dataset;
  legend?: Legend;
  map?: MapConfig;
  /** Optional blocks, rendered below the note in this order. */
  flow?: EquationTerm[];
  callouts?: Callout[];
  decoder?: IndicatorDecoder;
  links?: (LinkRef & { icon?: string })[];
  /**
   * Built-in interactive visual: "depth-profile" (flood cross-section with threshold, shown on
   * the right) or "aggregation" (grid cells → district totals, shown full width below the row).
   */
  visual?: "depth-profile" | "wind-profile" | "aggregation" | "score-scale";
  /** Data for the "score-scale" visual: [{ name, value }] per district. */
  visualValuesUrl?: string;
  visualUnitLabel?: string;
  /** Hazard wording of the "aggregation" visual (default "flood"). */
  visualHazard?: "flood" | "cyclone";
  /** Small explanatory graphic in the text column, below the note. */
  explainer?: { type: "category-overlap"; caption?: string };
}

export interface layerConfigType {
  type?: "raster" | "vector" | "choropleth";
  layerId: string;
  colorScheme?: string;
  mode?: "rgb" | "ramp" | "categorical";
  sourceUrl?: string;
  categoryProperty?: string;
  categories?: VectorCategoryStyle[];
  sourceLayer?: string;
  pcodeField?: string;
  valuesUrl?: string;
  stops?: ChoroplethStop[];
  unit?: string;
  /** Raster value range of the colour ramp (default 0-1), e.g. 0-100 for depth in cm. */
  min?: number;
  max?: number;
  /**
   * Zone rasters with one value (e.g. 1 = inside a wind zone): show one solid swatch with this
   * label in the map legend instead of a Low-High gradient.
   */
  legendSwatch?: { value: number; label?: string };
  /** Name of this layer in a stacked map's legend, if it differs from the option label. */
  legendLabel?: string;
}

export interface VectorCategoryStyle {
  value: string;
  label: string;
  icon: string;
  color?: string;
}

export interface ChoroplethStop {
  max: number;
  color: string;
}

export type Control = SegmentedControl | SliderControl;
export interface SegmentedControl {
  type: "segmented";
  id: string;
  variant?: "cards";
  options: SegmentedOption[];
}
export interface SegmentedOption {
  value: string;
  label: string;
  icon?: string;
  selected?: boolean;
  layerConfig?: layerConfigType;
  note?: Note;
  figure?: Figure;
  /** Optional key figure shown large next to the control, e.g. { value: "2%", label: "chance each year" }. */
  stat?: { value: string; label: string };
  /** Per-option overrides of the section's legend and the map's results box. */
  legend?: Legend;
  results?: Results;
  /** Data type shown by the "aggregation" visual: raster cells (default) or vector points. */
  dataKind?: "raster" | "points";
}
export interface SliderControl {
  type: "slider";
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  ticks: SliderTick[];
}
export interface SliderTick {
  value: number;
  label: string;
  selected?: boolean;
}

export interface Note {
  variant: "info" | "warning";
  icon: string;
  body: string | string[];
}

export interface Figure {
  source: string;
  alt: string;
}
export interface Dataset {
  icon: string;
  title: string;
  source: string;
  /**
   * Address of the source. Shown as a link only while it works (checked in the browser, see
   * useLinkCheck); otherwise the source stays plain text.
   */
  url?: string;
  /**
   * `false`: show the link without checking it. Only for sites that can't be checked from the
   * browser (e.g. JRC: no CORS, and bot protection answers "OK" even for missing pages).
   */
  checkUrl?: boolean;
}

export interface Legend {
  title: string;
  type: "categorical" | "graduated";
  items: LegendItem[];
}
export interface LegendItem {
  color: string;
  label: string;
  excluded?: boolean;
}

export interface MapConfig {
  layerId: string;
  // Fixed layer to render when the section has no `control` to select one from.
  layerConfig?: layerConfigType;
  caption?: { icon?: string; label: string; sublabel?: string };
  legend?: Legend;
  center?: [number, number];
  zoom?: number;
  controls?: string[];
  results?: Results;
  showOpacityControl?: boolean;
  /**
   * Show the raster layers of all `control` options on the map at once: the selected option is
   * highlighted, the others are faded (e.g. all cyclone categories in one map).
   */
  stackOptions?: boolean;
  /** Same for the `baseControl` options: all base layers shown, the selected one highlighted. */
  stackBaseOptions?: boolean;
  /** Legend title (and optional subtitle) of the stacked layers. */
  stackLegend?: { title: string; subtitle?: string };
}

/** One layer of a stacked map (see MapConfig.stackOptions). */
export type StackLayer = layerConfigType & { label: string; active: boolean };
export interface Results {
  title: string;
  unit: string;
  rows: ResultRow[];
  link?: LinkRef;
}
export interface ResultRow {
  name: string;
  value: number;
}

export interface FooterConfig {
  callouts: Callout[];
  figure?: Figure;
}
export interface Callout {
  variant: "positive" | "warning";
  icon: string;
  title: string;
  body?: string;
  items?: string[];
}
