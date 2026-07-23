import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { colors, displayFont, shadow } from "./brand";
import { AnimatedBlock, Captions, Eyebrow, Logo, Scene, Waveform } from "./components";

const transition = linearTiming({ durationInFrames: 15 });

function Hook() {
  const frame = useCurrentFrame();
  const exit = interpolate(frame, [82, 115], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  return (
    <Scene>
      <AbsoluteFill style={{ padding: "84px 68px 140px" }}>
        <Logo compact />
        <div style={{ display: "grid", flex: 1, placeItems: "center", marginTop: 100, transform: `scale(${1 - exit * 0.1})`, opacity: 1 - exit }}>
          <div style={{ textAlign: "center" }}>
            <Eyebrow>93 million form sessions</Eyebrow>
            <h1 style={{ margin: "32px 0 24px", fontFamily: displayFont, fontSize: 112, fontWeight: 400, letterSpacing: "-0.06em", lineHeight: 0.92 }}>About half<br/><span style={{ color: colors.accent, fontStyle: "italic" }}>never submit.</span></h1>
            <p style={{ margin: "32px auto 0", color: colors.muted, fontSize: 24, lineHeight: 1.5 }}>Zuko 2025 benchmark</p>
          </div>
        </div>
        <div style={{ display: "grid", gap: 14, marginTop: "auto" }}>{["Name", "Company", "Tell us more…"].map((field, index) => <div key={field} style={{ height: 72 + index * 18, border: `2px solid ${colors.cream}`, borderRadius: 20, background: colors.surface, color: colors.quiet, padding: "22px 24px", fontSize: 20, transform: `translateX(${Math.sin(index) * exit * 900}px) rotate(${(index-1)*exit*8}deg)`, opacity: 1-exit }}>{field}</div>)}</div>
      </AbsoluteFill>
    </Scene>
  );
}

function Product() {
  const frame = useCurrentFrame();
  const fill = interpolate(frame, [65, 155], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16,1,0.3,1) });
  return (
    <Scene>
      <AbsoluteFill style={{ padding: "66px 52px 132px" }}>
        <AnimatedBlock><Logo compact /></AnimatedBlock>
        <AnimatedBlock delay={8}><h2 style={{ margin: "70px 0 24px", fontFamily: displayFont, fontSize: 84, fontWeight: 400, letterSpacing: "-0.055em", lineHeight: 0.96 }}>Let people<br/><span style={{ color: colors.accent, fontStyle: "italic" }}>say the answer.</span></h2></AnimatedBlock>
        <AnimatedBlock delay={22} style={{ marginTop: 28 }}>
          <div style={{ padding: 34, borderRadius: 34, background: colors.surface, boxShadow: shadow }}>
            <span style={{ color: colors.muted, fontSize: 17 }}>What would make this a win?</span>
            <Waveform bars={25} />
            <div style={{ display: "flex", justifyContent: "space-between", color: colors.muted, fontSize: 16 }}><span>Listening</span><strong style={{ color: colors.olive }}>{Math.round(fill)}% structured</strong></div>
            <div style={{ height: 9, marginTop: 15, borderRadius: 99, background: colors.cream }}><div style={{ width: `${fill}%`, height: "100%", borderRadius: 99, background: colors.olive }} /></div>
          </div>
        </AnimatedBlock>
        <AnimatedBlock delay={70} style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>{["goal", "context", "constraint", "next step"].map((item) => <span key={item} style={{ padding: "12px 18px", borderRadius: 99, background: colors.oliveSoft, color: colors.olive, fontSize: 18, fontWeight: 600 }}>{item}</span>)}</AnimatedBlock>
      </AbsoluteFill>
    </Scene>
  );
}

function Finish() {
  return (
    <Scene dark>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "80px 56px 145px", textAlign: "center" }}>
        <AnimatedBlock><Logo light /></AnimatedBlock>
        <AnimatedBlock delay={10}><h2 style={{ margin: "64px 0 40px", fontFamily: displayFont, fontSize: 86, fontWeight: 400, letterSpacing: "-0.055em", lineHeight: 0.98 }}>Feedback.<br/>Onboarding.<br/><span style={{ color: colors.accent, fontStyle: "italic" }}>Personalization.</span></h2></AnimatedBlock>
        <AnimatedBlock delay={35}><p style={{ maxWidth: 760, margin: 0, color: "rgba(253,252,250,0.66)", fontSize: 26, lineHeight: 1.55 }}>Replace the form with a conversation. Keep the result structured.</p></AnimatedBlock>
        <AnimatedBlock delay={55}><div style={{ marginTop: 46, padding: "18px 30px", borderRadius: 99, background: colors.accent, color: "white", fontSize: 24, fontWeight: 700 }}>talkform.ai →</div></AnimatedBlock>
      </AbsoluteFill>
    </Scene>
  );
}

export function TalkformSocial() {
  return (
    <AbsoluteFill>
      <Audio src={staticFile("audio/ambient.m4a")} volume={(frame) => interpolate(frame, [0, 15, 405, 450], [0, 0.17, 0.17, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      <Audio src={staticFile("audio/elevenlabs/social.mp3")} volume={1} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={120}><Hook /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={180}><Product /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={180}><Finish /></TransitionSeries.Sequence>
      </TransitionSeries>
      <Captions src="social" bottom={220} />
    </AbsoluteFill>
  );
}
