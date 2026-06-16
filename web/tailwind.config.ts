import type { Config } from "tailwindcss";

/**
 * YOTOGI / ネットロア — Tailwind config
 *
 * Tailwind v4 reads design tokens primarily from the CSS-first `@theme` block
 * in `src/app/globals.css`. This file mirrors those tokens for editors / tools
 * that still introspect `tailwind.config.ts`, and for explicit documentation.
 *
 * Single source of truth for values: /root/YOTOGI_IMPLEMENTATION_SPEC.md §2
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx,mdx}",
    "./src/components/**/*.{ts,tsx,mdx}",
    "./src/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "red-accent": "#D91C0B",
        "red-on-dark": "#FF614A",

        "sumi-0": "#0B0B0B",
        "sumi-1": "#1C1814",
        "sumi-2": "#5A5448",
        "sumi-3": "#A09890",

        "offwhite-0": "#F5F2EA",
        "offwhite-1": "#FAF6EE",
        "offwhite-2": "#F0EBE5",

        benigara: "#7A3B2E",
        "sand-rule": "#C8BC9E",
        "section-label": "#B8AE9A",
        divider: "#A89E8A",
      },
      fontFamily: {
        sans: [
          "Noto Sans JP",
          "system-ui",
          "-apple-system",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mincho: [
          "Shippori Mincho",
          "Hiragino Mincho ProN",
          "Yu Mincho",
          "Noto Serif JP",
          "serif",
        ],
      },
      borderRadius: {
        chip: "20px",
        card: "4px",
        none: "0px",
      },
    },
  },
  plugins: [],
};

export default config;
