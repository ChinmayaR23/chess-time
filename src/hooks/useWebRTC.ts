"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Client } from "@stomp/stompjs";
import { PlayerColor } from "@/types/game";

export type VideoState = "off" | "requesting" | "incoming" | "connecting" | "live" | "declined";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface UseWebRTCOptions {
  client: Client;
  gameId: string;
  myColor: PlayerColor;
}

export function useWebRTC({ client, gameId, myColor }: UseWebRTCOptions) {
  const [videoState, setVideoState] = useState<VideoState>("off");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const sendSignal = useCallback(
    (payload: Record<string, unknown>) => {
      if (!client.active) return;
      client.publish({
        destination: "/app/game/webrtc-signal",
        body: JSON.stringify({ ...payload, gameId, from: myColor }),
      });
    },
    [client, gameId, myColor]
  );

  const closePC = useCallback(() => {
    const pc = pcRef.current;
    if (!pc) return;
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.close();
    pcRef.current = null;
    pendingCandidates.current = [];
  }, []);

  const stopStreams = useCallback(() => {
    setLocalStream((s) => { s?.getTracks().forEach((t) => t.stop()); return null; });
    setRemoteStream(null);
  }, []);

  // sendStop=true sends webrtc_stop to notify the opponent
  const cleanup = useCallback(
    (sendStop: boolean) => {
      if (sendStop) sendSignal({ type: "webrtc_stop" });
      closePC();
      stopStreams();
      setVideoState("off");
    },
    [sendSignal, closePC, stopStreams]
  );

  const buildPC = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal({ type: "webrtc_ice", candidate: e.candidate.toJSON() });
      }
    };

    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setVideoState("live");
      } else if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        closePC();
        stopStreams();
        setVideoState("off");
      }
    };

    pcRef.current = pc;
    return pc;
  }, [sendSignal, closePC, stopStreams]);

  const flushCandidates = async (pc: RTCPeerConnection) => {
    for (const c of pendingCandidates.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
    pendingCandidates.current = [];
  };

  // Called by GameRoom when it receives a webrtc_* message on /topic/game/{gameId}
  const handleSignal = useCallback(
    async (data: Record<string, unknown>) => {
      if (data.from === myColor) return; // ignore own echoed messages

      switch (data.type) {
        case "webrtc_request": {
          setVideoState("incoming");
          break;
        }

        case "webrtc_accept": {
          // I'm the initiator — opponent accepted, now get media and create offer
          setVideoState("connecting");
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            const pc = buildPC();
            stream.getTracks().forEach((t) => pc.addTrack(t, stream));
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal({ type: "webrtc_offer", sdp: pc.localDescription!.sdp });
          } catch {
            cleanup(true); // notify opponent something went wrong
          }
          break;
        }

        case "webrtc_offer": {
          // I'm the answerer — received SDP offer from initiator
          const pc = pcRef.current;
          if (!pc) return;
          try {
            await pc.setRemoteDescription(
              new RTCSessionDescription({ type: "offer", sdp: data.sdp as string })
            );
            await flushCandidates(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal({ type: "webrtc_answer", sdp: pc.localDescription!.sdp });
          } catch { /* ignore */ }
          break;
        }

        case "webrtc_answer": {
          // I'm the initiator — received SDP answer from answerer
          const pc = pcRef.current;
          if (!pc) return;
          try {
            await pc.setRemoteDescription(
              new RTCSessionDescription({ type: "answer", sdp: data.sdp as string })
            );
            await flushCandidates(pc);
          } catch { /* ignore */ }
          break;
        }

        case "webrtc_ice": {
          const pc = pcRef.current;
          const candidate = data.candidate as RTCIceCandidateInit;
          if (!pc || !pc.remoteDescription) {
            pendingCandidates.current.push(candidate);
          } else {
            try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* ignore */ }
          }
          break;
        }

        case "webrtc_decline": {
          setVideoState("declined");
          setTimeout(() => setVideoState((s) => (s === "declined" ? "off" : s)), 3000);
          break;
        }

        case "webrtc_stop": {
          closePC();
          stopStreams();
          setVideoState("off");
          break;
        }
      }
    },
    [myColor, buildPC, sendSignal, cleanup, closePC, stopStreams]
  );

  // Initiator: send video request
  const startVideo = useCallback(() => {
    setVideoState("requesting");
    sendSignal({ type: "webrtc_request" });
  }, [sendSignal]);

  // Answerer: accept incoming video request
  const acceptVideo = useCallback(async () => {
    setVideoState("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      const pc = buildPC();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      // PC is ready — tell initiator to proceed with the offer
      sendSignal({ type: "webrtc_accept" });
    } catch {
      // Camera permission denied — notify initiator
      sendSignal({ type: "webrtc_decline" });
      setVideoState("off");
    }
  }, [buildPC, sendSignal]);

  // Answerer: decline incoming video request
  const declineVideo = useCallback(() => {
    sendSignal({ type: "webrtc_decline" });
    setVideoState("off");
  }, [sendSignal]);

  // Either player: stop ongoing video
  const stopVideo = useCallback(() => {
    cleanup(true);
  }, [cleanup]);

  // Clean up PC and tracks on unmount (no STOMP signal — component is gone)
  useEffect(() => {
    return () => {
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, []);

  return {
    videoState,
    localStream,
    remoteStream,
    startVideo,
    acceptVideo,
    declineVideo,
    stopVideo,
    handleSignal,
  };
}
