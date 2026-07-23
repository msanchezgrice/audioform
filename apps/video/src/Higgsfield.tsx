import { Audio, Video } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { bodyFont, colors, displayFont } from "./brand";
import { Captions, Logo } from "./components";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

function StoryCard({
  from,
  to,
  eyebrow,
  children,
}: {
  from: number;
  to: number;
  eyebrow: string;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [from, from + 18, to - 18, to],
    [0, 1, 1, 0],
    { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) },
  );
  const lift = interpolate(opacity, [0, 1], [28, 0]);

  return (
    <div
      style={{
        position: "absolute",
        top: 178,
        left: 54,
        right: 54,
        opacity,
        transform: `translateY(${lift}px)`,
        color: colors.ink,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          padding: "10px 16px",
          borderRadius: 999,
          background: "rgba(253,252,250,0.9)",
          color: colors.accent,
          fontFamily: bodyFont,
          fontSize: 18,
          fontWeight: 750,
          letterSpacing: "0.11em",
          textTransform: "uppercase",
          boxShadow: "0 10px 28px rgba(24,21,19,0.12)",
        }}
      >
        {eyebrow}
      </span>
      <h1
        style={{
          maxWidth: 900,
          margin: "24px 0 0",
          fontFamily: displayFont,
          fontSize: 78,
          fontWeight: 400,
          letterSpacing: "-0.052em",
          lineHeight: 0.98,
          textShadow: "0 2px 22px rgba(253,252,250,0.9)",
        }}
      >
        {children}
      </h1>
    </div>
  );
}

export function TalkformHiggsfield() {
  const frame = useCurrentFrame();
  const endCard = interpolate(frame, [350, 382], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ background: colors.ink }}>
      <Video
        src={staticFile("higgsfield/talkform-broll.mp4")}
        muted
        objectFit="cover"
        style={{ width: "100%", height: "100%" }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(253,252,250,0.72) 0%, rgba(253,252,250,0.12) 31%, transparent 52%, rgba(24,21,19,0.26) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 52,
          padding: "12px 17px",
          borderRadius: 999,
          background: "rgba(253,252,250,0.9)",
          boxShadow: "0 12px 34px rgba(24,21,19,0.12)",
        }}
      >
        <Logo compact />
      </div>

      <StoryCard from={0} to={168} eyebrow="Forms miss the story">
        People have more to say than a form knows how to ask.
      </StoryCard>
      <StoryCard from={150} to={342} eyebrow="Talk naturally">
        Capture the context. Keep every answer structured.
      </StoryCard>

      <div
        style={{
          position: "absolute",
          top: 154,
          left: 52,
          right: 52,
          padding: "34px 36px 36px",
          borderRadius: 34,
          background: "rgba(24,21,19,0.9)",
          color: colors.bg,
          opacity: endCard,
          transform: `translateY(${interpolate(endCard, [0, 1], [34, 0])}px)`,
          boxShadow: "0 26px 70px rgba(24,21,19,0.28)",
        }}
      >
        <span
          style={{
            color: colors.accent,
            fontFamily: bodyFont,
            fontSize: 18,
            fontWeight: 750,
            letterSpacing: "0.11em",
            textTransform: "uppercase",
          }}
        >
          Talkform
        </span>
        <h2
          style={{
            margin: "18px 0 24px",
            fontFamily: displayFont,
            fontSize: 70,
            fontWeight: 400,
            letterSpacing: "-0.052em",
            lineHeight: 0.98,
          }}
        >
          More human in.
          <br />
          <span style={{ color: colors.accent, fontStyle: "italic" }}>Clean data out.</span>
        </h2>
        <div
          style={{
            display: "inline-flex",
            padding: "14px 22px",
            borderRadius: 999,
            background: colors.accent,
            fontFamily: bodyFont,
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          talkform.ai&nbsp; →
        </div>
      </div>

      <Audio src={staticFile("audio/ambient.m4a")} volume={0.09} />
      <Audio src={staticFile("audio/elevenlabs/higgsfield.mp3")} volume={1} />
      <Captions src="higgsfield" bottom={220} />
    </AbsoluteFill>
  );
}
