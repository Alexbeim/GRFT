import * as React from "react";

export interface ButtonProps {
  children: React.ReactNode;
  /** primary = yellow fill · secondary = outline · link = text + arrow */
  variant?: "primary" | "secondary" | "link";
  /** Renders an <a> instead of <button> */
  href?: string;
  /** Adjusts secondary/link colours for dark grounds */
  onDark?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

export function Button(props: ButtonProps): JSX.Element;
