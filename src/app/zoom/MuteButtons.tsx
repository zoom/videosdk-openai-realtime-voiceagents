import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { event_current_audio_change, event_video_capturing_change, VideoClient } from "@zoom/videosdk";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

const MicButton = (props: {
  client: RefObject<typeof VideoClient>;
  isAudioMuted: boolean;
  setIsAudioMuted: Dispatch<SetStateAction<boolean>>;
}) => {
  const { client, isAudioMuted, setIsAudioMuted } = props;
  const handleAudioStatus: typeof event_current_audio_change = (e) => {
    if (e.action === 'muted') {
      setIsAudioMuted(true)
    } else if (e.action === 'unmuted') {
      setIsAudioMuted(false)
    }
  };
  useEffect(() => {
    client.current.on('current-audio-change', handleAudioStatus)
    return () => {
      client.current.off('current-audio-change', handleAudioStatus)
    }
  }, [])
  const onMicrophoneClick = async () => {
    const mediaStream = client.current.getMediaStream();
    if (isAudioMuted)
      await mediaStream?.unmuteAudio()
    else
      await mediaStream?.muteAudio();
  };
  return (
    <button onClick={onMicrophoneClick} title="microphone">
      {isAudioMuted ? <MicOff /> : <Mic />}
    </button>
  );
};

const CameraButton = (props: {
  client: RefObject<typeof VideoClient>;
  isVideoMuted: boolean;
  setIsVideoMuted: Dispatch<SetStateAction<boolean>>;
  renderVideo: (event: {
    action: "Start" | "Stop";
    userId: number;
  }) => Promise<void>;
}) => {
  const { client, isVideoMuted, setIsVideoMuted, renderVideo } = props;
  const handleVideoStatus: typeof event_video_capturing_change = (e) => {
    if (e.state === 'Started') {
      setIsVideoMuted(false)
    } else if (e.state === 'Stopped') {
      setIsVideoMuted(true)
    }
  };
  useEffect(() => {
    client.current.on('video-capturing-change', handleVideoStatus)
    return () => {
      client.current.off('video-capturing-change', handleVideoStatus)
    }
  }, [])
  const onCameraClick = async () => {
    const mediaStream = client.current.getMediaStream();
    if (isVideoMuted) {
      await mediaStream.startVideo();
      await renderVideo({
        action: "Start",
        userId: client.current.getCurrentUserInfo().userId,
      });
    } else {
      await mediaStream.stopVideo();
      await renderVideo({
        action: "Stop",
        userId: client.current.getCurrentUserInfo().userId,
      });
    }
  };

  return (
    <button onClick={onCameraClick} title="camera">
      {isVideoMuted ? <VideoOff /> : <Video />}
    </button>
  );
};

export { MicButton, CameraButton };
