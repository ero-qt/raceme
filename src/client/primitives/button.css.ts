import { style, styleVariants } from "@vanilla-extract/css";
import { controlBorder, dimWhenDisabled, outlined } from "../styles/controls.css.ts";
import { tokens } from "../styles/tokens.css.ts";

const base = style([
  controlBorder,
  dimWhenDisabled,
  {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space.s,
    minBlockSize: tokens.target.min,
    minInlineSize: tokens.target.min,
    paddingInline: tokens.space.l,
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
          // 7:1 contrast.
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
