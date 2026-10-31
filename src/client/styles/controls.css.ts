import { globalStyle, style } from "@vanilla-extract/css";
import { tokens } from "./tokens.css.ts";

/** Gives every control the same border box, invisible until a style below colors it. */
export const controlBorder = style({
  border: "2px solid transparent",
  borderRadius: tokens.radius.s,
});

/** Colors the border of every outlined control the same: neutral buttons, text fields, selects. */
export const outlined = style([controlBorder, { borderColor: tokens.color.borderStrong }]);

/** Turns any disabled control see-through the same way, buttons and fields alike. */
export const dimWhenDisabled = style({
  selectors: { "&:disabled": { cursor: "not-allowed", opacity: tokens.dim.opacity } },
});

/** Fades content that isn't live yet with the same look as a disabled control. */
export const dimmed = style({ opacity: tokens.dim.opacity });

/** Makes a text field or select that reads as plain text until an underline shows on hover or focus. */
export const inlineEdit = style([
  controlBorder,
  {
    borderRadius: 0,
    // The text starts where the underline starts, on the edge the rest of the column sits on.
    borderInlineStartWidth: 0,
    paddingInlineStart: 0,
    font: "inherit",
    color: "inherit",
    background: "transparent",
    transition: "border-color 150ms ease",
    selectors: {
      "&:hover, &:focus-visible, &:has(:focus-visible)": {
        borderBlockEndColor: tokens.color.borderStrong,
        outline: "none",
      },
    },
  },
]);

/** Makes a `<summary>` look like the outlined control it is, for every disclosure on the page. */
export const disclosureSummary = style([
  outlined,
  {
    display: "flex",
    alignItems: "center",
    minBlockSize: tokens.target.min,
    paddingInline: tokens.space.m,
    fontSize: "0.875rem",
    cursor: "pointer",
    color: tokens.color.text0,
    background: tokens.color.bg1,
  },
]);

/** Frames a box of content like the chat log, the suggestion list or a warning card. */
export const panel = style({
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.s,
  boxShadow: tokens.overlay.shadow,
});

/** Marks a panel as a warning with a red edge, like the idle card and the closed-room note. */
export const warningPanel = style([
  panel,
  { background: tokens.color.bg2, borderInlineStart: `3px solid ${tokens.color.danger}` },
]);

/** Draws the thin line between table rows and page sections. */
export const divider = style({ borderBlockStart: `1px solid ${tokens.color.border}` });

/** Makes a number field look editable, with its up and down arrows always showing. */
export const numberField = style([
  outlined,
  {
    minBlockSize: tokens.target.min,
    inlineSize: "calc(3ch + 3rem)",
    paddingInline: tokens.space.s,
    font: "inherit",
    color: tokens.color.text0,
    background: tokens.color.bg1,
  },
]);

// Chromium and Safari only show a number field's arrows on hover by default.
globalStyle(
  `${numberField}::-webkit-inner-spin-button, ${numberField}::-webkit-outer-spin-button`,
  {
    opacity: 1,
  },
);

/** Keeps text in the page for screen readers while nothing shows on screen. */
export const visuallyHidden = style({
  position: "absolute",
  inlineSize: "1px",
  blockSize: "1px",
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
});

/** Sizes an icon beside text or in a button, the same on every page. */
export const icon = style({ flex: "none", inlineSize: "1.25em", blockSize: "1.25em" });

/** Draws the warning sign beside a notice, centered on its first line. */
export const warningIcon = style({
  flex: "none",
  inlineSize: "1.1em",
  blockSize: "1.1em",
  color: tokens.color.danger,
  // Centers the icon on the first line of text, since the body line height is 1.5.
  marginBlockStart: "0.2em",
});

/** Colors a line that reports a refusal or a warning red, on every page. */
export const notice = style({
  margin: 0,
  color: tokens.color.statusForfeit,
});
