/**
 * `objeto`: a real object the class filmed, as a hologram. Each camera (each face of the pyramid, or the
 * phone screen) draws the keyframe that was captured from its own side of the object: the billboard and
 * the view choice happen in the shader from the camera position in object space, so rotating the hologram
 * walks through the real views. It is a 360° view from the video, not a reconstructed mesh.
 */
import * as THREE from 'three';
import { HoloLabel } from './label.ts';
import { objetoHolograma } from './objetoDatos.ts';
import type { SceneModule } from './types.ts';

const vertex = /* glsl */ `
  uniform float uVistas;
  uniform vec2 uTamano;
  varying vec2 vUv;
  varying float vVista;
  void main() {
    vec4 centro = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec3 dirMundo = cameraPosition - centro.xyz;
    mat3 rot = mat3(normalize(modelMatrix[0].xyz), normalize(modelMatrix[1].xyz), normalize(modelMatrix[2].xyz));
    vec3 local = transpose(rot) * dirMundo;
    float angulo = atan(local.x, local.z);
    float vuelta = fract(angulo / 6.28318530718);
    vVista = mod(floor(vuelta * uVistas + 0.5), uVistas);
    vUv = uv;
    float escala = length(modelMatrix[0].xyz);
    vec4 mv = viewMatrix * centro;
    mv.xy += position.xy * uTamano * escala;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uColumnas;
  uniform float uFilas;
  varying vec2 vUv;
  varying float vVista;
  void main() {
    float col = mod(vVista, uColumnas);
    float fila = floor(vVista / uColumnas);
    vec2 uv = vec2((col + vUv.x) / uColumnas, 1.0 - (fila + 1.0 - vUv.y) / uFilas);
    vec4 c = texture2D(uAtlas, uv);
    if (c.a < 0.08) discard;
    gl_FragColor = vec4(c.rgb, c.a);
  }
`;

export function objeto(): SceneModule {
  const datos = objetoHolograma();
  const disposables: Array<{ dispose(): void }> = [];
  let titulo: HoloLabel | null = null;
  return {
    id: 'objeto',
    label: datos?.nombre ?? 'Objeto escaneado',
    practice: 'objeto',
    build() {
      const g = new THREE.Group();
      g.name = 'objeto';
      if (!datos) return g;
      const alto = 1.6;
      const ancho = alto * datos.aspecto;
      const textura = new THREE.Texture(datos.atlas);
      textura.colorSpace = THREE.SRGBColorSpace;
      textura.needsUpdate = true;
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uAtlas: { value: textura },
          uVistas: { value: datos.vistas },
          uColumnas: { value: datos.columnas },
          uFilas: { value: datos.filas },
          uTamano: { value: new THREE.Vector2(ancho, alto) },
        },
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      // Unit quad; the shader scales it. The bounding box spans the real size so the scene fits like any other.
      const geo = new THREE.PlaneGeometry(1, 1);
      geo.boundingBox = new THREE.Box3(new THREE.Vector3(-ancho / 2, -alto / 2, -ancho / 2), new THREE.Vector3(ancho / 2, alto / 2, ancho / 2));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(ancho, alto) / 2);
      const quad = new THREE.Mesh(geo, material);
      quad.frustumCulled = false;
      quad.name = 'vista360';
      g.add(quad);
      // An invisible box gives fit() the real footprint (PlaneGeometry's own box is 1x1).
      const huella = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, ancho), new THREE.MeshBasicMaterial({ visible: false }));
      g.add(huella);
      titulo = new HoloLabel(1.4);
      titulo.set([
        { text: datos.nombre, color: '#FFC14D', size: 44 },
        { text: 'Vista 360° a partir del video', color: '#5FE3FF', size: 28 },
      ]);
      titulo.sprite.position.set(0, -alto / 2 - 0.25, 0);
      g.add(titulo.sprite);
      disposables.push(textura, material, geo, huella.geometry, huella.material as THREE.Material);
      return g;
    },
    dispose() {
      for (const d of disposables) d.dispose();
      titulo?.dispose();
      titulo = null;
    },
  };
}
