
export interface StoryMapConfig {
  meta: Meta;
  app: AppConfig;
  storyMap: StoryMapContent;
  footer: FooterConfig;
  hero: {
    title: string;
    subtitle: string;
    alt: string;
    image: string;
  };
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
  sections: Section[];
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
  title: string;
  description: string;
  equation: { terms: EquationTerm[] };
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
}
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
  figure: Figure;
}
export interface Callout {
  variant: "positive" | "warning";
  icon: string;
  title: string;
  body?: string;
  items?: string[];
}
