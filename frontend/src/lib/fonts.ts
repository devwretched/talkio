import { IBM_Plex_Mono, Instrument_Serif, Manrope } from "next/font/google";

/** DISPLAY — confident geometric headlines. Softer than condensed poster
 * type; keeps the authority without the terminal-poster edge. */
export const fontDisplay = Manrope({
  weight: ["500", "700", "800"],
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

/** EDITORIAL — sophisticated serif for intros, quotes and long-form research. */
export const fontEditorial = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

/** TECHNICAL — mono for metadata, timestamps, IDs and interface annotations. */
export const fontTechnical = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
});
