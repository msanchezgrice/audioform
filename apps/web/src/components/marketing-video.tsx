"use client";

import { useRef } from "react";
import styles from "./marketing-video.module.css";

const VIDEO_EVENT_NAME = "talkform:marketing-video";

type MarketingVideoProps = {
  videoId: string;
  title: string;
  description: string;
  src: string;
  poster: string;
  captions: string;
  portrait?: boolean;
  eyebrow?: string;
};

type MarketingVideoAction = "played" | "progress" | "completed";

function emitVideoEvent(videoId: string, action: MarketingVideoAction, milestone?: number) {
  window.dispatchEvent(
    new CustomEvent(VIDEO_EVENT_NAME, {
      detail: { videoId, action, milestone },
    }),
  );
}

export function MarketingVideo({
  videoId,
  title,
  description,
  src,
  poster,
  captions,
  portrait = false,
  eyebrow = "Watch the demo",
}: MarketingVideoProps) {
  const milestones = useRef(new Set<number>());
  const playedOnce = useRef(false);

  return (
    <figure className={`${styles.card}${portrait ? ` ${styles.portrait}` : ""}`}>
      <div className={styles.copy}>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className={styles.frame}>
        <video
          aria-label={title}
          controls
          playsInline
          poster={poster}
          preload="metadata"
          onPlay={() => {
            if (playedOnce.current) return;
            playedOnce.current = true;
            emitVideoEvent(videoId, "played");
          }}
          onEnded={() => emitVideoEvent(videoId, "completed")}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            if (!Number.isFinite(video.duration) || video.duration <= 0) return;
            const percent = Math.floor((video.currentTime / video.duration) * 100);
            for (const milestone of [25, 50, 75]) {
              if (percent >= milestone && !milestones.current.has(milestone)) {
                milestones.current.add(milestone);
                emitVideoEvent(videoId, "progress", milestone);
              }
            }
          }}
        >
          <source src={src} type="video/mp4" />
          <track src={captions} kind="captions" srcLang="en" label="English" />
          Your browser does not support embedded video.
        </video>
      </div>
    </figure>
  );
}
