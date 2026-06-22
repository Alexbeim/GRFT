import * as React from "react";

export interface LogoWallProps {
  /** {src,alt} for images, or string wordmark fallbacks */
  logos?: Array<{ src?: string; alt?: string } | string>;
  /** Mono section label above the grid */
  label?: React.ReactNode;
  onDark?: boolean;
  columns?: number;
}
export function LogoWall(props: LogoWallProps): JSX.Element;
