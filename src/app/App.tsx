"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Transcript from "./components/Transcript";
import Events from "./components/Events";
import BottomToolbar from "./components/BottomToolbar";
import { SessionStatus } from "@/app/types";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";
import { chatSupervisorScenario } from "@/app/agentConfigs/chatSupervisor";
import { chatSupervisorCompanyName } from "@/app/agentConfigs/chatSupervisor";
import { useHandleSessionHistory } from "./hooks/useHandleSessionHistory";
import VideochatClientWrapper from "./zoom/VideochatClientWrapper";
import type { VideoClient } from '@zoom/videosdk';

function App({ jwt }: { jwt: string }) {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
  const [isEventsPaneExpanded, setIsEventsPaneExpanded] = useState<boolean>(false);
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(true);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(true);
  const { addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const clientRef = useRef<typeof VideoClient>(null);

  const { connect, disconnect, sendUserText, sendEvent, interrupt, mute, } = useRealtimeSession({
    onConnectionChange: (s) => { console.log('onConnectionChange', s); setSessionStatus(s as SessionStatus) },
  });

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  // Attach SDK audio element once it exists (after first render in browser)
  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  // Initialize the recording hook.
  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    try {
      sendEvent(eventObj);
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
  };

  useHandleSessionHistory();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@zoom/videosdk').then(({ default: ZoomVideo, ConnectionState }) => {
        const client = ZoomVideo.createClient();
        clientRef.current = client;
        client.on('connection-change', (e) => {
          if (e.state === ConnectionState.Connected) {
            // openai sdk is not connected 
            if (sessionStatus === "DISCONNECTED") {
              connectToRealtime()
            }
          }
          if (e.state === ConnectionState.Closed) {
            disconnectFromRealtime()
          }
        });
      }).catch((error) => {
        console.error('Failed to load Zoom Video SDK:', error);
      });
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      console.log('update session')
      updateSession();
    }
  }, [isPTTActive, sessionStatus]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    if (sessionStatus !== "DISCONNECTED") return;
    setSessionStatus("CONNECTING");
    try {
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) return;

      const companyName = chatSupervisorCompanyName;
      const guardrail = createModerationGuardrail(companyName);

      await connect({
        getEphemeralKey: async () => EPHEMERAL_KEY,
        initialAgent: chatSupervisorScenario,
        audioElement: sdkAudioElement,
        outputGuardrails: [guardrail],
        extraContext: {
          addTranscriptBreadcrumb,
        },
      });
    } catch (err) {
      console.error("Error connecting via SDK:", err);
      setSessionStatus("DISCONNECTED");
    }
    return;
  };

  const disconnectFromRealtime = () => {
    disconnect();
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);
  };

  const updateSession = () => {
    // Reflect Push-to-Talk UI state by (de)activating server VAD on the
    // backend. The Realtime SDK supports live session updates via the
    // `session.update` event.
    const turnDetection = isPTTActive
      ? null
      : {
        type: 'server_vad',
        threshold: 0.9,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
        create_response: true,
      };

    sendEvent({
      type: 'session.update',
      session: {
        turn_detection: turnDetection,
      },
    });
    return;
  }

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    interrupt();
    try {
      sendUserText(userText.trim());
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
    setUserText("");
  };

  const handleTalkButtonDown = () => {
    if (sessionStatus !== 'CONNECTED') return;
    if (clientRef.current) {
      const stream = clientRef.current.getMediaStream();
      stream.muteAudio()
    }
    interrupt();
    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: 'input_audio_buffer.clear' }, 'clear PTT buffer');
  };

  const handleTalkButtonUp = () => {
    if (sessionStatus !== 'CONNECTED' || !isPTTUserSpeaking)
      return;
    if (clientRef.current) {
      const stream = clientRef.current.getMediaStream();
      stream.unmuteAudio()
    }
    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: 'input_audio_buffer.commit' }, 'commit PTT');
    sendClientEvent({ type: 'response.create' }, 'trigger response PTT');
  };

  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        // Mute and pause to avoid brief audio blips before pause takes effect.
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }

    // Toggle server-side audio stream mute so bandwidth is saved when the
    // user disables playback. 
    try {
      mute(!isAudioPlaybackEnabled);
    } catch (err) {
      console.warn('Failed to toggle SDK mute', err);
    }
  }, [isAudioPlaybackEnabled]);

  // Ensure mute state is propagated to transport right after we connect or
  // whenever the SDK client reference becomes available.
  useEffect(() => {
    if (sessionStatus === 'CONNECTED') {
      try {
        mute(!isAudioPlaybackEnabled);
      } catch (err) {
        console.warn('mute sync after connect failed', err);
      }
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);

  return (
    <div className="text-base flex flex-col h-screen bg-gray-100 text-gray-800 relative">
      <div className="flex items-center cursor-pointer p-2 text-lg font-semibold flex justify-between items-center text-center m-auto" onClick={() => window.location.reload()}        >
        <div>
          <Image
            src="/Zoom-Logo.png"
            alt="OpenAI Logo"
            width={70}
            height={20}
            className="mr-2"
          />
        </div>
        <div className="mr-2">Video SDK x</div>
        <div>
          <Image
            src="/openai-logomark.svg"
            alt="OpenAI Logo"
            width={20}
            height={20}
            className="mr-2"
          />
        </div>
        <div>
          OpenAI Realtime Agents Demo
        </div>
      </div>
      <div className="flex flex-col flex-1 gap-2 px-2 overflow-hidden relative">
        <div className="flex flex-1 flex-row  gap-2 px-2 overflow-hidden relative">
          <div className="flex flex-row flex-1 gap-2 px-2 overflow-hidden relative">
            <VideochatClientWrapper slug={"test"} JWT={jwt} />
          </div>
          <div className="flex flex-row flex-1/3 gap-2 px-2 overflow-hidden relative">
            <Transcript
              userText={userText}
              setUserText={setUserText}
              onSendMessage={handleSendTextMessage}
              canSend={sessionStatus === "CONNECTED"}
            />
            <Events isExpanded={isEventsPaneExpanded} />
          </div>
        </div>
        <BottomToolbar
          sessionStatus={sessionStatus}
          isPTTActive={isPTTActive}
          setIsPTTActive={setIsPTTActive}
          isPTTUserSpeaking={isPTTUserSpeaking}
          handleTalkButtonDown={handleTalkButtonDown}
          handleTalkButtonUp={handleTalkButtonUp}
          isEventsPaneExpanded={isEventsPaneExpanded}
          setIsEventsPaneExpanded={setIsEventsPaneExpanded}
          isAudioPlaybackEnabled={isAudioPlaybackEnabled}
          setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
        />
      </div>
    </div>
  );
}

export default App;
