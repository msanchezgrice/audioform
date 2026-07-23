import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { colors, displayFont, shadow } from "./brand";
import { AnimatedBlock, Captions, enter, Eyebrow, Logo, Scene, Waveform } from "./components";

/**
 * TalkformGetTalking — 60s hero cut for the "Get your users talking." campaign.
 * 1920×1080 · 30fps · 1800 frames.
 *
 * Mic-state truth (product contract, mirrored here):
 *   listening  = olive/green dot, PULSING + live waveform
 *   not listening = amber dot, STATIC + flat waveform
 * Never show a pulsing indicator while copy implies the mic is off.
 *
 * Claim boundary: the only completion stat is the Zuko 2025 industry benchmark
 * (starter-to-completion 55.5% desktop / 47.5% mobile), captioned as a benchmark.
 * No Talkform lift claim until we have our own measured data.
 */

/**
 * Flip to true after running voiceover:generate with the gettalking-* segments.
 * While false, the composition renders silent (ambient only) and skips captions,
 * so it loads in Studio before the ElevenLabs assets exist. The <Captions>
 * component cancels the render if captions/gettalking.json is missing — that is
 * why this gate exists.
 */
const ASSETS_READY = false;

const transition = linearTiming({ durationInFrames: 12 });
const sceneDurations = [300, 240, 420, 300, 300, 300]; // 1800 with overlaps handled by TransitionSeries
const sceneStarts = [0, 288, 516, 924, 1212, 1500];

const amber = "#d9a13b";
const amberSoft = "#f7ecd8";

export function MicState({ listening, delay = 0 }: { listening: boolean; delay?: number }) {
  const frame = useCurrentFrame();
  const visible = enter(frame, delay);
  const pulse = listening ? 0.55 + 0.45 * Math.abs(Math.sin((frame - delay) * 0.16)) : 1;
  const dotColor = listening ? colors.olive : amber;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 22px",
        borderRadius: 99,
        background: listening ? colors.oliveSoft : amberSoft,
        color: listening ? colors.olive : "#8a6b1f",
        fontWeight: 700,
        fontSize: 19,
        opacity: visible,
      }}
    >
      <span style={{ position: "relative", width: 14, height: 14 }}>
        {listening ? (
          <span
            style={{
              position: "absolute",
              inset: -6,
              borderRadius: "50%",
              background: colors.olive,
              opacity: 0.25 * pulse,
              transform: `scale(${0.7 + 0.5 * pulse})`,
            }}
          />
        ) : null}
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: dotColor,
            opacity: listening ? pulse : 1,
          }}
        />
      </span>
      {listening ? "Listening" : "Mic off — tap to talk"}
    </div>
  );
}

function HookScene() {
  const frame = useCurrentFrame();
  const fill = interpolate(frame, [20, 90], [0, 47.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <Scene>
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", height: "100%", gap: 74, alignItems: "center", padding: "84px 112px 100px" }}>
        <div>
          <AnimatedBlock><Logo /></AnimatedBlock>
          <AnimatedBlock delay={10} style={{ marginTop: 84 }}><Eyebrow>The first conversation</Eyebrow></AnimatedBlock>
          <AnimatedBlock delay={16}>
            <h1 style={{ maxWidth: 860, margin: "18px 0 22px", fontFamily: displayFont, fontSize: 92, fontWeight: 400, letterSpacing: "-0.055em", lineHeight: 0.97 }}>
              Your form is the first conversation your product <span style={{ color: colors.accent, fontStyle: "italic" }}>ever has.</span>
            </h1>
          </AnimatedBlock>
          <AnimatedBlock delay={34}>
            <p style={{ margin: 0, color: colors.muted, fontSize: 25, lineHeight: 1.55 }}>
              And about half the people who start one never finish. <span style={{ color: colors.quiet }}>Zuko 2025 benchmark · varies by device.</span>
            </p>
          </AnimatedBlock>
        </div>
        <AnimatedBlock delay={24} style={{ display: "grid", justifyItems: "center" }}>
          <div style={{ width: 500, padding: 36, borderRadius: 34, background: colors.surface, boxShadow: shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: colors.quiet, fontSize: 18 }}>
              <span>Tell us about yourself</span><span>Question 7 of 12</span>
            </div>
            <div style={{ height: 78, margin: "30px 0 20px", border: `2px solid ${colors.cream}`, borderRadius: 18 }} />
            <div style={{ height: 14, borderRadius: 99, background: colors.cream }}>
              <div style={{ width: `${fill}%`, height: "100%", borderRadius: 99, background: colors.accent }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, color: colors.muted, fontSize: 17 }}>
              <span>Most journeys end here</span><strong style={{ color: colors.accent }}>{Math.round(fill)}%</strong>
            </div>
          </div>
        </AnimatedBlock>
      </div>
    </Scene>
  );
}

function TurnScene() {
  const frame = useCurrentFrame();
  const listening = frame > 120;
  return (
    <Scene>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: 100 }}>
        <AnimatedBlock><Eyebrow>The turn</Eyebrow></AnimatedBlock>
        <AnimatedBlock delay={8}>
          <h2 style={{ maxWidth: 1150, margin: "26px auto 18px", fontFamily: displayFont, fontSize: 104, fontWeight: 400, letterSpacing: "-0.055em", lineHeight: 0.97 }}>
            Stop making people type.<br /><span style={{ color: colors.accent, fontStyle: "italic" }}>Let them talk.</span>
          </h2>
        </AnimatedBlock>
        <AnimatedBlock delay={40} style={{ marginTop: 34, display: "grid", justifyItems: "center", gap: 22 }}>
          <MicState listening={listening} />
          <Waveform bars={46} active={listening} color={listening ? colors.olive : amber} />
        </AnimatedBlock>
      </AbsoluteFill>
    </Scene>
  );
}

function InterviewScene() {
  const frame = useCurrentFrame();
  const fieldProgress = interpolate(frame, [60, 330], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return (
    <Scene>
      <div style={{ height: "100%", padding: "56px 72px 92px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Logo compact /><Eyebrow>Your form, interviewed</Eyebrow>
        </div>
        <AnimatedBlock delay={5} style={{ marginTop: 38 }}>
          <div style={{ display: "grid", gridTemplateColumns: "0.82fr 1.35fr 0.82fr", height: 780, overflow: "hidden", border: `1px solid ${colors.cream}`, borderRadius: 38, background: colors.surface, boxShadow: shadow }}>
            <aside style={{ padding: 34, borderRight: `1px solid ${colors.cream}`, background: colors.warm }}>
              <span style={{ color: colors.muted, fontSize: 16, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>Conversation</span>
              <div style={{ display: "grid", gap: 18, marginTop: 30 }}>
                <p style={{ margin: 0, padding: 18, borderRadius: "18px 18px 18px 4px", background: colors.surface, color: colors.muted, fontSize: 18, lineHeight: 1.45 }}>What are you hoping this does for you?</p>
                {frame > 60 ? <p style={{ margin: 0, padding: 18, borderRadius: "18px 18px 4px 18px", background: colors.accentSoft, fontSize: 18, lineHeight: 1.45 }}>Honestly, I want my team writing better release notes without me nagging them.</p> : null}
                {frame > 170 ? <p style={{ margin: 0, padding: 18, borderRadius: "18px 18px 18px 4px", background: colors.surface, color: colors.muted, fontSize: 18, lineHeight: 1.45 }}>Who's on the team — and what do they ship?</p> : null}
                {frame > 250 ? <p style={{ margin: 0, padding: 18, borderRadius: "18px 18px 4px 18px", background: colors.accentSoft, fontSize: 18, lineHeight: 1.45 }}>Six engineers, two designers. Weekly releases, mostly web.</p> : null}
              </div>
            </aside>
            <main style={{ display: "grid", placeItems: "center", padding: 52, textAlign: "center" }}>
              <div>
                <Eyebrow>Question 2 of 5</Eyebrow>
                <h2 style={{ maxWidth: 650, margin: "22px auto", fontFamily: displayFont, fontSize: 62, fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
                  Who&apos;s on the team — and what do they ship?
                </h2>
                <p style={{ margin: 0, color: colors.muted, fontSize: 21 }}>Answer naturally. Talkform captures the structure.</p>
                <div style={{ display: "flex", justifyContent: "center", marginTop: 30 }}>
                  <Waveform bars={42} color={colors.olive} />
                </div>
                <div style={{ marginTop: 6 }}><MicState listening delay={10} /></div>
              </div>
            </main>
            <aside style={{ padding: 34, borderLeft: `1px solid ${colors.cream}` }}>
              <span style={{ color: colors.muted, fontSize: 16, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>Structured answers</span>
              {["Primary goal", "Team size", "Release cadence", "Platform"].map((label, index) => {
                const completed = fieldProgress >= (index + 1) * 25;
                return (
                  <div key={label} style={{ marginTop: 28, paddingBottom: 20, borderBottom: `1px solid ${colors.cream}` }}>
                    <span style={{ color: colors.muted, fontSize: 16 }}>{label}</span>
                    <strong style={{ display: "block", marginTop: 8, color: completed ? colors.olive : colors.quiet, fontSize: 18, fontWeight: 600 }}>
                      {completed ? ["Better release notes", "8 people", "Weekly", "Web"][index] : "Listening…"}
                    </strong>
                  </div>
                );
              })}
              <div style={{ height: 9, marginTop: 34, borderRadius: 99, background: colors.cream }}>
                <div style={{ width: `${fieldProgress}%`, height: "100%", borderRadius: 99, background: colors.olive }} />
              </div>
            </aside>
          </div>
        </AnimatedBlock>
      </div>
    </Scene>
  );
}

function StructureScene() {
  const frame = useCurrentFrame();
  const rows: Array<[string, string]> = [
    ["primaryGoal", '"better release notes"'],
    ["teamSize", "8"],
    ["releaseCadence", '"weekly"'],
    ["platform", '"web"'],
    ["summary", '"Lead wants the team writing…"'],
  ];
  return (
    <Scene dark>
      <div style={{ display: "grid", gridTemplateColumns: "0.84fr 1.16fr", height: "100%", gap: 80, alignItems: "center", padding: "80px 112px 110px" }}>
        <div>
          <AnimatedBlock><Logo light /></AnimatedBlock>
          <AnimatedBlock delay={10} style={{ marginTop: 76 }}><Eyebrow light>Conversation in</Eyebrow></AnimatedBlock>
          <AnimatedBlock delay={18}>
            <h2 style={{ margin: "18px 0", fontFamily: displayFont, fontSize: 78, fontWeight: 400, letterSpacing: "-0.05em", lineHeight: 1 }}>
              Structure <span style={{ color: colors.accent, fontStyle: "italic" }}>out.</span>
            </h2>
          </AnimatedBlock>
          <AnimatedBlock delay={34}>
            <p style={{ maxWidth: 660, color: "rgba(253,252,250,0.62)", fontSize: 24, lineHeight: 1.6 }}>
              Fields, transcript, and summary in one stable schema — for your product, your CRM, or your agent.
            </p>
          </AnimatedBlock>
          <AnimatedBlock delay={46}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
              {["React", "HTTP API", "CLI", "MCP"].map((item) => (
                <span key={item} style={{ padding: "11px 18px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, color: colors.bg, fontWeight: 600 }}>{item}</span>
              ))}
            </div>
          </AnimatedBlock>
        </div>
        <AnimatedBlock delay={16}>
          <div style={{ padding: "44px 50px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 34, background: "rgba(255,255,255,0.055)", boxShadow: "0 30px 90px rgba(0,0,0,0.22)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 21, lineHeight: 1.7 }}>
            <div style={{ color: colors.quiet }}>{"{"}</div>
            {rows.map(([key, value], index) => {
              const rowIn = enter(frame, 26 + index * 16, 18);
              return (
                <div key={key} style={{ opacity: rowIn, transform: `translateX(${interpolate(rowIn, [0, 1], [30, 0])}px)`, paddingLeft: 28 }}>
                  <span style={{ color: "#efaa93" }}>&quot;{key}&quot;</span>
                  <span style={{ color: colors.bg }}>: </span>
                  <span style={{ color: value === "8" ? "#a7c17e" : "#f8dfb1" }}>{value}</span>
                  {index < rows.length - 1 ? "," : ""}
                </div>
              );
            })}
            <div style={{ color: colors.quiet }}>{"}"}</div>
          </div>
        </AnimatedBlock>
      </div>
    </Scene>
  );
}

function AgentScene() {
  const frame = useCurrentFrame();
  const lines: Array<{ text: string; who: "you" | "agent" }> = [
    { text: "> add Talkform voice onboarding to my app", who: "you" },
    { text: "Reading talkform.ai/llms.txt…", who: "agent" },
    { text: "Imported your form → talkform.config.json", who: "agent" },
    { text: "Config valid · 5 fields · widget embedded", who: "agent" },
    { text: "Done. Your form now runs the interview.", who: "agent" },
  ];
  return (
    <Scene>
      <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", height: "100%", gap: 80, alignItems: "center", padding: "84px 112px 100px" }}>
        <div>
          <AnimatedBlock><Logo compact /></AnimatedBlock>
          <AnimatedBlock delay={10} style={{ marginTop: 70 }}><Eyebrow>Setup is a prompt</Eyebrow></AnimatedBlock>
          <AnimatedBlock delay={18}>
            <h2 style={{ margin: "18px 0 22px", fontFamily: displayFont, fontSize: 80, fontWeight: 400, letterSpacing: "-0.05em", lineHeight: 1 }}>
              Your coding agent sets it <span style={{ color: colors.accent, fontStyle: "italic" }}>up.</span>
            </h2>
          </AnimatedBlock>
          <AnimatedBlock delay={34}>
            <p style={{ maxWidth: 620, margin: 0, color: colors.muted, fontSize: 24, lineHeight: 1.6 }}>
              Schemas, templates, llms.txt, CLI, and MCP — built so Claude Code, Cursor, or ChatGPT can wire Talkform into your product.
            </p>
          </AnimatedBlock>
        </div>
        <AnimatedBlock delay={16}>
          <div style={{ padding: "40px 46px", borderRadius: 34, background: colors.ink, color: colors.bg, boxShadow: shadow, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 22, lineHeight: 2.0 }}>
            {lines.map((line, index) => {
              const lineIn = enter(frame, 20 + index * 40, 16);
              return (
                <div key={line.text} style={{ opacity: lineIn, color: line.who === "you" ? colors.bg : "#a7c17e" }}>
                  {line.who === "agent" ? "  ✓ " : ""}{line.text}
                </div>
              );
            })}
          </div>
        </AnimatedBlock>
      </div>
    </Scene>
  );
}

function CtaScene() {
  const frame = useCurrentFrame();
  return (
    <Scene>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: 100 }}>
        <AnimatedBlock><Logo /></AnimatedBlock>
        <AnimatedBlock delay={12}>
          <h2 style={{ maxWidth: 1240, margin: "52px auto 24px", fontFamily: displayFont, fontSize: 116, fontWeight: 400, letterSpacing: "-0.055em", lineHeight: 0.97 }}>
            Get your users <span style={{ color: colors.accent, fontStyle: "italic" }}>talking.</span>
          </h2>
        </AnimatedBlock>
        <AnimatedBlock delay={30}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <Waveform bars={38} color={colors.olive} active={frame < 240} />
          </div>
        </AnimatedBlock>
        <AnimatedBlock delay={42}>
          <div style={{ display: "inline-flex", marginTop: 26, padding: "18px 30px", borderRadius: 99, background: colors.ink, color: colors.bg, fontSize: 24, fontWeight: 600 }}>
            talkform.ai <span style={{ marginLeft: 14 }}>→</span>
          </div>
        </AnimatedBlock>
      </AbsoluteFill>
    </Scene>
  );
}

export function TalkformGetTalking() {
  const voiceFiles = ["hook", "turn", "interview", "structure", "agent", "cta"];
  return (
    <AbsoluteFill>
      <Audio
        src={staticFile("audio/ambient.m4a")}
        volume={(frame) => interpolate(frame, [0, 20, 1740, 1800], [0, 0.16, 0.16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
      {ASSETS_READY
        ? voiceFiles.map((file, index) => (
            <Sequence key={file} from={sceneStarts[index]} durationInFrames={sceneDurations[index]} premountFor={30}>
              <Audio src={staticFile(`audio/elevenlabs/gettalking-${file}.mp3`)} volume={0.98} />
            </Sequence>
          ))
        : null}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={sceneDurations[0]}><HookScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[1]}><TurnScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[2]}><InterviewScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[3]}><StructureScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[4]}><AgentScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[5]}><CtaScene /></TransitionSeries.Sequence>
      </TransitionSeries>
      {ASSETS_READY ? <Captions src="gettalking" /> : null}
    </AbsoluteFill>
  );
}
