import * as THREE from 'three';
import type { AtmospherePreset } from '../types';

export type PostVisualLook = 'filmic' | 'mono' | 'lianhuanhua';

interface AtmoGradeParams {
  threshold: number;
  bloomStrength: number;
  vignette: number;
  grain: number;
  warmth: [number, number, number];
}

const ATMO_GRADE: Record<AtmospherePreset, AtmoGradeParams> = {
  night: {
    threshold: 0.72,
    bloomStrength: 0.42,
    vignette: 0.22,
    grain: 0.015,
    warmth: [1.08, 0.96, 0.80],
  },
  curfew_amber: {
    threshold: 0.68,
    bloomStrength: 0.44,
    vignette: 0.24,
    grain: 0.016,
    warmth: [1.10, 0.92, 0.72],
  },
  rain_overcast: {
    threshold: 0.68,
    bloomStrength: 0.36,
    vignette: 0.20,
    grain: 0.014,
    warmth: [0.98, 1.00, 1.06],
  },
  dusk_warm: {
    threshold: 0.80,
    bloomStrength: 0.30,
    vignette: 0.18,
    grain: 0.012,
    warmth: [1.06, 0.96, 0.84],
  },
  dawn: {
    threshold: 0.90,
    bloomStrength: 0.18,
    vignette: 0.12,
    grain: 0.009,
    warmth: [1.04, 0.98, 0.90],
  },
  day_spring: {
    threshold: 0.92,
    bloomStrength: 0.16,
    vignette: 0.10,
    grain: 0.008,
    warmth: [1.03, 0.99, 0.93],
  },
  aftermath: {
    threshold: 0.88,
    bloomStrength: 0.16,
    vignette: 0.16,
    grain: 0.012,
    warmth: [0.98, 0.99, 1.01],
  },
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Pass 1: Bright-extract + 9-tap horizontal Gaussian blur in half-resolution RT
const BRIGHT_BLUR_FRAG = /* glsl */ `
precision mediump float;
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;

vec3 extractBright(vec2 uv) {
  vec3 c = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb;
  float luma = dot(c, vec3(0.299, 0.587, 0.114));
  float soft = clamp((luma - uThreshold) / 0.38, 0.0, 1.0);
  float excess = max(0.0, luma - uThreshold * 0.82);
  return c * (soft * 0.65 + excess * 0.75);
}

void main() {
  float off = 1.6;
  vec3 sum = extractBright(vUv) * 0.227027;
  sum += extractBright(vUv + vec2(uTexel.x * 1.2 * off, 0.0)) * 0.194595;
  sum += extractBright(vUv - vec2(uTexel.x * 1.2 * off, 0.0)) * 0.194595;
  sum += extractBright(vUv + vec2(uTexel.x * 2.6 * off, 0.0)) * 0.121622;
  sum += extractBright(vUv - vec2(uTexel.x * 2.6 * off, 0.0)) * 0.121622;
  sum += extractBright(vUv + vec2(uTexel.x * 4.2 * off, 0.0)) * 0.070270;
  sum += extractBright(vUv - vec2(uTexel.x * 4.2 * off, 0.0)) * 0.070270;
  gl_FragColor = vec4(min(sum, vec3(2.8)), 1.0);
}
`;

// Pass 2: Vertical bloom blur + ACES Filmic tone mapping + optical halation/vignette + film look + micro-grain
const COMPOSITE_FRAG = /* glsl */ `
precision mediump float;
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform vec2 uBloomTexel;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform float uLook;
uniform vec3 uWarmth;
varying vec2 vUv;

vec3 acesFilmic(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 base = texture2D(tDiffuse, vUv).rgb;

  float off = 1.65;
  vec3 bloom = texture2D(tBloom, vUv).rgb * 0.227027;
  bloom += texture2D(tBloom, clamp(vUv + vec2(0.0, uBloomTexel.y * 1.2 * off), 0.001, 0.999)).rgb * 0.194595;
  bloom += texture2D(tBloom, clamp(vUv - vec2(0.0, uBloomTexel.y * 1.2 * off), 0.001, 0.999)).rgb * 0.194595;
  bloom += texture2D(tBloom, clamp(vUv + vec2(0.0, uBloomTexel.y * 2.6 * off), 0.001, 0.999)).rgb * 0.121622;
  bloom += texture2D(tBloom, clamp(vUv - vec2(0.0, uBloomTexel.y * 2.6 * off), 0.001, 0.999)).rgb * 0.121622;
  bloom += texture2D(tBloom, clamp(vUv + vec2(0.0, uBloomTexel.y * 4.2 * off), 0.001, 0.999)).rgb * 0.070270;
  bloom += texture2D(tBloom, clamp(vUv - vec2(0.0, uBloomTexel.y * 4.2 * off), 0.001, 0.999)).rgb * 0.070270;

  vec3 hdr = base + bloom * uBloomStrength * uWarmth;
  vec3 col = acesFilmic(hdr * uExposure);
  col = pow(col, vec3(1.0 / 2.2));

  // Optical vignette
  vec2 centered = vUv - 0.5;
  float r2 = dot(centered, centered);
  col *= 1.0 - smoothstep(0.18, 0.72, r2) * uVignette;

  // Look color grading: 0 = filmic, 1 = silver-gelatin mono, 2 = warm paper lianhuanhua
  if (uLook > 0.5 && uLook < 1.5) {
    float g = dot(col, vec3(0.28, 0.60, 0.12));
    g = smoothstep(0.04, 0.96, g);
    col = vec3(g * 1.01, g * 0.99, g * 0.94);
  } else if (uLook >= 1.5) {
    float g = dot(col, vec3(0.32, 0.56, 0.12));
    col = mix(col, vec3(g * 1.06, g * 0.98, g * 0.84), 0.36);
  }

  // Subtle organic celluloid grain
  float n = hash12(vUv * 640.0 + vec2(uTime * 19.3, uTime * 7.7)) - 0.5;
  col = clamp(col + n * uGrain, 0.0, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Lightweight 2-pass renderer-level filmic bloom + ACES composite pipeline (+2 draw calls total, zero per-scene GPU leak).
 */
export class FilmicPostProcessor {
  private enabled: boolean;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private sceneRT: THREE.WebGLRenderTarget;
  private bloomRT: THREE.WebGLRenderTarget;
  private readonly quadGeo: THREE.PlaneGeometry;
  private readonly quadCam: THREE.OrthographicCamera;
  private readonly quadScene: THREE.Scene;
  private readonly quadMesh: THREE.Mesh;
  private readonly brightBlurMat: THREE.ShaderMaterial;
  private readonly compositeMat: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer, enabled = true) {
    this.enabled = enabled;
    const gl = renderer.getContext();
    const canHalfFloatRT =
      renderer.capabilities.isWebGL2 &&
      Boolean(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    const rtType = canHalfFloatRT ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.sceneRT = new THREE.WebGLRenderTarget(2, 2, {
      type: rtType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
    });
    this.bloomRT = new THREE.WebGLRenderTarget(2, 2, {
      type: rtType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });

    this.quadGeo = new THREE.PlaneGeometry(2, 2);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();

    this.brightBlurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.sceneRT.texture },
        uTexel: { value: new THREE.Vector2(0.001, 0.001) },
        uThreshold: { value: 0.72 },
      },
      vertexShader: VERT,
      fragmentShader: BRIGHT_BLUR_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.sceneRT.texture },
        tBloom: { value: this.bloomRT.texture },
        uBloomTexel: { value: new THREE.Vector2(0.002, 0.002) },
        uBloomStrength: { value: 0.40 },
        uExposure: { value: 1.08 },
        uVignette: { value: 0.20 },
        uGrain: { value: 0.014 },
        uTime: { value: 0 },
        uLook: { value: 0 },
        uWarmth: { value: new THREE.Vector3(1.06, 0.96, 0.82) },
      },
      vertexShader: VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.quadMesh = new THREE.Mesh(this.quadGeo, this.brightBlurMat);
    this.quadMesh.frustumCulled = false;
    this.quadScene.add(this.quadMesh);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = Boolean(on);
  }

  setSize(cssWidth: number, cssHeight: number, dpr: number): void {
    const pw = Math.max(2, Math.floor(cssWidth * dpr));
    const ph = Math.max(2, Math.floor(cssHeight * dpr));
    if (pw === this.width && ph === this.height && dpr === this.dpr) return;
    this.width = pw;
    this.height = ph;
    this.dpr = dpr;
    this.sceneRT.setSize(pw, ph);
    const bw = Math.max(2, Math.floor(pw * 0.5));
    const bh = Math.max(2, Math.floor(ph * 0.5));
    this.bloomRT.setSize(bw, bh);
    this.brightBlurMat.uniforms.uTexel.value.set(1 / pw, 1 / ph);
    this.compositeMat.uniforms.uBloomTexel.value.set(1 / bw, 1 / bh);
  }

  setOptions(opts: {
    enabled?: boolean;
    atmosphere?: AtmospherePreset;
    look?: PostVisualLook;
    exposure?: number;
  }): void {
    if (opts.enabled !== undefined) this.enabled = Boolean(opts.enabled);
    if (opts.atmosphere) {
      const cfg = ATMO_GRADE[opts.atmosphere] ?? ATMO_GRADE.night;
      this.brightBlurMat.uniforms.uThreshold.value = cfg.threshold;
      this.compositeMat.uniforms.uBloomStrength.value = cfg.bloomStrength;
      this.compositeMat.uniforms.uVignette.value = cfg.vignette;
      this.compositeMat.uniforms.uGrain.value = cfg.grain;
      this.compositeMat.uniforms.uWarmth.value.set(cfg.warmth[0], cfg.warmth[1], cfg.warmth[2]);
    }
    if (opts.look) {
      this.compositeMat.uniforms.uLook.value = opts.look === 'mono' ? 1 : opts.look === 'lianhuanhua' ? 2 : 0;
    }
    if (opts.exposure !== undefined) {
      this.compositeMat.uniforms.uExposure.value = opts.exposure;
    }
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, timeSec = 0): void {
    if (!this.enabled) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }

    const prevTarget = renderer.getRenderTarget();
    const prevToneMapping = renderer.toneMapping;
    const prevOutputColorSpace = renderer.outputColorSpace;

    // Render scene linear HDR into offscreen sceneRT
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setRenderTarget(this.sceneRT);
    renderer.render(scene, camera);

    // Pass 1: Bright extract + horizontal Gaussian blur
    this.quadMesh.material = this.brightBlurMat;
    renderer.setRenderTarget(this.bloomRT);
    renderer.render(this.quadScene, this.quadCam);

    // Pass 2: Vertical bloom blur + ACES Filmic + vignette + grain to screen
    this.compositeMat.uniforms.uTime.value = timeSec % 60;
    this.quadMesh.material = this.compositeMat;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setRenderTarget(prevTarget);
    renderer.render(this.quadScene, this.quadCam);

    renderer.toneMapping = prevToneMapping;
    renderer.outputColorSpace = prevOutputColorSpace;
  }

  dispose(): void {
    this.sceneRT.dispose();
    this.bloomRT.dispose();
    this.quadGeo.dispose();
    this.brightBlurMat.dispose();
    this.compositeMat.dispose();
    this.quadScene.clear();
  }
}
