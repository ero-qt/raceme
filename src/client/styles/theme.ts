/** Lists the colors raceme uses, all as `#rrggbb` so contrast can be tested. */
export interface Theme {
  /** Page background. */
  bg0: string;
  /** Panels and tables. */
  bg1: string;
  /** Table headers and raised rows. */
  bg2: string;
  /** Hovered rows and buttons. */
  bgHover: string;
  /** Decorative divider between rows. */
  border: string;
  /** Outline of inputs and ghost buttons. */
  borderStrong: string;
  /** Primary text. */
  text0: string;
  /** Secondary text. */
  text1: string;
  /** Placeholder text in inputs, dimmer than typed text. */
  placeholder: string;
  /** Link text, which needs text contrast on the page itself. */
  link: string;
  /** Primary button surface. */
  accent: string;
  /** Text on `accent`. */
  accentFg: string;
  /** Keyboard focus ring. */
  focus: string;
  /** Surface of the button that moves the race on, like `.ready`. */
  go: string;
  /** Text on `go`. */
  goFg: string;
  /** Destructive button surface. */
  danger: string;
  /** Text on `danger`. */
  dangerFg: string;
  statusOpen: string;
  statusCountdown: string;
  statusRunning: string;
  statusDone: string;
  statusForfeit: string;
}

export const themeContract: Record<keyof Theme, null> = {
  bg0: null,
  bg1: null,
  bg2: null,
  bgHover: null,
  border: null,
  borderStrong: null,
  text0: null,
  text1: null,
  placeholder: null,
  link: null,
  accent: null,
  accentFg: null,
  focus: null,
  go: null,
  goFg: null,
  danger: null,
  dangerFg: null,
  statusOpen: null,
  statusCountdown: null,
  statusRunning: null,
  statusDone: null,
  statusForfeit: null,
};
