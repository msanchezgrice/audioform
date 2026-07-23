import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { colors, displayFont, shadow } from "./brand";
import { AnimatedBlock, Captions, enter, Eyebrow, Logo, ProgressRing, Scene, Waveform } from "./components";

const transition = linearTiming({ durationInFrames: 12 });
const sceneDurations = [180, 180, 240, 180, 240, 180];
const sceneStarts = [0, 168, 336, 564, 732, 960];

function HookScene() {
  const frame = useCurrentFrame();
  const formProgress = interpolate(frame, [10, 70], [0, 47.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <Scene>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", height: "100%", gap: 74, alignItems: "center", padding: "84px 112px 100px" }}>
        <div>
          <AnimatedBlock><Logo /></AnimatedBlock>
          <AnimatedBlock delay={8} style={{ marginTop: 88 }}><Eyebrow>93 million form sessions</Eyebrow></AnimatedBlock>
          <AnimatedBlock delay={15}>
            <h1 style={{ maxWidth: 820, margin: "18px 0 22px", fontFamily: displayFont, fontSize: 94, fontWeight: 400, letterSpacing: "-0.055em", lineHeight: 0.96 }}>
              About half never make it to <span style={{ color: colors.accent, fontStyle: "italic" }}>submit.</span>
            </h1>
          </AnimatedBlock>
          <AnimatedBlock delay={30}>
            <p style={{ margin: 0, color: colors.muted, fontSize: 25, lineHeight: 1.55 }}>Zuko 2025 benchmark · starter-to-completion varies by device and form.</p>
          </AnimatedBlock>
        </div>
        <AnimatedBlock delay={20} style={{ display: "grid", justifyItems: "center", gap: 34 }}>
          <div style={{ width: 500, padding: 36, borderRadius: 34, background: colors.surface, boxShadow: shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: colors.quiet, fontSize: 18 }}><span>Tell us about yourself</span><span>Question 7 of 12</span></div>
            <div style={{ height: 78, margin: "30px 0 20px", border: `2px solid ${colors.cream}`, borderRadius: 18 }} />
            <div style={{ height: 14, borderRadius: 99, background: colors.cream }}><div style={{ width: `${formProgress}%`, height: "100%", borderRadius: 99, background: colors.accent }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, color: colors.muted, fontSize: 17 }}><span>Progress</span><strong style={{ color: colors.accent }}>{Math.round(formProgress)}%</strong></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}><ProgressRing percent={47.5} size={166} /><span style={{ maxWidth: 210, color: colors.muted, fontSize: 22, lineHeight: 1.45 }}>mobile starter-to-completion</span></div>
        </AnimatedBlock>
      </div>
    </Scene>
  );
}

function FrictionScene() {
  const frame = useCurrentFrame();
  const split = enter(frame, 15, 38);
  return (
    <Scene>
      <div style={{ height: "100%", padding: "76px 112px 104px" }}>
        <Logo compact />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 66 }}>
          <AnimatedBlock delay={5}>
            <div style={{ height: 680, padding: 46, borderRadius: 38, background: colors.warm, transform: `translateX(${interpolate(split, [0,1], [70,0])}px)` }}>
              <Eyebrow>The form gets</Eyebrow>
              <h2 style={{ margin: "18px 0 36px", fontFamily: displayFont, fontSize: 58, fontWeight: 400, letterSpacing: "-0.04em" }}>One box.</h2>
              {["Primary goal", "Company size", "Anything else?"].map((label, index) => (
                <div key={label} style={{ marginTop: 24 }}><span style={{ color: colors.muted, fontSize: 18 }}>{label}</span><div style={{ height: index === 2 ? 150 : 58, marginTop: 10, border: `1px solid ${colors.cream}`, borderRadius: 15, background: colors.surface }} /></div>
              ))}
            </div>
          </AnimatedBlock>
          <AnimatedBlock delay={18}>
            <div style={{ height: 680, padding: 46, border: `1px solid ${colors.cream}`, borderRadius: 38, background: colors.surface, boxShadow: shadow, transform: `translateX(${interpolate(split, [0,1], [-70,0])}px)` }}>
              <Eyebrow>The conversation finds</Eyebrow>
              <h2 style={{ margin: "18px 0 28px", fontFamily: displayFont, fontSize: 58, fontWeight: 400, letterSpacing: "-0.04em" }}>The story behind it.</h2>
              <div style={{ padding: "24px 28px", borderRadius: 22, background: colors.accentSoft, fontFamily: displayFont, fontSize: 26, lineHeight: 1.4 }}>“We need to launch the pilot before our September board meeting, but the team has never shipped an AI workflow.”</div>
              <Waveform bars={34} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 18 }}>
                {["goal", "deadline", "team context", "risk"].map((item) => <span key={item} style={{ padding: "10px 16px", borderRadius: 99, background: colors.oliveSoft, color: colors.olive, fontSize: 17, fontWeight: 600 }}>{item}</span>)}
              </div>
            </div>
          </AnimatedBlock>
        </div>
      </div>
    </Scene>
  );
}

function InterviewScene() {
  const frame = useCurrentFrame();
  const fieldProgress = interpolate(frame, [55, 170], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16,1,0.3,1) });
  return (
    <Scene>
      <div style={{ height: "100%", padding: "60px 72px 96px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><Logo compact /><Eyebrow>Guided voice interview</Eyebrow></div>
        <AnimatedBlock delay={5} style={{ marginTop: 42 }}>
          <div style={{ display: "grid", gridTemplateColumns: "0.82fr 1.35fr 0.82fr", height: 760, overflow: "hidden", border: `1px solid ${colors.cream}`, borderRadius: 38, background: colors.surface, boxShadow: shadow }}>
            <aside style={{ padding: 34, borderRight: `1px solid ${colors.cream}`, background: colors.warm }}>
              <span style={{ color: colors.muted, fontSize: 16, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>Conversation</span>
              <div style={{ display: "grid", gap: 18, marginTop: 30 }}>
                <p style={{ margin: 0, padding: 18, borderRadius: "18px 18px 18px 4px", background: colors.surface, color: colors.muted, fontSize: 18, lineHeight: 1.45 }}>What would make this pilot a win?</p>
                {frame > 35 ? <p style={{ margin: 0, padding: 18, borderRadius: "18px 18px 4px 18px", background: colors.accentSoft, fontSize: 18, lineHeight: 1.45 }}>We need a working workflow before the September board meeting.</p> : null}
                {frame > 115 ? <p style={{ margin: 0, padding: 18, borderRadius: "18px 18px 18px 4px", background: colors.surface, color: colors.muted, fontSize: 18, lineHeight: 1.45 }}>What is most likely to get in the way?</p> : null}
              </div>
            </aside>
            <main style={{ display: "grid", placeItems: "center", padding: 52, textAlign: "center" }}>
              <div>
                <Eyebrow>Question 3 of 5</Eyebrow>
                <h2 style={{ maxWidth: 650, margin: "22px auto", fontFamily: displayFont, fontSize: 64, fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 1.05 }}>What could keep your team from getting there?</h2>
                <p style={{ margin: 0, color: colors.muted, fontSize: 21 }}>Answer naturally. Talkform will capture the structure.</p>
                <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}><Waveform bars={42} /></div>
                <div style={{ display: "inline-flex", padding: "12px 22px", borderRadius: 99, background: colors.ink, color: "white", fontWeight: 600 }}>Listening…</div>
              </div>
            </main>
            <aside style={{ padding: 34, borderLeft: `1px solid ${colors.cream}` }}>
              <span style={{ color: colors.muted, fontSize: 16, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>Structured answers</span>
              {["Goal", "Deadline", "Team context", "Primary risk"].map((label, index) => {
                const completed = fieldProgress >= (index + 1) * 25;
                return <div key={label} style={{ marginTop: 28, paddingBottom: 20, borderBottom: `1px solid ${colors.cream}` }}><span style={{ color: colors.muted, fontSize: 16 }}>{label}</span><strong style={{ display: "block", marginTop: 8, color: completed ? colors.olive : colors.quiet, fontSize: 18, fontWeight: 600 }}>{completed ? ["Launch pilot", "September", "New to AI", "Internal capacity"][index] : "Listening…"}</strong></div>;
              })}
              <div style={{ height: 9, marginTop: 34, borderRadius: 99, background: colors.cream }}><div style={{ width: `${fieldProgress}%`, height: "100%", borderRadius: 99, background: colors.olive }} /></div>
            </aside>
          </div>
        </AnimatedBlock>
      </div>
    </Scene>
  );
}

function StructureScene() {
  const frame = useCurrentFrame();
  const rows = [
    ["goal", '"launch a pilot"'],
    ["deadline", '"2026-09"'],
    ["teamContext", '"six-person team, first AI workflow"'],
    ["primaryRisk", '"internal capacity"'],
    ["followUp", "true"],
  ];
  return (
    <Scene dark>
      <div style={{ display: "grid", gridTemplateColumns: "0.84fr 1.16fr", height: "100%", gap: 80, alignItems: "center", padding: "80px 112px 110px" }}>
        <div>
          <AnimatedBlock><Logo light /></AnimatedBlock>
          <AnimatedBlock delay={10} style={{ marginTop: 76 }}><Eyebrow light>Conversation in</Eyebrow></AnimatedBlock>
          <AnimatedBlock delay={18}><h2 style={{ margin: "18px 0", fontFamily: displayFont, fontSize: 78, fontWeight: 400, letterSpacing: "-0.05em", lineHeight: 1 }}>Structured data <span style={{ color: colors.accent, fontStyle: "italic" }}>out.</span></h2></AnimatedBlock>
          <AnimatedBlock delay={34}><p style={{ maxWidth: 660, color: "rgba(253,252,250,0.62)", fontSize: 24, lineHeight: 1.6 }}>Keep the schema your product, CRM, automation, or agent expects.</p></AnimatedBlock>
          <AnimatedBlock delay={46}><div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>{["React", "HTTP API", "CLI", "MCP"].map((item) => <span key={item} style={{ padding: "11px 18px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, color: colors.bg, fontWeight: 600 }}>{item}</span>)}</div></AnimatedBlock>
        </div>
        <AnimatedBlock delay={16}>
          <div style={{ padding: "44px 50px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 34, background: "rgba(255,255,255,0.055)", boxShadow: "0 30px 90px rgba(0,0,0,0.22)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 21, lineHeight: 1.7 }}>
            <div style={{ color: colors.quiet }}>{"{"}</div>
            {rows.map(([key, value], index) => {
              const rowIn = enter(frame, 26 + index * 18, 18);
              return <div key={key} style={{ opacity: rowIn, transform: `translateX(${interpolate(rowIn,[0,1],[30,0])}px)`, paddingLeft: 28 }}><span style={{ color: "#efaa93" }}>&quot;{key}&quot;</span><span style={{ color: colors.bg }}>: </span><span style={{ color: value === "true" ? "#a7c17e" : "#f8dfb1" }}>{value}</span>{index < rows.length - 1 ? "," : ""}</div>;
            })}
            <div style={{ color: colors.quiet }}>{"}"}</div>
          </div>
        </AnimatedBlock>
      </div>
    </Scene>
  );
}

function UseCasesScene() {
  const items = [
    { n: "01", title: "Feedback", copy: "Hear the reason behind the score.", tone: colors.accentSoft, ink: colors.accentDark },
    { n: "02", title: "Onboarding", copy: "Start with goals and constraints.", tone: colors.oliveSoft, ink: colors.olive },
    { n: "03", title: "Personalization", copy: "Adapt to what people actually mean.", tone: colors.cream, ink: colors.ink },
  ];
  return (
    <Scene>
      <div style={{ height: "100%", padding: "76px 112px 108px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><Logo compact /><Eyebrow>Where context compounds</Eyebrow></div>
        <AnimatedBlock delay={5}><h2 style={{ maxWidth: 1050, margin: "58px 0 44px", fontFamily: displayFont, fontSize: 76, fontWeight: 400, letterSpacing: "-0.05em", lineHeight: 1 }}>One interface. Three high-leverage moments.</h2></AnimatedBlock>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {items.map((item, index) => (
            <AnimatedBlock key={item.title} delay={18 + index * 16}>
              <div style={{ minHeight: 500, display: "flex", flexDirection: "column", padding: 38, borderRadius: 34, background: item.tone, color: item.ink }}>
                <span style={{ fontFamily: displayFont, fontSize: 26 }}>{item.n}</span>
                <div style={{ marginTop: "auto" }}><h3 style={{ margin: 0, fontFamily: displayFont, fontSize: 54, fontWeight: 400, letterSpacing: "-0.04em" }}>{item.title}</h3><p style={{ margin: "16px 0 0", fontSize: 23, lineHeight: 1.5 }}>{item.copy}</p></div>
              </div>
            </AnimatedBlock>
          ))}
        </div>
      </div>
    </Scene>
  );
}

function CtaScene() {
  return (
    <Scene>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: 100 }}>
        <AnimatedBlock><Logo /></AnimatedBlock>
        <AnimatedBlock delay={10}><h2 style={{ maxWidth: 1240, margin: "52px auto 24px", fontFamily: displayFont, fontSize: 92, fontWeight: 400, letterSpacing: "-0.055em", lineHeight: 0.98 }}>Keep the schema.<br/><span style={{ color: colors.accent, fontStyle: "italic" }}>Lose the form friction.</span></h2></AnimatedBlock>
        <AnimatedBlock delay={28}><p style={{ margin: 0, color: colors.muted, fontSize: 28 }}>Turn your next form into a guided voice interview.</p></AnimatedBlock>
        <AnimatedBlock delay={42}><div style={{ display: "inline-flex", marginTop: 40, padding: "18px 30px", borderRadius: 99, background: colors.ink, color: colors.bg, fontSize: 24, fontWeight: 600 }}>Try it at talkform.ai <span style={{ marginLeft: 14 }}>→</span></div></AnimatedBlock>
      </AbsoluteFill>
    </Scene>
  );
}

export function TalkformDemo() {
  const voiceFiles = ["hook", "friction", "interview", "structure", "uses", "cta"];
  return (
    <AbsoluteFill>
      <Audio src={staticFile("audio/ambient.m4a")} volume={(frame) => interpolate(frame, [0, 20, 1080, 1140], [0, 0.16, 0.16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      {voiceFiles.map((file, index) => (
        <Sequence key={file} from={sceneStarts[index]} durationInFrames={sceneDurations[index]} premountFor={30}>
          <Audio src={staticFile(`audio/elevenlabs/demo-${file}.mp3`)} volume={0.98} />
        </Sequence>
      ))}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={sceneDurations[0]}><HookScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[1]}><FrictionScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[2]}><InterviewScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[3]}><StructureScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[4]}><UseCasesScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[5]}><CtaScene /></TransitionSeries.Sequence>
      </TransitionSeries>
      <Captions src="demo" />
    </AbsoluteFill>
  );
}
