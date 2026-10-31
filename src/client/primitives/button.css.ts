import { keyframes, style, styleVariants } from "@vanilla-extract/css";
import { controlBorder, dimWhenDisabled, outlined } from "../styles/controls.css.ts";
import { tokens } from "../styles/tokens.css.ts";

const base = style([
  controlBorder,
  dimWhenDisabled,
  {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space.s,
    minBlockSize: tokens.target.min,
    minInlineSize: tokens.target.min,
    paddingInline: tokens.space.s,
    font: "inherit",
    fontFamily: tokens.font.mono,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background-color 120ms ease",
  },
]);

export const buttonVariant = styleVariants({
  accent: [
    base,
    {
      background: tokens.color.accent,
      color: tokens.color.accentFg,
      selectors: {
        "&:hover:not(:disabled)": {
          // Lightens instead of darkening because orange mixed toward its dark text drops below
          // 4.5:1 contrast.
          background: `color-mix(in srgb, ${tokens.color.accent} 75%, white)`,
        },
      },
    },
  ],
  ghost: [
    base,
    outlined,
    {
      background: "transparent",
      color: tokens.color.text0,
      selectors: {
        "&:hover:not(:disabled)": { background: tokens.color.bgHover },
      },
    },
  ],
  go: [
    base,
    {
      background: tokens.color.go,
      color: tokens.color.goFg,
      selectors: {
        "&:hover:not(:disabled)": {
          background: `color-mix(in srgb, ${tokens.color.go} 85%, ${tokens.color.goFg})`,
        },
      },
    },
  ],
  icon: [
    base,
    outlined,
    {
      paddingInline: 0,
      background: "transparent",
      color: tokens.color.text0,
      selectors: {
        "&:hover:not(:disabled)": { background: tokens.color.bgHover },
      },
    },
  ],
  // Square icon button without a border, for small controls inside tables and headings.
  plain: [
    base,
    {
      inlineSize: tokens.target.min,
      paddingInline: 0,
      background: "transparent",
      color: tokens.color.text1,
      selectors: {
        "&:hover:not(:disabled)": { background: tokens.color.bgHover, color: tokens.color.text0 },
      },
    },
  ],
  danger: [
    base,
    {
      background: tokens.color.danger,
      color: tokens.color.dangerFg,
      selectors: {
        "&:hover:not(:disabled)": {
          background: `color-mix(in srgb, ${tokens.color.danger} 85%, ${tokens.color.dangerFg})`,
        },
      },
    },
  ],
});

// The ring stands in for the label while the button is locked. The label fades to nothing
// instead of going hidden, so its text stays the button's name for screen readers. With motion
// reduced the ring doesn't show, so the label stays.
export const label = style({
  display: "flex",
  alignItems: "center",
  gap: tokens.space.s,
  "@media": {
    "(prefers-reduced-motion: no-preference)": {
      selectors: { "&[data-locked=true]": { opacity: 0 } },
    },
  },
});

const drain = keyframes({ from: { strokeDashoffset: 0 }, to: { strokeDashoffset: 1 } });

export const lockRing = style({
  position: "absolute",
  inset: 0,
  margin: "auto",
  inlineSize: "1.25em",
  blockSize: "1.25em",
  transform: "rotate(-90deg)",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeDasharray: 1,
  animationName: drain,
  animationTimingFunction: "linear",
  animationFillMode: "forwards",
  "@media": { "(prefers-reduced-motion: reduce)": { display: "none" } },
});
