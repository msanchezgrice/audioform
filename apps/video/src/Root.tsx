import "./index.css";
import { Composition, Folder } from "remotion";
import { TalkformDemo } from "./Demo";
import { TalkformHiggsfield } from "./Higgsfield";
import { TalkformSocial } from "./Social";

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Talkform-Marketing">
      <Composition
        id="TalkformDemo"
        component={TalkformDemo}
        durationInFrames={1140}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="TalkformSocial"
        component={TalkformSocial}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="TalkformHiggsfield"
        component={TalkformHiggsfield}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
    </Folder>
  );
};
