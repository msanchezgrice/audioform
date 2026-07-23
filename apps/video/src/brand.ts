import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";

export const { fontFamily: displayFont } = loadFraunces("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

export const { fontFamily: bodyFont } = loadOutfit("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const colors = {
  bg: "#fdfcfa",
  warm: "#f7f4ee",
  cream: "#f0ece3",
  surface: "#ffffff",
  ink: "#2c2825",
  muted: "#7a7268",
  quiet: "#a69e94",
  accent: "#d05a36",
  accentDark: "#b84e2e",
  accentSoft: "#faebe5",
  olive: "#6b7c52",
  oliveSoft: "#eef1e9",
};

export const shadow = "0 28px 90px rgba(44, 40, 37, 0.14)";
