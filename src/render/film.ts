import * as THREE from 'three';
import type { PostStack } from '@slu/web-shell/look/three';
import { tunables } from '@slu/web-shell';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { GRADE_FRAG } from './grade';
import { tierSettings, type QualityTier } from './quality';

/**
 * The lookdev film look layered onto the shell's PostStack (which keeps bloom, hit pulses, flashes,
 * distortion rings, accessibility and FXAA). Final chain:
 *
 *   scene → [GTAO] → bloom → [depth of field] → output (ACES) → shell final (pulses) → [film grade] → FXAA
 *
 * GTAO and depth of field each re-render the scene, so they only run on the high tier; depth of
 * field only during cinematics. The film grade replaces the shell's own grade/vignette/grain.
 */
export class FilmLayer {
  readonly gtao: GTAOPass;
  readonly dof: BokehPass;
  readonly grade: ShaderPass;
  private transient: THREE.Object3D[] = [];
  private transientAge = Infinity;
  private tier: QualityTier = 'high';

  constructor(private readonly post: PostStack, private readonly scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const passes = post.composer.passes as Pass[];
    const bloomIx = passes.findIndex((p) => p instanceof UnrealBloomPass);
    const finalIx = passes.findIndex((p) => p instanceof ShaderPass && 'uRings' in (p as ShaderPass).uniforms);

    this.gtao = new GTAOPass(scene, camera, 2, 2);
    this.gtao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.6, thickness: 1.5, scale: 1.25, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    this.gtao.blendIntensity = 0.85;
    // half-resolution AO (it is denoised and soft anyway); additive volumes and particles stay out of the prepass
    const setSize = this.gtao.setSize.bind(this.gtao);
    this.gtao.setSize = (w: number, h: number) => setSize(Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2)));
    const gtaoRender = this.gtao.render.bind(this.gtao);
    this.gtao.render = (...args: Parameters<GTAOPass['render']>) => {
      const hidden = this.transient.filter((o) => o.visible); for (const o of hidden) o.visible = false;
      gtaoRender(...args); for (const o of hidden) o.visible = true;
    };

    this.dof = new BokehPass(scene, camera, { focus: 8, aperture: 0.0022, maxblur: 0.006 });
    this.dof.enabled = false;

    this.grade = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uOn: { value: 1 }, uLetterbox: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: GRADE_FRAG,
    }));

    // insert from the back so earlier indices stay valid
    post.composer.insertPass(this.grade, finalIx + 1);
    post.composer.insertPass(this.dof, bloomIx + 1);
    post.composer.insertPass(this.gtao, bloomIx);

    // the film grade owns grading, vignette and grain; the shell keeps pulses, flashes and bloom
    tunables.set('look.post', 'grade', false);
    tunables.set('look.post', 'vignette', false);
    tunables.set('look.post', 'grain', false);
  }

  setTier(t: QualityTier): void {
    this.tier = t;
    const q = tierSettings(t);
    this.gtao.enabled = q.gtao;
    tunables.set('look.post', 'quality', q.post);
  }

  /** `dofFocus`: focus distance in metres during a cinematic shot, or null for gameplay. */
  update(time: number, camera: THREE.PerspectiveCamera, dofFocus: number | null): void {
    this.gtao.camera = camera; (this.dof as unknown as { camera: THREE.Camera }).camera = camera;
    if (this.gtao.enabled && ++this.transientAge > 90) { this.transientAge = 0; this.transient = collectTransient(this.scene); }
    const u = this.grade.uniforms;
    u.uTime!.value = time;
    const pr = this.post.composer.renderer.getPixelRatio();
    const size = this.post.composer.renderer.getSize(new THREE.Vector2());
    (u.uRes!.value as THREE.Vector2).set(size.x * pr, size.y * pr);
    const dofOn = dofFocus !== null && this.tier === 'high';
    this.dof.enabled = dofOn;
    if (dofOn) (this.dof.uniforms as Record<string, THREE.IUniform>).focus!.value = dofFocus;
  }

  /** Call when the level changes so the AO prepass picks up the new particles and sprites. */
  invalidate(): void { this.transientAge = Infinity; }
}

function collectTransient(scene: THREE.Scene): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if ((o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite || (o as THREE.LineSegments).isLineSegments || (m && !Array.isArray(m) && (m.blending === THREE.AdditiveBlending || m.transparent))) out.push(o);
  });
  return out;
}
