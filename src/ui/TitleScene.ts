import * as THREE from 'three';
import { PALETTE } from '../../data/palette';

const PLANET_FRAG = /* glsl */`
uniform float uTime; uniform float uCrack; varying vec3 vN; varying vec3 vP;
float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
void main(){
  vec3 L = normalize(vec3(-0.6,0.4,0.7));
  float d = max(0.0, dot(normalize(vN), L));
  float ice = n(vP*3.0)*0.5 + n(vP*9.0)*0.25;
  vec3 col = mix(vec3(0.55,0.65,0.75), vec3(0.92,0.96,1.0), ice) * (0.08 + d*0.9);
  float cr = abs(n(vP*5.0 + uTime*0.01) - 0.5);
  float crack = smoothstep(0.03*uCrack, 0.0, cr) * uCrack;
  col += vec3(0.84,0.78,1.0) * crack * (0.6 + 0.4*sin(uTime*1.3 + vP.x*4.0)) * 1.6;
  float rim = pow(1.0 - max(0.0, dot(normalize(vN), vec3(0,0,1))), 3.0);
  col += vec3(0.3,0.5,0.8) * rim * 0.5;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Title background: Ilvane slowly cracking — or gone, after the ending. */
export class TitleScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 5000);
  private planet: THREE.Mesh;
  private debris: THREE.Points;
  private u = { uTime: { value: 0 }, uCrack: { value: 0.4 } };
  planetGone: boolean;
  private t = 0;
  constructor(gone: boolean) {
    this.planetGone = gone;
    this.scene.background = new THREE.Color(0x02040a);
    const stars = new Float32Array(3000 * 3);
    for (let i = 0; i < 3000; i++) { const a = i * 2.399, z = 1 - (i / 3000) * 2, r = Math.sqrt(1 - z * z); stars.set([Math.cos(a) * r * 2000, z * 2000, Math.sin(a) * r * 2000], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(60, 96, 64), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalMatrix*normal; vP = position/60.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: PLANET_FRAG }));
    this.scene.add(this.planet);
    const dp = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) { const a = i * 0.731, r = 50 + ((i * 0.618) % 1) * 70, y = (((i * 0.377) % 1) - 0.5) * 30; dp.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    this.debris = new THREE.Points(dg, new THREE.PointsMaterial({ color: PALETTE.violet, size: 1.2 }));
    this.scene.add(this.debris);
    this.camera.position.set(40, 10, 190); this.camera.lookAt(0, 0, 0);
  }
  update(dt: number): void {
    this.t += dt; this.u.uTime.value = this.t;
    this.u.uCrack.value = 0.4 + Math.min(0.5, this.t * 0.004);
    this.planet.visible = !this.planetGone;
    this.debris.visible = this.planetGone;
    this.planet.rotation.y += dt * 0.02;
    this.debris.rotation.y += dt * 0.01;
  }
}
