"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// Types
interface Preset {
  id: string;
  name: string;
  category: "classic" | "mood" | "experimental";
  shader: string;
}

interface GachaState {
  active: boolean;
  locked: boolean;
  params: {
    invertR: boolean;
    invertG: boolean;
    invertB: boolean;
    swapRG: boolean;
    swapRB: boolean;
    swapGB: boolean;
    hueShift: number;
    contrast: number;
    saturation: number;
    exposure: number;
  };
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
  { id: "hue-chaos", name: "色相错乱", category: "experimental", shader: "hueChaos" },
  { id: "rgb-shift", name: "RGB错位", category: "experimental", shader: "rgbShift" },
  { id: "pixel抽离", name: "像素抽离", category: "experimental", shader: "pixel抽离" },
];

// Shader generators
const SHADERS: Record<string, string> = {
  cinematic: `
    vec3 color = textureColor.rgb;
    color = pow(color, vec3(0.9));
    color = mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))), -0.2);
    color = mix(vec3(0.5), color, 1.2);
    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, textureColor.a);
  `,
  warm: `
    vec3 color = textureColor.rgb;
    color.r = color.r * 1.1;
    color.g = color.g * 1.05;
    color.b = color.b * 0.9;
    gl_FragColor = vec4(color, textureColor.a);
  `,
  cool: `
    vec3 color = textureColor.rgb;
    color.r = color.r * 0.9;
    color.g = color.g * 1.0;
    color.b = color.b * 1.1;
    gl_FragColor = vec4(color, textureColor.a);
  `,
  vintage: `
    vec3 color = textureColor.rgb;
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(gray), color, 0.7);
    color = color * vec3(1.1, 1.0, 0.9);
    gl_FragColor = vec4(color, textureColor.a);
  `,
  japanese: `
    vec3 color = textureColor.rgb;
    color = mix(color, vec3(1.05), 0.1);
    color.g = color.g * 1.02;
    gl_FragColor = vec4(color, textureColor.a);
  `,
  cyberpunk: `
    vec3 color = textureColor.rgb;
    color = pow(color, vec3(0.8));
    color.r = color.r * 1.2;
    color.b = color.b * 1.3;
    gl_FragColor = vec4(color, textureColor.a);
  `,
  showa: `
    vec3 color = textureColor.rgb;
    color = mix(color, vec3(0.9, 0.85, 0.7), 0.3);
    gl_FragColor = vec4(color, textureColor.a);
  `,
  gloomy: `
    vec3 color = textureColor.rgb;
    color = mix(color, vec3(0.3, 0.4, 0.35), 0.4);
    gl_FragColor = vec4(color, textureColor.a);
  `,
  carnival: `
    vec3 color = textureColor.rgb;
    color = pow(color, vec3(1.1));
    color.r = color.r * 1.15;
    color.g = color.g * 1.1;
    gl_FragColor = vec4(color, textureColor.a);
  `,
  morandi: `
    vec3 color = textureColor.rgb;
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(gray), color, 0.6);
    gl_FragColor = vec4(color * 0.85, textureColor.a);
  `,
  negative: `
    vec3 color = 1.0 - textureColor.rgb;
    gl_FragColor = vec4(color, textureColor.a);
  `,
  singleChannel: `
    vec3 color = textureColor.rgb;
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    gl_FragColor = vec4(vec3(gray, 1.0 - color.g, 1.0 - color.b), textureColor.a);
  `,
  hueChaos: `
    vec3 color = textureColor.rgb;
    float angle = 3.14159 * 2.0 / 3.0;
    mat3 rot = mat3(
      cos(angle), -sin(angle), 0.0,
      sin(angle), cos(angle), 0.0,
      0.0, 0.0, 1.0
    );
    color = rot * color;
    gl_FragColor = vec4(color, textureColor.a);
  `,
  rgbShift: `
    vec2 uv = vTextureCoord;
    float offset = 0.01;
    float r = texture2D(uSampler, uv + vec2(offset, 0.0)).r;
    float g = texture2D(uSampler, uv).g;
    float b = texture2D(uSampler, uv - vec2(offset, 0.0)).b;
    gl_FragColor = vec4(r, g, b, textureColor.a);
  `,
  pixel抽离: `
    vec3 color = textureColor.rgb;
    color = floor(color * 4.0) / 4.0;
    gl_FragColor = vec4(color, textureColor.a);
  `,
};

export default function Home() {
  // State
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [gacha, setGacha] = useState<GachaState>({
    active: false,
    locked: false,
    params: {
      invertR: false,
      invertG: false,
      invertB: false,
      swapRG: false,
      swapRB: false,
      swapGB: false,
      hueShift: 0,
      contrast: 1,
      saturation: 1,
      exposure: 1,
    },
  });
  const [exportFormat, setExportFormat] = useState<"mp4-h264" | "mp4-h265" | "webm">("mp4-h264");
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && ["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setVideoFile(file);
      setActivePreset(null);
      setGacha({ ...gacha, active: false });
    }
  }, [gacha]);

  // Handle file select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setVideoFile(file);
      setActivePreset(null);
      setGacha({ ...gacha, active: false });
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
  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  // Seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Apply preset shader
  const applyPreset = (presetId: string) => {
    setActivePreset(presetId);
    setGacha({ ...gacha, active: false });
    // Shader will be applied via WebGL in render
  };

  // Gacha roll
  const rollGacha = () => {
    const newParams = {
      invertR: Math.random() > 0.7,
      invertG: Math.random() > 0.7,
      invertB: Math.random() > 0.7,
      swapRG: Math.random() > 0.8,
      swapRB: Math.random() > 0.8,
      swapGB: Math.random() > 0.8,
      hueShift: Math.random() * 360,
      contrast: 0.5 + Math.random() * 1.5,
      saturation: 0.3 + Math.random() * 1.7,
      exposure: 0.5 + Math.random() * 1.5,
    };
    setGacha({ active: true, locked: false, params: newParams });
    setActivePreset(null);
  };

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

  // Export video
  const exportVideo = async () => {
    if (!videoFile) return;
    setIsExporting(true);
    setExportProgress(0);

    // Simulate export progress
    // In real implementation, this would use FFmpeg.wasm
    for (let i = 0; i <= 100; i += 5) {
      await new Promise((r) => setTimeout(r, 200));
      setExportProgress(i);
    }

    // Create download link
    const link = document.createElement("a");
    link.href = videoSrc!;
    const ext = exportFormat === "webm" ? "webm" : "mp4";
    link.download = `video-${activePreset || "gacha"}.${ext}`;
    link.click();

    setIsExporting(false);
    setExportProgress(0);
  };

  // Get current shader
  const getCurrentShader = () => {
    if (activePreset) {
      return SHADERS[activePreset] || SHADERS.cinematic;
    }
    if (gacha.active) {
      return `
        vec3 color = textureColor.rgb;
        color = mix(vec3(0.5), color, uContrast);
        color = mix(vec3(dot(color, vec3(0.299, 0.587, 0.114))), color, uSaturation);
        color = color * uExposure;
        if (uInvertR > 0.5) color.r = 1.0 - color.r;
        if (uInvertG > 0.5) color.g = 1.0 - color.g;
        if (uInvertB > 0.5) color.b = 1.0 - color.b;
        gl_FragColor = vec4(color, textureColor.a);
      `;
    }
    return "";
  };

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
                className={`upload-zone rounded-xl p-12 text-center ${!videoSrc ? "block" : "hidden"}`}
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
              <div className="video-container">
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className="w-full rounded-lg"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  crossOrigin="anonymous"
                />
                <canvas ref={canvasRef} className="hidden" />
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
                      setGacha({ active: false, locked: false, params: { invertR: false, invertG: false, invertB: false, swapRG: false, swapRB: false, swapGB: false, hueShift: 0, contrast: 1, saturation: 1, exposure: 1 } });
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

                <button
                  onClick={exportVideo}
                  disabled={isExporting}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg font-medium transition-all disabled:opacity-50"
                >
                  {isExporting ? (
                    <span>导出中... {exportProgress}%</span>
                  ) : (
                    <span>💾 导出视频</span>
                  )}
                </button>

                {isExporting && (
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
                className={`gacha-btn w-full py-4 rounded-xl font-bold text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  !videoSrc ? "bg-gray-700" : ""
                }`}
              >
                {!videoSrc ? "先上传视频" : gacha.locked ? "🔒 已锁定" : "🎲 抽卡!"}
              </button>
              {gacha.active && (
                <div className="mt-4 space-y-2">
                  <p className="text-center text-sm text-gray-400 mb-3">随机效果已应用</p>
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
                      onClick={() => applyPreset(preset.id)}
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
