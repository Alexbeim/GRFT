import * as React from "react";

export interface SetupDiagramConfig {
  unit: "m" | "ft";
  widthM: number;
  heightM: number;
  floorM: number;
  wStr: string;
  hStr: string;
  fStr: string;
  /** LED pixel pitch in millimetres — drives the auto-calculated resolution. */
  pitchMm: number;
  pitchStr: string;
  lighthouses: number;
  homeTracker: boolean;
  transmitters: number;
  txPos: "top" | "bottom";
  lhPos: "floor" | "top";
  pcLoc: "left" | "right" | "behind";
  prLoc: "left" | "right" | "behind";
  overrides: Record<string, { x: number; y: number }>;
}

export interface SetupDiagramProps {
  /** Stable id for this event/activation. Used as the localStorage persistence key. */
  eventId?: string;
  /** Human-readable name shown in the header instead of a slugified eventId. */
  eventName?: string;
  /** Show the controls panel and allow dragging sensors. Default true. */
  editable?: boolean;
  /** Hide the legend + cable-run list. Default false. */
  compact?: boolean;
  /** Show the title/unit-toggle/export toolbar. Default true. */
  showHeader?: boolean;
  /** Partial config to seed state with (e.g. loaded from your own backend). */
  initialConfig?: Partial<SetupDiagramConfig>;
  /** Fired with the full config on every change — use this to persist to your own store. */
  onChange?: (config: SetupDiagramConfig) => void;
  /** Mirror config to localStorage under `gp-setup-<eventId>`. Default true. */
  persist?: boolean;
}

export function SetupDiagram(props: SetupDiagramProps): JSX.Element;
export default SetupDiagram;
