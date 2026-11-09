import * as THREE from 'three';
import { radialSprite } from './textures';

/** Shared lighting constants for the scene (the moon direction drives sky, fog scatter and shadows). */
export const MOON_DIR = new THREE.Vector3(-0.45, 0.42, -0.79).normalize();
export const MOON_COLOR = new THREE.Color(0xb8cfff);
export const FOG_COLOR = new THREE.Color(0x1b2738);

/**
 * Height fog: replaces three's distance fog chunk with an analytic exponential-height integral plus
 * forward scattering toward the moon. Applies to every built-in material with `fog: true`.
 */
export function installHeightFog(baseHeight: number, falloff: number): void {
  const v = (x: THREE.Vector3) => `vec3(${x.x.toFixed(4)}, ${x.y.toFixed(4)}, ${x.z.toFixed(4)})`;
  const c = (x: THREE.Color) => `vec3(${x.r.toFixed(4)}, ${x.g.toFixed(4)}, ${x.b.toFixed(4)})`;
  THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogWorld;\n#endif`;
  THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG\n vFogDepth = - mvPosition.z; vFogWorld = (inverse(viewMatrix) * mvPosition).xyz;\n#endif`;
  THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
 uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogWorld;
 #ifdef FOG_EXP2
  uniform float fogDensity;
 #else
  uniform float fogNear; uniform float fogFar;
 #endif
#endif`;
  THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
 #ifdef FOG_EXP2
  vec3 fd = vFogWorld - cameraPosition; float fdist = length(fd);
  float fk = ${falloff.toFixed(4)};
  float fa = fogDensity * exp(-fk * (cameraPosition.y - ${baseHeight.toFixed(2)}));
  float fy = fd.y * fk;
  float fint = abs(fy) > 0.001 ? fa * (1.0 - exp(-fy)) / fy : fa;
  float fogFactor = 1.0 - exp(-fint * fdist);
  float scatter = pow(max(dot(fd / max(fdist, 0.001), ${v(MOON_DIR)}), 0.0), 6.0);
  vec3 fcol = fogColor + ${c(MOON_COLOR)} * scatter * 0.35;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fcol, clamp(fogFactor, 0.0, 1.0));
 #else
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
 #endif
#endif`;
}

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`;
const SKY_FRAG = `
varying vec3 vDir; uniform float uTime; uniform vec3 uMoon; uniform vec3 uFog;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=n2(p)*a; p*=2.03; a*=.5; } return s; }
void main(){
  vec3 d = normalize(vDir); float el = d.y;
  vec3 zenith = vec3(0.006,0.012,0.03), mid = vec3(0.02,0.04,0.075);
  vec3 col = mix(uFog * 1.05, mid, smoothstep(-0.02, 0.18, el)); col = mix(col, zenith, smoothstep(0.18, 0.8, el));
  // stars (rotate slowly), suppressed near horizon haze
  vec2 sp = vec2(atan(d.z, d.x) * 180.0, el * 320.0); float s = h21(floor(sp));
  float star = step(0.9965, s) * smoothstep(0.08, 0.35, el) * (0.6 + 0.4 * sin(uTime * 2.0 + s * 80.0));
  col += vec3(0.75,0.82,1.0) * star * 1.6;
  // aurora: a curtain hung from a wavering lower edge, bright at the hem, fading upward, split into rays
  float az = atan(d.z, d.x);
  float wav = fbm(vec2(az * 2.0, uTime * 0.02));
  float v = el - (0.06 + wav * 0.14);
  float prof = smoothstep(-0.004, 0.012, v) * exp(-max(v, 0.0) * 6.0);
  float mask = smoothstep(0.42, 0.8, fbm(vec2(az * 1.3 + 5.0, uTime * 0.01)));
  float rays = 0.3 + 0.7 * pow(n2(vec2(az * 260.0 + wav * 40.0, uTime * 0.4)), 2.0);
  vec3 aur = mix(vec3(0.08, 1.0, 0.55), vec3(0.55, 0.25, 1.0), smoothstep(0.02, 0.3, v));
  col += aur * prof * mask * rays * 0.5;
  // moon + halo
  float m = dot(d, uMoon);
  col += vec3(0.85,0.9,1.0) * smoothstep(0.99955, 0.99975, m) * 6.0;
  col += vec3(0.5,0.62,0.9) * pow(max(m,0.0), 180.0) * 0.6 + vec3(0.2,0.28,0.45) * pow(max(m,0.0), 12.0) * 0.12;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Sky {
  readonly mesh: THREE.Mesh;
  private readonly u = { uTime: { value: 0 }, uMoon: { value: MOON_DIR.clone() }, uFog: { value: FOG_COLOR.clone() } };
  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -10; scene.add(this.mesh);
  }
  update(t: number, cam: THREE.Camera): void { this.u.uTime.value = t; this.mesh.position.copy(cam.position); }
}

const SNOW_VERT = `
uniform float uTime; uniform vec3 uCam; uniform float uBox; uniform vec3 uWind; uniform float uSize; uniform float uPx;
attribute float aSeed; varying float vA;
void main(){
  vec3 p = position; float t = uTime * (0.6 + aSeed * 0.8);
  p += uWind * t + vec3(sin(t * 1.3 + aSeed * 40.0), 0.0, cos(t * 1.1 + aSeed * 23.0)) * 0.35;
  p.y -= t * (0.9 + aSeed * 0.9);
  p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;   // wrap the box around the camera
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  gl_PointSize = uSize * (0.6 + aSeed) * uPx / dist;
  vA = smoothstep(0.25, 1.2, dist) * (1.0 - smoothstep(uBox * 0.35, uBox * 0.5, dist));
}`;
const SNOW_FRAG = `uniform sampler2D uTex; uniform vec3 uColor; varying float vA;
void main(){ float a = texture2D(uTex, gl_PointCoord).a * vA; if (a < 0.01) discard; gl_FragColor = vec4(uColor * a, a); }`;

/** Snowfall: two wrapped particle boxes (fine near flakes, heavy far streak layer). */
export class Snowfall {
  private readonly layers: { pts: THREE.Points; u: Record<string, THREE.IUniform> }[] = [];
  constructor(scene: THREE.Scene, pxScale: number) {
    const sprite = radialSprite(32);
    const mk = (count: number, box: number, size: number, color: number) => {
      const g = new THREE.BufferGeometry(); const pos = new Float32Array(count * 3); const seed = new Float32Array(count);
      for (let i = 0; i < count; i++) { pos[i * 3] = Math.random() * box; pos[i * 3 + 1] = Math.random() * box; pos[i * 3 + 2] = Math.random() * box; seed[i] = Math.random(); }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      const u = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uWind: { value: new THREE.Vector3(1.6, 0, 0.5) }, uSize: { value: size }, uPx: { value: pxScale }, uTex: { value: sprite }, uColor: { value: new THREE.Color(color) } };
      const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: SNOW_VERT, fragmentShader: SNOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      pts.frustumCulled = false; scene.add(pts); this.layers.push({ pts, u });
    };
    mk(7000, 30, 0.07, 0x8a96a8);
    mk(5000, 90, 0.16, 0x56606e);
  }
  update(t: number, cam: THREE.Camera): void { for (const l of this.layers) { l.u.uTime.value = t; (l.u.uCam.value as THREE.Vector3).copy(cam.position); } }
}

const BEAM_VERT = `varying vec3 vN; varying vec3 vV; varying float vL; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vL = uv.y; gl_Position = projectionMatrix * viewMatrix * w; }`;
const BEAM_FRAG = `uniform vec3 uColor; uniform float uIntensity; uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vL;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
  float along = pow(vL, 1.6);                // bright at the lamp, fading toward the ground
  float dust = 0.85 + 0.15 * h(floor(gl_FragCoord.xy * 0.5) + floor(uTime * 12.0));
  float a = edge * along * uIntensity * dust;
  gl_FragColor = vec4(uColor * a, a);
}`;

/** Fake volumetric light cone (additive, view-angle shaded) — cheap stand-in for froxel fog. */
export function lightBeam(color: THREE.ColorRepresentation, length: number, radius: number, intensity: number): { mesh: THREE.Mesh; uniforms: Record<string, THREE.IUniform> } {
  const g = new THREE.CylinderGeometry(0.06, radius, length, 32, 1, true); g.translate(0, -length / 2, 0);
  const uniforms = { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity }, uTime: { value: 0 } };
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  mesh.renderOrder = 5; return { mesh, uniforms };
}

/** Bulb glare sprite. */
export function glare(color: THREE.ColorRepresentation, size: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite(64), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.set(size, size, 1); return s;
}

const DRIFT_VERT = `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const DRIFT_FRAG = `uniform float uTime; varying vec2 vUv; varying vec3 vW;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
void main(){
  vec2 p = vW.xz * 0.18 - vec2(uTime * 0.9, uTime * 0.3);
  float n = n2(p) * 0.6 + n2(p * 2.7 + 3.1) * 0.4; n = smoothstep(0.45, 0.85, n);
  float fade = (1.0 - vUv.y) * smoothstep(0.0, 0.15, vUv.y) ;
  float a = n * fade * 0.16;
  gl_FragColor = vec4(vec3(0.72,0.8,0.92) * a, a);
}`;

/** Ground-hugging blowing snow: a ring of vertical noise ribbons around the camera. */
export class BlowingSnow {
  private readonly u = { uTime: { value: 0 } };
  readonly group = new THREE.Group();
  constructor(scene: THREE.Scene, heightAt: (x: number, z: number) => number) {
    const mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: DRIFT_VERT, fragmentShader: DRIFT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * 120, z = (Math.random() - 0.5) * 120;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(14 + Math.random() * 10, 1.1, 1, 1), mat);
      m.position.set(x, heightAt(x, z) + 0.45, z); m.rotation.y = Math.random() * Math.PI; this.group.add(m);
    }
    scene.add(this.group);
  }
  update(t: number): void { this.u.uTime.value = t; }
}
