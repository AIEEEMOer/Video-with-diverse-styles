"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useVideoFilter, type GachaParams } from "@/hooks/useVideoFilter";

// Types
interface Preset {
  id: string;
  name: string;
  category: "classic" | "mood" | "experimental";
  shader: string;
}

// Presets data
const PRESETS: Preset[] = [
  // Classic
  { id: "cinematic", name: "电影感", category: "classic", shader: "cinematic" },
  { id: "warm", name: "暖调", category: "classic", shader: "warm" },
  { id: "cool", name: "冷淡", category: "classic", shader: "cool" },
  { id: "vintage", name: "复古", category: "classic", shader: "vintage" },
  { id: "japanese", name: "日系", category: "classic", shader: "japanese" },
  // Mood
  { id: "cyberpunk", name: "赛博朋克", category: "mood", shader: "cyberpunk" },
  { id: "showa", name: "昭和日记", category: "mood", shader: "showa" },
  { id: "gloomy", name: "阴间滤镜", category: "mood", shader: "gloomy" },
  { id: "carnival", name: "马戏团", category: "mood", shader: "carnival" },
  { id: "morandi", name: "莫兰迪", category: "mood", shader: "morandi" },
  // Experimental
  { id: "negative", name: "负片", category: "experimental", shader: "negative" },
  { id: "single-channel", name: "单色反转", category: "experimental", shader: "singleChannel" },
  { id: "hueChaos", name: "色相错乱", category: "experimental", shader: "hueChaos" },
  { id: "rgbShift", name: "RGB错位", category: "experimental", shader: "rgbShift" },
  { id: "pixel抽离", name: "像素抽离", category: "experimental", shader: "pixel抽离" },
];

export default function Home() {
  // State
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [gacha, setGacha] = useState<{
    active: boolean;
    locked: boolean;
    params: GachaParams;
  }>({
    active: false,
    locked: false,
    params: {
      invertR: false,
      invertG: false,
      invertB: false,
      hueShift: 0,
      contrast: 1,
      saturation: 1,
      exposure: 1,
    },
  });
  const [exportFormat, setExportFormat] = useState<"mp4-h264" | "mp4-h265" | "webm">("mp4-h264");
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [showWebGL, setShowWebGL] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Use video filter hook
  const { applyPreset, applyGacha, hasEffect, exportVideo } = useVideoFilter({
    videoRef,
    canvasRef,
  });

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && ["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setVideoFile(file);
      setActivePreset(null);
      setGacha({ active: false, locked: false, params: { invertR: false, invertG: false, invertB: false, hueShift: 0, contrast: 1, saturation: 1, exposure: 1 } });
      setShowWebGL(false);
    }
  }, []);

  // Handle file select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setVideoFile(file);
      setActivePreset(null);
      setGacha({ active: false, locked: false, params: { invertR: false, invertG: false, invertB: false, hueShift: 0, contrast: 1, saturation: 1, exposure: 1 } });
      setShowWebGL(false);
    }
  };

  // Video event handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  // Play/Pause toggle
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  }, [playing]);

  // Seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Apply preset shader
  const handleApplyPreset = (presetId: string) => {
    setActivePreset(presetId);
    setGacha({ ...gacha, active: false });
    applyPreset(presetId);
    setShowWebGL(true);
  };

  // Gacha roll
  const rollGacha = useCallback(() => {
    const newParams: GachaParams = {
      invertR: Math.random() > 0.7,
      invertG: Math.random() > 0.7,
      invertB: Math.random() > 0.7,
      hueShift: Math.random() * 360,
      contrast: 0.5 + Math.random() * 1.5,
      saturation: 0.3 + Math.random() * 1.7,
      exposure: 0.5 + Math.random() * 1.5,
    };
    setGacha({ active: true, locked: false, params: newParams });
    setActivePreset(null);
    applyGacha(newParams);
    setShowWebGL(true);
  }, [applyGacha, gacha]);

  // Lock gacha
  const lockGacha = () => {
    setGacha({ ...gacha, locked: true });
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Toggle WebGL preview
  const togglePreview = () => {
    setShowWebGL(!showWebGL);
  };

  // Export video with FFmpeg
  const handleExportVideo = async () => {
    if (!videoFile) return;
    setIsExporting(true);
    setExportProgress(0);
    setFfmpegLoading(true);

    try {
      await exportVideo(videoFile, exportFormat, (p) => {
        setExportProgress(p);
      });
    } catch (err) {
      console.error("Export failed:", err);
      alert("导出失败，请重试");
    } finally {
      setIsExporting(false);
      setFfmpegLoading(false);
      setExportProgress(0);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
          break;
        case "ArrowRight":
          videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 5);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay]);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">
            VideoStyle
          </h1>
          <span className="text-gray-500 text-sm">视频调色工具</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Video Preview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Zone / Video Player */}
            {!videoSrc ? (
              <div
                className="upload-zone rounded-xl p-12 text-center"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="video-upload"
                />
                <label htmlFor="video-upload" className="cursor-pointer">
                  <div className="text-6xl mb-4">📹</div>
                  <p className="text-xl font-medium mb-2">拖拽或点击上传视频</p>
                  <p className="text-gray-500">支持 MP4、MOV、WebM，最大 500MB</p>
                </label>
              </div>
            ) : (
              <div className="video-container" ref={videoContainerRef}>
                {/* Hidden video element for playback */}
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className={showWebGL ? "hidden" : "w-full rounded-lg"}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  crossOrigin="anonymous"
                />
                {/* WebGL canvas for filtered preview */}
                <canvas
                  ref={canvasRef}
                  className={showWebGL ? "w-full rounded-lg" : "hidden"}
                />
                {/* Preview toggle */}
                {hasEffect && (
                  <div className="absolute top-3 right-3 z-10">
                    <button
                      onClick={togglePreview}
                      className="px-3 py-1.5 bg-black/60 hover:bg-black/80 rounded-lg text-sm backdrop-blur-sm transition-colors"
                    >
                      {showWebGL ? "👁 原始预览" : "✨ 滤镜预览"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Video Controls */}
            {videoSrc && (
              <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-4">
                {/* Progress bar */}
                <div className="space-y-2">
                  <input
                    type="range"
                    min={0}
                    max={videoDuration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(videoDuration)}</span>
                  </div>
                </div>

                {/* Control buttons */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlay}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors"
                  >
                    {playing ? "⏸ 暂停" : "▶ 播放"}
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">🔊</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={volume}
                      onChange={(e) => {
                        setVolume(parseFloat(e.target.value));
                        if (videoRef.current) videoRef.current.volume = parseFloat(e.target.value);
                      }}
                      className="w-24 accent-indigo-500"
                    />
                  </div>

                  <button
                    onClick={() => videoRef.current?.requestFullscreen()}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    ⛶ 全屏
                  </button>

                  <button
                    onClick={() => {
                      setVideoSrc(null);
                      setVideoFile(null);
                      setActivePreset(null);
                      setGacha({ active: false, locked: false, params: { invertR: false, invertG: false, invertB: false, hueShift: 0, contrast: 1, saturation: 1, exposure: 1 } });
                      setShowWebGL(false);
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-red-600 rounded-lg transition-colors ml-auto"
                  >
                    🗑 清除
                  </button>
                </div>
              </div>
            )}

            {/* Export Panel */}
            {videoSrc && (
              <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-4">
                <h3 className="font-medium">📦 导出设置</h3>
                <div className="flex flex-wrap gap-4">
                  {[
                    { id: "mp4-h264", label: "MP4 (H.264)", desc: "兼容性最好" },
                    { id: "mp4-h265", label: "MP4 (H.265)", desc: "体积更小" },
                    { id: "webm", label: "WebM (VP9)", desc: "无版权" },
                  ].map((format) => (
                    <label
                      key={format.id}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                        exportFormat === format.id ? "bg-indigo-600" : "bg-gray-700 hover:bg-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="exportFormat"
                        value={format.id}
                        checked={exportFormat === format.id}
                        onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}
                        className="hidden"
                      />
                      <span className="font-medium">{format.label}</span>
                      <span className="text-gray-400 text-sm">{format.desc}</span>
                    </label>
                  ))}
                </div>

                {ffmpegLoading && (
                  <div className="text-center text-sm text-indigo-400">
                    <div className="mb-2">⏳ 正在加载 FFmpeg (~25MB)，请稍候...</div>
                  </div>
                )}

                <button
                  onClick={handleExportVideo}
                  disabled={isExporting || !hasEffect}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <span>
                      {ffmpegLoading ? "加载中..." : `导出中... ${exportProgress}%`}
                    </span>
                  ) : (
                    <span>💾 导出视频</span>
                  )}
                </button>

                {!hasEffect && (
                  <p className="text-center text-xs text-gray-500">
                    请先选择滤镜效果后再导出
                  </p>
                )}

                {isExporting && !ffmpegLoading && (
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${exportProgress}%` }} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Presets & Gacha */}
          <div className="space-y-6">
            {/* Gacha Button */}
            <div className="bg-[#1a1a1a] rounded-xl p-6">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <span className="text-2xl">🎲</span> 抽卡系统
              </h3>
              <button
                onClick={rollGacha}
                disabled={!videoSrc || (gacha.active && gacha.locked)}
                className={`gacha-btn w-full py-4 rounded-xl font-bold text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {!videoSrc ? "先上传视频" : gacha.locked ? "🔒 已锁定" : "🎲 抽卡!"}
              </button>
              {gacha.active && (
                <div className="mt-4 space-y-2">
                  <p className="text-center text-sm text-gray-400 mb-3">随机效果已应用</p>
                  <div className="text-xs text-gray-500 space-y-1 bg-[#252525] rounded-lg p-3">
                    <div>对比度: {gacha.params.contrast.toFixed(2)}</div>
                    <div>饱和度: {gacha.params.saturation.toFixed(2)}</div>
                    <div>曝光: {gacha.params.exposure.toFixed(2)}</div>
                    <div>色相偏移: {gacha.params.hueShift.toFixed(0)}°</div>
                    <div>反转: {gacha.params.invertR ? "R " : ""}{gacha.params.invertG ? "G " : ""}{gacha.params.invertB ? "B" : ""}</div>
                  </div>
                  <button
                    onClick={rollGacha}
                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                  >
                    🔄 再抽一次
                  </button>
                  {!gacha.locked && (
                    <button
                      onClick={lockGacha}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm"
                    >
                      🔒 锁定效果
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Presets */}
            {["classic", "mood", "experimental"].map((category) => (
              <div key={category} className="bg-[#1a1a1a] rounded-xl p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  {category === "classic" && "🎨 经典风格"}
                  {category === "mood" && "🌙 氛围风格"}
                  {category === "experimental" && "⚠️ 脑洞风格"}
                </h3>
                <div className="grid grid-cols-2 gap-2 scrollbar-thin max-h-64 overflow-y-auto pr-1">
                  {PRESETS.filter((p) => p.category === category).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset.id)}
                      disabled={!videoSrc}
                      className={`preset-card p-3 text-left text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                        activePreset === preset.id
                          ? "bg-indigo-600 ring-2 ring-indigo-400"
                          : "bg-[#252525] hover:bg-[#333]"
                      }`}
                    >
                      <span className="block font-medium">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Active Effect Info */}
            {(activePreset || gacha.active) && (
              <div className="bg-[#1a1a1a] rounded-xl p-4">
                <h3 className="font-medium mb-2">✨ 当前效果</h3>
                <div className="text-sm text-gray-400">
                  {activePreset && PRESETS.find((p) => p.id === activePreset)?.name}
                  {gacha.active && (
                    <span className="block mt-1">
                      🎲 随机模式 {gacha.locked && "🔒"}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
