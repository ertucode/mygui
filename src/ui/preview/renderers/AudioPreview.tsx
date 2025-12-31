import { useState, useEffect, useRef } from "react";
import {
  Music2Icon,
  PlayIcon,
  PauseIcon,
  UserIcon,
  DiscIcon,
  CalendarIcon,
} from "lucide-react";
import { PreviewHelpers } from "../PreviewHelpers";
import { PathHelpers } from "@common/PathHelpers";
import { getWindowElectron } from "@/getWindowElectron";
import type { AudioMetadata as BackendAudioMetadata } from "@common/Contracts";

type AudioMetadata = BackendAudioMetadata & {
  duration: number; // Make duration required for UI
};

export function AudioPreview({
  data: { fullPath, preview },
}: PreviewHelpers.PreviewRendererProps) {
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const src = `file://${fullPath}`;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setMetadata((prev) => ({
        ...(prev || {}),
        duration: audio.duration,
      }));
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Read audio metadata from backend
  useEffect(() => {
    const readMetadata = async () => {
      try {
        const result = await getWindowElectron().getAudioMetadata(fullPath);

        if ("error" in result) {
          console.error("Error reading audio metadata:", result.error);
          return;
        }

        setMetadata((prev) => ({
          duration: prev?.duration || result.duration || 0,
          title: result.title,
          artist: result.artist,
          album: result.album,
          year: result.year,
          genre: result.genre,
          bitrate: result.bitrate,
          sampleRate: result.sampleRate,
          numberOfChannels: result.numberOfChannels,
          picture: result.picture,
        }));
      } catch (error) {
        console.error("Error reading audio metadata:", error);
      }
    };

    readMetadata();
  }, [fullPath]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    const mb = bytes / 1024 / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(2)} KB`;
  };

  const formatBitrate = (bitrate?: number) => {
    if (!bitrate) return null;
    return `${Math.round(bitrate / 1000)} kbps`;
  };

  const fileName = PathHelpers.getLastPathPart(fullPath);
  const fileExt = preview.fileExt?.toUpperCase().replace(".", "") || "AUDIO";

  // Use title from metadata or fall back to filename
  const displayTitle = metadata?.title || fileName;
  const displayArtist = metadata?.artist;
  const displayAlbum = metadata?.album;

  // Convert base64 picture to data URL if available
  const albumArtUrl = metadata?.picture
    ? `data:${metadata.picture.format};base64,${metadata.picture.data}`
    : null;

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {error ? (
        <div className="flex-1 flex items-center justify-center text-red-500 p-4 text-center">
          <div>
            <Music2Icon className="size-8 mx-auto mb-2" />
            <div>{error}</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto bg-base-200 rounded-xl flex flex-col items-center justify-center p-6 gap-6">
          {/* Album Art or Audio Icon */}
          {albumArtUrl ? (
            <div className="w-48 h-48 rounded-lg overflow-hidden shadow-lg">
              <img
                src={albumArtUrl}
                alt="Album art"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="bg-base-300 rounded-full p-8">
              <Music2Icon className="size-24 text-primary" />
            </div>
          )}

          {/* File Info */}
          <div className="text-center max-w-md w-full space-y-1">
            <h2 className="text-xl font-bold truncate" title={displayTitle}>
              {displayTitle}
            </h2>
            {displayArtist && (
              <div className="text-base text-gray-600 dark:text-gray-400 truncate flex items-center justify-center gap-1">
                <UserIcon className="size-4" />
                {displayArtist}
              </div>
            )}
            {displayAlbum && (
              <div className="text-sm text-gray-500 truncate flex items-center justify-center gap-1">
                <DiscIcon className="size-3.5" />
                {displayAlbum}
              </div>
            )}
            <div className="text-xs text-gray-500 pt-1">
              {fileExt} • {formatFileSize(preview.fileSize)}
              {metadata?.bitrate && ` • ${formatBitrate(metadata.bitrate)}`}
            </div>
          </div>

          {/* Metadata Grid */}
          {metadata && (
            <div className="grid grid-cols-2 gap-4 text-sm bg-base-300 rounded-lg p-4 w-full max-w-md">
              <div>
                <div className="text-gray-500 text-xs">Duration</div>
                <div className="font-medium">
                  {formatTime(metadata.duration)}
                </div>
              </div>
              {metadata.sampleRate && (
                <div>
                  <div className="text-gray-500 text-xs">Sample Rate</div>
                  <div className="font-medium">
                    {(metadata.sampleRate / 1000).toFixed(1)} kHz
                  </div>
                </div>
              )}
              {metadata.numberOfChannels && (
                <div>
                  <div className="text-gray-500 text-xs">Channels</div>
                  <div className="font-medium">
                    {metadata.numberOfChannels === 1 ? "Mono" : "Stereo"}
                  </div>
                </div>
              )}
              {metadata.year && (
                <div>
                  <div className="text-gray-500 text-xs flex items-center gap-1">
                    <CalendarIcon className="size-3" />
                    Year
                  </div>
                  <div className="font-medium">{metadata.year}</div>
                </div>
              )}
              {metadata.genre && metadata.genre.length > 0 && (
                <div className="col-span-2">
                  <div className="text-gray-500 text-xs">Genre</div>
                  <div className="font-medium truncate">
                    {metadata.genre.join(", ")}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audio Player */}
          <div className="w-full max-w-md space-y-3">
            {/* Play/Pause Button */}
            <div className="flex justify-center">
              <button
                onClick={togglePlayPause}
                className="btn btn-circle btn-primary btn-lg"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <PauseIcon className="size-6" />
                ) : (
                  <PlayIcon className="size-6 ml-0.5" />
                )}
              </button>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max={metadata?.duration || 100}
                value={currentTime}
                onChange={(e) => {
                  const time = parseFloat(e.target.value);
                  setCurrentTime(time);
                  if (audioRef.current) {
                    audioRef.current.currentTime = time;
                  }
                }}
                className="range range-primary range-xs w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(metadata?.duration || 0)}</span>
              </div>
            </div>

            {/* Native audio element (hidden) */}
            <audio
              ref={audioRef}
              src={src}
              onError={() =>
                setError("Failed to load audio. Format may not be supported.")
              }
              className="hidden"
            />
          </div>
        </div>
      )}
    </div>
  );
}
