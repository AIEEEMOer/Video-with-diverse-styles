"use client";

import { useRef, useCallback, useEffect, useState } from "react";

// Shader source with uniforms
const VERTEX_SHADER = `
  attribute vec2 aPosition;
  varying vec2 vTextureCoord;
  void main() {
    vTextureCoord = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const BASE_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler;
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uExposure;
  uniform float uInvertR;
  uniform float uInvertG;
  uniform float uInvertB;
  uniform float uHueShift;
  uniform float uTime;

  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec4 textureColor = texture2D(uSampler, vTextureCoord);
    vec3 color = textureColor.rgb;

    // Apply gacha params first
    color = mix(vec3(0.5), color, uContrast);
    color = mix(vec3(dot(color, vec3(0.299, 0.587, 0.114))), color, uSaturation);
    color = color * uExposure;

    if (uInvertR > 0.5) color.r = 1.0 - color.r;
    if (uInvertG > 0.5) color.g = 1.0 - color.g;
    if (uInvertB > 0.5) color.b = 1.0 - color.b;

    // Hue shift
    if (abs(uHueShift) > 0.01) {
      vec3 hsv = rgb2hsv(color);
      hsv.x = fract(hsv.x + uHueShift / 360.0);
      color = hsv2rgb(hsv);
    }

    gl_FragColor = vec4(color, textureColor.a);
  }
`;

// Shader effect code for each preset (injected after base uniforms)
const SHADER_EFFECTS: Record<string, string> = {
  cinematic: `
    color = pow(color, vec3(0.9));
    color = mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))), -0.2);
    color = mix(vec3(0.5), color, 1.2);
    color = clamp(color, 0.0, 1.0);
  `,
  warm: `
    color.r = color.r * 1.1;
    color.g = color.g * 1.05;
    color.b = color.b * 0.9;
  `,
  cool: `
    color.r = color.r * 0.9;
    color.g = color.g * 1.0;
    color.b = color.b * 1.1;
  `,
  vintage: `
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(gray), color, 0.7);
    color = color * vec3(1.1, 1.0, 0.9);
  `,
  japanese: `
    color = mix(color, vec3(1.05), 0.1);
    color.g = color.g * 1.02;
  `,
  cyberpunk: `
    color = pow(color, vec3(0.8));
    color.r = color.r * 1.2;
    color.b = color.b * 1.3;
  `,
  showa: `
    color = mix(color, vec3(0.9, 0.85, 0.7), 0.3);
  `,
  gloomy: `
    color = mix(color, vec3(0.3, 0.4, 0.35), 0.4);
  `,
  carnival: `
    color = pow(color, vec3(1.1));
    color.r = color.r * 1.15;
    color.g = color.g * 1.1;
  `,
  morandi: `
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(gray), color, 0.6);
    color = color * 0.85;
  `,
  negative: `
    color = 1.0 - color;
  `,
  singleChannel: `
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    color = vec3(gray, 1.0 - color.g, 1.0 - color.b);
  `,
  hueChaos: `
    float angle = 3.14159 * 2.0 / 3.0;
    mat3 rot = mat3(
      cos(angle), -sin(angle), 0.0,
      sin(angle), cos(angle), 0.0,
      0.0, 0.0, 1.0
    );
    color = rot * color;
  `,
  rgbShift: `
    vec2 uv = vTextureCoord;
    float offset = 0.01;
    float r = texture2D(uSampler, uv + vec2(offset, 0.0)).r;
    float g = texture2D(uSampler, uv).g;
    float b = texture2D(uSampler, uv - vec2(offset, 0.0)).b;
    color = vec3(r, g, b);
  `,
  pixel抽离: `
    color = floor(color * 4.0) / 4.0;
  `,
};

export interface GachaParams {
  invertR: boolean;
  invertG: boolean;
  invertB: boolean;
  hueShift: number;
  contrast: number;
  saturation: number;
  exposure: number;
}

interface UseVideoFilterOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

interface UseVideoFilterReturn {
  isReady: boolean;
  hasEffect: boolean;
  render: () => void;
  applyPreset: (presetId: string | null) => void;
  applyGacha: (params: GachaParams | null) => void;
  getEffectString: () => string;
  ffmpegLoading: boolean;
  ffmpegProgress: number;
  exportVideo: (
    videoFile: File,
    format: "mp4-h264" | "mp4-h265" | "webm",
    onProgress: (p: number) => void
  ) => Promise<void>;
}

export function useVideoFilter({
  videoRef,
  canvasRef,
}: UseVideoFilterOptions): UseVideoFilterReturn {
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const animationRef = useRef<number | null>(null);
  const currentPresetRef = useRef<string | null>(null);
  const gachaParamsRef = useRef<GachaParams | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasEffect, setHasEffect] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [ffmpegProgress, setFfmpegProgress] = useState(0);

  // Build shader with effect code injected
  const buildFragmentShader = useCallback((presetId: string | null): string => {
    let effectCode = "";
    if (presetId && SHADER_EFFECTS[presetId]) {
      effectCode = SHADER_EFFECTS[presetId];
    }

    // Find the "gl_FragColor" line and inject effect before it
    const baseShader = BASE_FRAGMENT_SHADER;
    const parts = baseShader.split("gl_FragColor");
    if (parts.length === 2) {
      return parts[0] + effectCode + "\n    gl_FragColor = vec4(color, textureColor.a);";
    }
    return baseShader;
  }, []);

  // Initialize WebGL
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const gl = canvas.getContext("webgl", {
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }
    glRef.current = gl;

    // Create vertex buffer (fullscreen quad)
    const vertices = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Create texture
    const texture = gl.createTexture();
    textureRef.current = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Compile initial shader (no effect)
    compileShader(null);

    setIsReady(true);
  }, [canvasRef, videoRef]);

  // Compile shader program
  const compileShader = useCallback((presetId: string | null) => {
    const gl = glRef.current;
    if (!gl) return;

    // Compile vertex shader
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERTEX_SHADER);
    gl.compileShader(vs);

    // Build fragment shader
    const fragmentSource = buildFragmentShader(presetId);
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fragmentSource);
    gl.compileShader(fs);

    // Link program
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Shader link error:", gl.getProgramInfoLog(program));
      return;
    }

    // Use program
    gl.useProgram(program);

    // Set up attribute
    const posLoc = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Set up uniforms
    gl.uniform1i(gl.getUniformLocation(program, "uSampler"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "uContrast"), 1.0);
    gl.uniform1f(gl.getUniformLocation(program, "uSaturation"), 1.0);
    gl.uniform1f(gl.getUniformLocation(program, "uExposure"), 1.0);
    gl.uniform1f(gl.getUniformLocation(program, "uInvertR"), 0.0);
    gl.uniform1f(gl.getUniformLocation(program, "uInvertG"), 0.0);
    gl.uniform1f(gl.getUniformLocation(program, "uInvertB"), 0.0);
    gl.uniform1f(gl.getUniformLocation(program, "uHueShift"), 0.0);
    gl.uniform1f(gl.getUniformLocation(program, "uTime"), 0.0);

    programRef.current = program;
  }, [buildFragmentShader]);

  // Render a single frame
  const renderFrame = useCallback(() => {
    const gl = glRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!gl || !video || !canvas || !programRef.current) return;

    // Sync canvas size to video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    // Update video texture
    gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    // Update uniforms if gacha is active
    const gacha = gachaParamsRef.current;
    if (gacha) {
      gl.uniform1f(gl.getUniformLocation(programRef.current, "uContrast"), gacha.contrast);
      gl.uniform1f(gl.getUniformLocation(programRef.current, "uSaturation"), gacha.saturation);
      gl.uniform1f(gl.getUniformLocation(programRef.current, "uExposure"), gacha.exposure);
      gl.uniform1f(gl.getUniformLocation(programRef.current, "uInvertR"), gacha.invertR ? 1.0 : 0.0);
      gl.uniform1f(gl.getUniformLocation(programRef.current, "uInvertG"), gacha.invertG ? 1.0 : 0.0);
      gl.uniform1f(gl.getUniformLocation(programRef.current, "uInvertB"), gacha.invertB ? 1.0 : 0.0);
      gl.uniform1f(gl.getUniformLocation(programRef.current, "uHueShift"), gacha.hueShift);
    }

    // Draw
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [videoRef, canvasRef]);

  // Animation loop
  const startLoop = useCallback(() => {
    const loop = () => {
      renderFrame();
      animationRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, [renderFrame]);

  const stopLoop = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // Render once (for thumbnails)
  const render = useCallback(() => {
    renderFrame();
  }, [renderFrame]);

  // Apply preset
  const applyPreset = useCallback((presetId: string | null) => {
    currentPresetRef.current = presetId;
    gachaParamsRef.current = null;
    compileShader(presetId);
    setHasEffect(presetId !== null);
  }, [compileShader]);

  // Apply gacha params
  const applyGacha = useCallback((params: GachaParams | null) => {
    gachaParamsRef.current = params;
    if (params) {
      currentPresetRef.current = null;
      // For gacha, we use base shader with uniform params
      compileShader(null);
    }
    setHasEffect(params !== null);
  }, [compileShader]);

  // Get current effect string for export
  const getEffectString = useCallback(() => {
    return currentPresetRef.current || (gachaParamsRef.current ? "gacha" : "");
  }, []);

  // FFmpeg export
  const exportVideo = useCallback(async (
    videoFile: File,
    format: "mp4-h264" | "mp4-h265" | "webm",
    onProgress: (p: number) => void
  ) => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { fetchFile, toBlobURL } = await import("@ffmpeg/util");

    const ffmpeg = new FFmpeg();

    setFfmpegLoading(true);
    setFfmpegProgress(0);
    onProgress(0);

    // Load FFmpeg with progress
    ffmpeg.on("progress", ({ progress }) => {
      const p = Math.round(progress * 100);
      setFfmpegProgress(p);
      onProgress(p);
    });

    // Load from CDN
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    setFfmpegLoading(false);
    onProgress(100);

    // Write input file
    const inputData = await fetchFile(videoFile);
    await ffmpeg.writeFile("input.mp4", inputData);

    // Build FFmpeg filter based on current effect
    let ffmpegFilter = "";
    const preset = currentPresetRef.current;
    const gacha = gachaParamsRef.current;

    if (preset) {
      switch (preset) {
        case "negative":
          ffmpegFilter = "negate";
          break;
        case "warm":
          ffmpegFilter = "eq=contrast=1.05:saturation=1.1";
          break;
        case "cool":
          ffmpegFilter = "eq=contrast=1.0:saturation=0.95:brightness=-0.05";
          break;
        case "vintage":
          ffmpegFilter = "eq=contrast=1.1:saturation=0.7:brightness=0.05";
          break;
        case "cinematic":
          ffmpegFilter = "eq=contrast=1.2:brightness=-0.05";
          break;
        case "cyberpunk":
          ffmpegFilter = "eq=contrast=1.3:saturation=1.2:brightness=0.05";
          break;
        case "showa":
          ffmpegFilter = "colorbalance=rs=0.3:gs=0.2:bs=0.1";
          break;
        case "gloomy":
          ffmpegFilter = "colorbalance=rs=-0.2:gs=-0.1:bs=-0.1";
          break;
        case "carnival":
          ffmpegFilter = "eq=contrast=1.15:saturation=1.25";
          break;
        case "morandi":
          ffmpegFilter = "eq=contrast=0.9:saturation=0.6";
          break;
        case "japanese":
          ffmpegFilter = "eq=contrast=1.02:saturation=1.05:brightness=0.03";
          break;
        case "hueChaos":
          ffmpegFilter = "hue=h=120";
          break;
        case "rgbShift":
          ffmpegFilter = "vidstabtransform=shakiness=5:accuracy=15";
          break;
        case "pixel抽离":
          ffmpegFilter = "scale=iw/4:ih/4,scale=iw*4:ih*4";
          break;
        default:
          ffmpegFilter = "";
      }
    } else if (gacha) {
      const parts: string[] = [];
      if (Math.abs(gacha.contrast - 1) > 0.05) parts.push(`contrast=${gacha.contrast.toFixed(2)}`);
      if (Math.abs(gacha.saturation - 1) > 0.05) parts.push(`saturation=${gacha.saturation.toFixed(2)}`);
      if (Math.abs(gacha.exposure - 1) > 0.05) parts.push(`brightness=${((gacha.exposure - 1) * 0.5).toFixed(2)}`);
      if (gacha.invertR) parts.push("negate=components=0");
      if (gacha.invertG) parts.push("negate=components=1");
      if (gacha.invertB) parts.push("negate=components=2");
      if (Math.abs(gacha.hueShift) > 5) parts.push(`hue=h=${(gacha.hueShift / 360).toFixed(2)}`);
      ffmpegFilter = parts.length > 0 ? `eq=${parts.join(":")}` : "";
    }

    // Build output args
    let outputFile = "output.mp4";
    let outputArgs: string[] = [];

    if (format === "webm") {
      outputFile = "output.webm";
      outputArgs = ["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0"];
    } else if (format === "mp4-h265") {
      outputFile = "output.mp4";
      outputArgs = ["-c:v", "libx265", "-crf", "28"];
    } else {
      outputFile = "output.mp4";
      outputArgs = ["-c:v", "libx264", "-crf", "23"];
    }

    // Run FFmpeg
    const args = ffmpegFilter
      ? ["-i", "input.mp4", "-vf", ffmpegFilter, ...outputArgs, "-c:a", "copy", outputFile]
      : ["-i", "input.mp4", ...outputArgs, "-c:a", "copy", outputFile];

    await ffmpeg.exec(args);

    // Read output
    const data = await ffmpeg.readFile(outputFile);
    // Copy to a new buffer to satisfy TypeScript's strict Blob type check
    const uint8 = data as Uint8Array;
    const buffer = new ArrayBuffer(uint8.length);
    new Uint8Array(buffer).set(uint8);
    const blob = new Blob([buffer], {
      type: format === "webm" ? "video/webm" : "video/mp4",
    });

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ext = format === "webm" ? "webm" : "mp4";
    a.download = `video-${getEffectString() || "filtered"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);

    // Cleanup
    await ffmpeg.deleteFile("input.mp4");
    await ffmpeg.deleteFile(outputFile);
  }, [getEffectString]);

  // Initialize WebGL on mount
  useEffect(() => {
    // Small delay to ensure refs are set
    const timer = setTimeout(() => {
      initWebGL();
    }, 100);
    return () => {
      clearTimeout(timer);
      stopLoop();
    };
  }, [initWebGL, stopLoop]);

  // Sync video play state with render loop
  useEffect(() => {
    if (!isReady) return;
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => startLoop();
    const handlePause = () => stopLoop();
    const handleEnded = () => stopLoop();

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    // If video is already playing, start loop
    if (!video.paused) {
      startLoop();
    }

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, [isReady, videoRef, startLoop, stopLoop]);

  return {
    isReady,
    hasEffect,
    render,
    applyPreset,
    applyGacha,
    getEffectString,
    ffmpegLoading,
    ffmpegProgress,
    exportVideo,
  };
}
