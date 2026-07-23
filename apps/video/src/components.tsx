import type { Caption } from "@remotion/captions";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { bodyFont, colors, displayFont } from "./brand";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const enter = (frame: number, start = 0, duration = 22) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

export function Scene({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background: dark
          ? `radial-gradient(circle at 82% 12%, rgba(208,90,54,0.22), transparent 30%), ${colors.ink}`
          : `radial-gradient(circle at 8% 4%, rgba(208,90,54,0.09), transparent 28%), ${colors.bg}`,
        color: dark ? colors.bg : colors.ink,
        fontFamily: bodyFont,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 10 : 14 }}>
      <svg width={compact ? 34 : 46} height={compact ? 34 : 46} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M32 4C17.088 4 5 14.745 5 28c0 7.41 3.73 14.08 9.62 18.68L11 56l10.92-5.46C24.34 51.5 28.08 52 32 52c14.912 0 27-10.745 27-24S46.912 4 32 4z" fill={colors.accent}/>
        <rect x="22" y="20" width="3" height="16" rx="1.5" fill="#fff"/>
        <rect x="28" y="15" width="3" height="26" rx="1.5" fill="#fff"/>
        <rect x="34" y="18" width="3" height="20" rx="1.5" fill="#fff"/>
        <rect x="40" y="22" width="3" height="12" rx="1.5" fill="#fff"/>
      </svg>
      <strong style={{ color: light ? colors.bg : colors.ink, fontFamily: displayFont, fontSize: compact ? 25 : 35, fontWeight: 400, letterSpacing: "-0.03em" }}>Talkform</strong>
    </div>
  );
}

export function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <span style={{ color: light ? "rgba(253,252,250,0.6)" : colors.accent, fontSize: 18, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {children}
    </span>
  );
}

export function AnimatedBlock({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const progress = enter(frame, delay);
  return (
    <div style={{ opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [42, 0])}px)`, ...style }}>
      {children}
    </div>
  );
}

export function Waveform({ bars = 30, active = true, color = colors.accent }: { bars?: number; active?: boolean; color?: string }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", height: 62, alignItems: "center", gap: 6 }} aria-label="Voice waveform">
      {Array.from({ length: bars }, (_, index) => {
        const signal = active ? Math.abs(Math.sin(frame * 0.17 + index * 0.78)) : 0.15;
        const height = 12 + signal * (22 + (index % 5) * 5);
        return <span key={index} style={{ width: 6, height, borderRadius: 99, backgroundColor: color, opacity: 0.45 + signal * 0.55 }} />;
      })}
    </div>
  );
}

export function ProgressRing({ percent, size = 172 }: { percent: number; size?: number }) {
  const frame = useCurrentFrame();
  const progress = enter(frame, 12, 35);
  const displayed = Math.round(percent * progress);
  return (
    <div style={{ width: size, height: size, display: "grid", placeItems: "center", borderRadius: "50%", background: `conic-gradient(${colors.accent} ${displayed}%, ${colors.cream} ${displayed}% 100%)` }}>
      <div style={{ width: size - 22, height: size - 22, display: "grid", placeItems: "center", borderRadius: "50%", background: colors.surface, color: colors.ink, fontFamily: displayFont, fontSize: size * 0.28 }}>
        {displayed}%
      </div>
    </div>
  );
}

export function Captions({ src, bottom = 42 }: { src: string; bottom?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender(`Loading ${src} captions`));
  const loadCaptions = useCallback(async () => {
    try {
      const response = await fetch(staticFile(`captions/${src}.json`));
      if (!response.ok) throw new Error(`Unable to load ${src} captions`);
      setCaptions((await response.json()) as Caption[]);
      continueRender(handle);
    } catch (error) {
      cancelRender(error);
    }
  }, [cancelRender, continueRender, handle, src]);

  useEffect(() => {
    void loadCaptions();
  }, [loadCaptions]);

  if (!captions) return null;
  const now = (frame / fps) * 1000;
  const caption = captions.find((item) => now >= item.startMs && now < item.endMs);
  if (!caption) return null;
  const opacity = interpolate(now, [caption.startMs, caption.startMs + 160, caption.endMs - 160, caption.endMs], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", justifyContent: "flex-end", alignItems: "center", padding: `0 8% ${bottom}px` }}>
      <div style={{ maxWidth: "88%", borderRadius: 18, background: "rgba(24,21,19,0.88)", color: "white", padding: "14px 24px", fontFamily: bodyFont, fontSize: src === "demo" ? 25 : 32, fontWeight: 600, lineHeight: 1.25, opacity, textAlign: "center", boxShadow: "0 8px 28px rgba(0,0,0,0.22)" }}>
        {caption.text.trim()}
      </div>
    </AbsoluteFill>
  );
}
