import * as React from "react";

export interface AudienceCardProps {
  /** Bold display label */
  label: React.ReactNode;
  /** One-line value prop */
  value: React.ReactNode;
  onDark?: boolean;
}
export function AudienceCard(props: AudienceCardProps): JSX.Element;

export interface NumberedStepProps {
  /** "01"–"04" */
  number: React.ReactNode;
  title: React.ReactNode;
  /** Muted second title line */
  second?: React.ReactNode;
  body: React.ReactNode;
  onDark?: boolean;
}
export function NumberedStep(props: NumberedStepProps): JSX.Element;
