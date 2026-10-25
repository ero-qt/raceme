import { style } from "@vanilla-extract/css";
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
  selectors: { "&:disabled": { cursor: "not-allowed", opacity: 0.5 } },
});

/** Makes a text field or select that reads as plain text until hovered or focused. */
export const inlineEdit = style([
  controlBorder,
  {
    font: "inherit",
    color: "inherit",
    background: "transparent",
    transition: "border-color 150ms ease, background-color 150ms ease",
    selectors: {
      "&:hover, &:focus-visible, &:has(:focus-visible)": {
        borderColor: tokens.color.borderStrong,
        background: tokens.color.bg1,
        outline: "none",
      },
    },
  },
]);

/** Frames a box of content like the chat log, the suggestion list or a warning card. */
export const panel = style({
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.s,
});

/** Marks a panel as a warning with a red edge, like the idle card and the closed-room note. */
export const warningPanel = style([
  panel,
  { background: tokens.color.bg2, borderInlineStart: `3px solid ${tokens.color.danger}` },
]);

/** Draws the thin line between table rows and page sections. */
export const divider = style({ borderBlockStart: `1px solid ${tokens.color.border}` });
