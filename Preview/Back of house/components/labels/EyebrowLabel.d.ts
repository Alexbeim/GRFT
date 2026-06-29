import * as React from "react";

export interface EyebrowLabelProps {
  children: React.ReactNode;
  /** Yellow on dark (true) · mono-grey on light (false) */
  onDark?: boolean;
  /** Leading glyph before the label */
  lead?: "dot" | "dash" | "none";
}

export function EyebrowLabel(props: EyebrowLabelProps): JSX.Element;
