const hexColor = /^#[0-9a-f]{6}$/i;

/** Computes the WCAG 2 contrast ratio between 2 `#rrggbb` colors, from 1 to 21. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function relativeLuminance(color: string): number {
  if (!hexColor.test(color)) {
    throw new Error(`Expected a '#rrggbb' color, got '${color}'.`);
  }
  const [r, g, b] = [1, 3, 5].map((start) => linearize(color.slice(start, start + 2)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

// Threshold and curve are the sRGB transfer function as WCAG 2 states it.
function linearize(channelHex: string): number {
  const channel = Number.parseInt(channelHex, 16) / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}
