"use client";

import { useEffect, useRef } from "react";
import { VideoState } from "@/hooks/useWebRTC";
import styles from "./VideoChat.module.css";

interface VideoChatProps {
  videoState: VideoState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onStart: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onStop: () => void;
}

export function VideoChat({
  videoState,
  localStream,
  remoteStream,
  onStart,
  onAccept,
  onDecline,
  onStop,
}: VideoChatProps) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream;
  }, [localStream, videoState]);

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream, videoState]);

  if (videoState === "off") {
    return (
      <div className={styles.wrap}>
        <button className={styles.startBtn} onClick={onStart}>
          📹 Video Chat
        </button>
      </div>
    );
  }

  if (videoState === "requesting") {
    return (
      <div className={styles.wrap}>
        <p className={styles.status}>Waiting for opponent…</p>
        <button className={styles.cancelBtn} onClick={onStop}>Cancel</button>
      </div>
    );
  }

  if (videoState === "incoming") {
    return (
      <div className={styles.incoming}>
        <p className={styles.incomingText}>📹 Opponent wants to video chat</p>
        <div className={styles.incomingBtns}>
          <button className={styles.acceptBtn} onClick={onAccept}>Accept</button>
          <button className={styles.declineBtn} onClick={onDecline}>Decline</button>
        </div>
      </div>
    );
  }

  if (videoState === "declined") {
    return (
      <div className={styles.wrap}>
        <p className={styles.declined}>Opponent declined video chat</p>
      </div>
    );
  }

  if (videoState === "connecting") {
    return (
      <div className={styles.wrap}>
        <p className={styles.status}>Connecting video…</p>
      </div>
    );
  }

  // "live"
  return (
    <div className={styles.videoWrap}>
      <video ref={remoteRef} autoPlay playsInline className={styles.remoteVideo} />
      <video ref={localRef} autoPlay playsInline muted className={styles.localVideo} />
      <button className={styles.stopBtn} onClick={onStop}>✕</button>
    </div>
  );
}
