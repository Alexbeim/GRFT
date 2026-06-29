import * as React from "react";

export interface StatProps {
  /** The big figure, e.g. "500+" */
  figure: React.ReactNode;
  /** Mono unit label below */
  label: React.ReactNode;
  /** Render the figure in accent yellow */
  accent?: boolean;
  onDark?: boolean;
}
export function Stat(props: StatProps): JSX.Element;

export interface StatRowProps {
  children: React.ReactNode;
  onDark?: boolean;
}
export function StatRow(props: StatRowProps): JSX.Element;
