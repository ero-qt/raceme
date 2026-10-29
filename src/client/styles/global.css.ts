import { assignVars, globalStyle } from "@vanilla-extract/css";
import { palette } from "./palette.ts";
import { tokens } from "./tokens.css.ts";

// Measured against the palette's text and page colors: 0.5 keeps faded text at 5.3:1.
const dim = { opacity: "0.5" };

const scale = {
  space: { xs: "0.25rem", s: "0.5rem", m: "0.75rem", l: "1rem", xl: "1.5rem" },
  // The repeated generic family keeps the normal font size, because browsers shrink a lone
  // `monospace` to 13px.
  font: { body: "monospace, monospace", mono: "monospace, monospace" },
  radius: { s: "0.2rem" },
  target: { min: "32px" },
  overlay: { scrim: "rgb(0 0 0 / 0.45)", shadow: "0 4px 16px rgb(0 0 0 / 0.4)" },
};

globalStyle(":root", {
  // Keeps native controls like select popups and scrollbars dark too.
  colorScheme: "dark",
  vars: assignVars(tokens, { ...scale, color: palette, dim }),
});

globalStyle("*, *::before, *::after", { boxSizing: "border-box" });

globalStyle("body", {
  margin: 0,
  background: tokens.color.bg0,
  color: tokens.color.text0,
  fontFamily: tokens.font.body,
  fontSize: "0.9375rem",
  lineHeight: 1.5,
});

// Lets the footer push itself to the foot of the window on short pages.
globalStyle("#app", { display: "flex", flexDirection: "column", minBlockSize: "100dvh" });

// Keeps a page at the window's width, because a flex item with auto side margins would take its
// content's width instead, and lets it fill the page down to the footer.
globalStyle("#app > main", { flex: "1 0 auto", inlineSize: "100%" });

globalStyle("a", { color: tokens.color.link });

globalStyle(":focus-visible", {
  outline: `3px solid ${tokens.color.focus}`,
  outlineOffset: "2px",
});

globalStyle("*", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      animationDuration: "0.01ms !important",
      transitionDuration: "0.01ms !important",
    },
  },
});

// Browsers fade placeholders below the 4.5:1 contrast WCAG AA asks for.
globalStyle("::placeholder", {
  color: tokens.color.placeholder,
  fontStyle: "italic",
  opacity: 1,
});
