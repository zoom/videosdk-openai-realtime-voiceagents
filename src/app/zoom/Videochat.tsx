"use client";

import { CSSProperties, useRef, useState } from "react";
import ZoomVideo, { type VideoClient, VideoQuality, type VideoPlayer } from "@zoom/videosdk";
import { CameraButton, MicButton } from "./MuteButtons";
import { PhoneOff } from "lucide-react";

const Videochat = (props: { slug: string; JWT: string }) => {
  const session = props.slug;
  const jwt = props.JWT;
  const [inSession, setInSession] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const client = useRef<typeof VideoClient>(ZoomVideo.createClient());
  const [isVideoMuted, setIsVideoMuted] = useState(!client.current.getCurrentUserInfo()?.bVideoOn);
  const [isAudioMuted, setIsAudioMuted] = useState(client.current.getCurrentUserInfo()?.muted ?? true);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const joinSession = async () => {
    setLoading(true);
    await client.current.init("en-US", "Global", { patchJsMedia: true });
    client.current.on("peer-video-state-change", renderVideo);
    await client.current.join(session, jwt, userName).catch((e) => console.log(e));
    setInSession(true);
    const mediaStream = client.current.getMediaStream();
    await mediaStream.startAudio();
    setIsAudioMuted(mediaStream.isAudioMuted());
    await mediaStream.startVideo();
    setIsVideoMuted(!mediaStream.isCapturingVideo());
    await renderVideo({ action: "Start", userId: client.current.getCurrentUserInfo().userId, });
    setLoading(false);
  };

  const renderVideo = async (event: { action: "Start" | "Stop"; userId: number; }) => {
    const mediaStream = client.current.getMediaStream();
    if (event.action === "Stop") {
      const element = await mediaStream.detachVideo(event.userId);
      if (Array.isArray(element)) element.forEach((el) => el.remove())
      else element.remove();
    } else {
      const userVideo = await mediaStream.attachVideo(event.userId, VideoQuality.Video_360P);
      videoContainerRef.current!.appendChild(userVideo as VideoPlayer);
    }
  };

  const leaveSession = async () => {
    client.current.off("peer-video-state-change", renderVideo);
    await client.current.leave().catch((e) => console.log("leave error", e));
    // hard refresh to clear the state
    window.location.href = "/";
  };

  return (
    <div className="flex flex-1 w-full flex-col min-h-0">
      <div className="flex w-full flex-1 min-h-0" style={inSession ? {} : { display: "none" }}      >
        {/* @ts-expect-error html component */}
        <video-player-container ref={videoContainerRef} style={videoPlayerStyle} />
      </div>
      {!inSession ? (
        <div className="mx-auto flex my-auto w-64 flex-col self-center">
          <div className="w-4" />
          <button onClick={joinSession} title="join session" disabled={isLoading} className="hover:bg-gray-300 bg-gray-200 h-10  rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50">
            {isLoading ? "Joining" : "Join Video"}
          </button>
        </div>
      ) : (
        <div className="flex w-full flex-col justify-around self-center absolute bottom-5 opacity-80">
          <div className="mt-2 flex w-[30rem] flex-1 justify-around self-center rounded-md bg-white p-4">
            <CameraButton
              client={client}
              isVideoMuted={isVideoMuted}
              setIsVideoMuted={setIsVideoMuted}
              renderVideo={renderVideo}
            />
            <MicButton
              isAudioMuted={isAudioMuted}
              client={client}
              setIsAudioMuted={setIsAudioMuted}
            />
            <button onClick={leaveSession} title="leave session">
              <PhoneOff />
            </button>
          </div>
        </div>
      )
      }
    </div >
  );
};

export default Videochat;

const videoPlayerStyle = {
  width: "100%",
  height: "100%",
  alignContent: "center",
  overflow: "hidden",
} as CSSProperties;

const userName = `User-${new Date().getTime().toString().slice(8)}`;
