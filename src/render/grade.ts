/**
 * Film grade (display space, after tone mapping): radial chromatic fringe, cool-shadow / warm-highlight
 * split tone, ~18% desaturation, black floor, S-curve, vignette, shadow-weighted grain, letterbox.
 * Shared by the lookdev scene and the game (src/render/film.ts).
 */
export const GRADE_FRAG = `
uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime; uniform float uOn; uniform float uLetterbox;
varying vec2 vUv;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 uv = vUv; vec2 c = uv - 0.5;
  if (uOn < 0.5) { gl_FragColor = texture2D(tDiffuse, uv); return; }
  // lens: slight radial chromatic fringe toward the edges
  float r2 = dot(c, c); vec2 off = c * r2 * 0.012;
  vec3 col = vec3(texture2D(tDiffuse, uv - off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv + off).b);
  // grade (display space): cool shadows, neutral-warm highlights, crushed toe, gentle shoulder
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 shadowTint = vec3(0.86, 0.97, 1.06), highTint = vec3(1.04, 1.0, 0.95);
  col *= mix(shadowTint, highTint, smoothstep(0.05, 0.6, l));
  col = mix(vec3(l), col, 0.82);                                       // desaturate ~18%
  col = clamp((col - 0.012) / (1.0 - 0.012), 0.0, 1.0);               // lift the floor to true black
  col = col * col * (3.0 - 2.0 * col) * 0.35 + col * 0.65;             // S-curve contrast
  // vignette
  col *= mix(1.0, smoothstep(0.95, 0.25, length(c * vec2(1.0, 0.85))), 0.55);
  // film grain, stronger in the shadows
  float g = h12(uv * uRes + fract(uTime * 13.7) * 1000.0) - 0.5;
  col += g * mix(0.055, 0.018, l);
  // letterbox for cinematic shots
  float lb = uLetterbox * 0.12; if (uv.y < lb || uv.y > 1.0 - lb) col = vec3(0.0);
  gl_FragColor = vec4(col, 1.0);
}`;
