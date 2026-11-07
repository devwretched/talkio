"use client";

import { useEffect, useRef, useState } from "react";

/**
 * VEIL's signature atmospheric background.
 *
 * A WebGL fragment shader painting continuously drifting, gaussian-soft
 * light fields over an ink-black base: burgundy, oxide red, dusty warm ivory
 * and charcoal. Fields are domain-warped with layered noise so they read as
 * organic atmospheric shapes — never circles — that slowly converge, overlap
 * and disperse. Movement is deliberately slow and non-linear; there is no
 * loop reset.
 *
 * Rendered at reduced resolution (the content is inherently blurred, so the
 * downscale is free quality-wise) and paused when the tab is hidden.
 * Honours prefers-reduced-motion by painting a single static frame.
 */

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform vec2  u_res;
uniform float u_time;

// ── cheap value noise ──
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dot(hash2(i),               f);
  float b = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// layered, slow domain warp — makes edges organic rather than round
float warp(vec2 p, float t) {
  float n = 0.0;
  n += 0.70 * noise(p * 1.0 + t * 0.42);
  n += 0.32 * noise(p * 2.1 - t * 0.31);
  n += 0.14 * noise(p * 4.3 + t * 0.57);
  return n;
}

// one gaussian-soft field; the radius wobbles with angle+time so the
// silhouette keeps morphing (expand / contract / deform, no resets)
float field(vec2 rel, float radius, float t) {
  float d = length(rel);
  float ang = atan(rel.y, rel.x);
  float morph = radius * (
    1.0
    + 0.30 * sin(ang * 3.0 + t * 0.72)
    + 0.16 * sin(ang * 5.0 - t * 0.51)
    + 0.10 * sin(ang * 8.0 + t * 0.33)
  );
  return smoothstep(morph, 0.0, d);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0) * 2.0; // aspect-corrected
  float t = u_time;

  float w = warp(p * 0.6, t * 0.35);

  // drifting, converging field centres — deliberately different periods
  // so their alignments keep evolving rather than repeating
  vec2 c1 = vec2( 0.55 * sin(t * 0.21 + 1.7),  0.35 * cos(t * 0.13));
  vec2 c2 = vec2(-0.50 * sin(t * 0.11),        0.30 * sin(t * 0.17 + 2.0));
  vec2 c3 = vec2( 0.30 * cos(t * 0.16 + 0.5), -0.42 * cos(t * 0.09 + 1.1));
  vec2 c4 = vec2( 0.10 * sin(t * 0.07 + 3.0),  0.15 * sin(t * 0.12 + 4.0));

  vec3 ink      = vec3(0.063, 0.063, 0.063); // #101010
  vec3 burgundy = vec3(0.349, 0.165, 0.173); // #592A2C
  vec3 oxide    = vec3(0.639, 0.231, 0.196); // #A33B32
  vec3 ivory    = vec3(0.914, 0.894, 0.855); // #E9E4DA (kept faint)
  vec3 charcoal = vec3(0.145, 0.130, 0.125);

  float f1 = field(p + 0.25 * w, 1.05, t);       // burgundy — the main atmosphere
  float f2 = field(p + 0.15 * w, 0.62, t + 9.0); // oxide — occasional heat
  float f3 = field(p + 0.10 * w, 0.88, t + 17.0);// deep charcoal — mass
  float f4 = field(p + 0.20 * w, 0.34, t + 25.0);// ivory — a rare warm flicker

  vec3 col = ink;
  col = mix(col, burgundy, 0.72 * f1);
  col = mix(col, oxide,    0.42 * f2);
  col = mix(col, charcoal, 0.55 * f3);
  col = mix(col, ivory,    0.07 * f4);

  // restrained vignette so text at the edges keeps its contrast
  float vig = smoothstep(1.7, 0.3, length(p * 0.82));
  col = mix(ink, col, 0.55 + 0.45 * vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "shader compile failed");
  }
  return shader;
}

export function GaussianBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", { antialias: false, alpha: false }) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }
    if (!gl) {
      setFailed(true);
      return;
    }

    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error("program link failed");
      }
    } catch {
      setFailed(true);
      return;
    }
    gl.useProgram(program);

    // fullscreen triangle
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Downscale: gaussian content hides the resolution loss, GPU cost drops ~3-4x.
    const SCALE = 0.5;
    let raf = 0;

    const resize = () => {
      const w = Math.max(1, Math.floor(window.innerWidth * SCALE));
      const h = Math.max(1, Math.floor(window.innerHeight * SCALE));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl!.viewport(0, 0, w, h);
        gl!.uniform2f(uRes, w, h);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const SPEED = 0.045; // cinematic: one slow, continuous breathe
    let t = 14.0; // hand-picked start pose — immediately attractive
    let last = performance.now();
    let running = reduced === false;

    const draw = () => {
      gl!.uniform1f(uTime, t);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt * SPEED;
      draw();
      raf = requestAnimationFrame(loop);
    };

    if (running) {
      raf = requestAnimationFrame(loop);
    } else {
      draw(); // reduced motion: one gorgeous static frame
    }

    const onVisibility = () => {
      if (reduced) return;
      if (document.hidden) {
        cancelAnimationFrame(raf);
        running = false;
      } else if (!running) {
        last = performance.now();
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div className="veil-bg" aria-hidden>
      {failed ? <div className="veil-bg-fallback" /> : <canvas ref={canvasRef} />}
    </div>
  );
}

/** Static analogue grain layer — mounted once in the root layout. */
export function VeilGrain() {
  return <div className="veil-grain" aria-hidden />;
}
