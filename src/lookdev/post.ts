import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { GRADE_FRAG } from '../render/grade';

/**
 * Film-style post chain: HDR scene → GTAO (contact shadows) → bloom → depth of field → ACES output
 * → grade (lift/gamma/gain, split-tone, S-curve, chromatic fringe, vignette, grain) → SMAA.
 */
export class FilmPost {
  readonly composer: EffectComposer;
  readonly gtao: GTAOPass;
  readonly bloom: UnrealBloomPass;
  readonly dof: BokehPass;
  readonly grade: ShaderPass;
  private readonly smaa: SMAAPass;
  enabled = true;

  constructor(private readonly renderer: THREE.WebGLRenderer, scene: THREE.Scene, private camera: THREE.PerspectiveCamera, w: number, h: number, quality: 'low' | 'high', hideForAO: () => THREE.Object3D[]) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 0 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.gtao = new GTAOPass(scene, camera, w, h);
    this.gtao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.6, thickness: 1.5, scale: 1.25, samples: quality === 'high' ? 16 : 8, distanceFallOff: 1, screenSpaceRadius: false });
    this.gtao.blendIntensity = 0.9;
    // keep additive volumes and particles out of the AO depth/normal prepass
    const gtaoRender = this.gtao.render.bind(this.gtao);
    this.gtao.render = (...args: Parameters<GTAOPass['render']>) => {
      const hidden = hideForAO().filter((o) => o.visible); for (const o of hidden) o.visible = false;
      gtaoRender(...args); for (const o of hidden) o.visible = true;
    };
    this.gtao.enabled = quality === 'high';
    this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.6, 0.85);
    this.composer.addPass(this.bloom);
    this.dof = new BokehPass(scene, camera, { focus: 8, aperture: 0.0025, maxblur: 0.006 });
    this.dof.enabled = false;
    this.composer.addPass(this.dof);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(w, h) }, uTime: { value: 0 }, uOn: { value: 1 }, uLetterbox: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: GRADE_FRAG,
    }));
    this.composer.addPass(this.grade);
    this.smaa = new SMAAPass(); this.composer.addPass(this.smaa);
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h); this.gtao.setSize(w, h);
    (this.grade.uniforms.uRes.value as THREE.Vector2).set(w, h);
  }

  /** `on = false` is the "raw renderer" view: no AO, bloom, DOF or grade (tone mapping stays). */
  setEnabled(on: boolean): void {
    this.enabled = on; this.grade.uniforms.uOn.value = on ? 1 : 0; this.bloom.enabled = on; if (!on) this.dof.enabled = false;
  }

  render(t: number, dofFocus: number | null, letterbox: number): void {
    this.grade.uniforms.uTime.value = t; this.grade.uniforms.uLetterbox.value = letterbox;
    if (this.enabled && dofFocus !== null) { this.dof.enabled = true; (this.dof.uniforms as Record<string, THREE.IUniform>).focus.value = dofFocus; } else this.dof.enabled = false;
    const aoWas = this.gtao.enabled; if (!this.enabled) this.gtao.enabled = false;
    this.composer.render(); this.gtao.enabled = aoWas;
    void this.renderer; void this.camera;
  }
}
