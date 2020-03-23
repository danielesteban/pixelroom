import {
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  VertexColors,
} from '../core/three.js';

// Wall plane

class Wall extends Mesh {
  static setupMaterial() {
    Wall.material = new MeshBasicMaterial({
      vertexColors: VertexColors,
    });
  }

  constructor({ width, height, light = 1 }) {
    if (!Wall.material) {
      Wall.setupMaterial();
    }
    const plane = new PlaneGeometry(width, height, width * 4, height * 4);
    const xStride = 2;
    const yStride = width * 8;
    for (let y = 0; y < height; y += 1) {
      const ty = y * 4;
      for (let x = 0; x < width; x += 1) {
        const tx = x * 4;
        const tl = (0.06 - (Math.random() * 0.02)) * light;
        for (let j = 0; j < 16; j += 1) {
          const fy = ty + Math.floor(j / 4);
          const fx = tx + (j % 4);
          let l = tl - (Math.random() * 0.01);
          if (
            fx <= 0
            || fx >= (width * 4) - 1
            || fy <= 0
            || fy >= (height * 4) - 1
          ) {
            l = (0.01 - (Math.random() * 0.004)) * light;
          }
          const i = (fy * yStride) + (fx * xStride);
          const face = plane.faces[i];
          face.color.setHSL(0, 0, l);
          plane.faces[i + 1].color.copy(face.color);
        }
      }
    }
    const hw = width * 0.5;
    const hh = height * 0.5;
    const bevel = 0.25;
    plane.vertices.forEach((v) => {
      if (
        v.x <= -hw
        || v.x >= hw
      ) {
        v.x += bevel * (v.x < 0 ? 1 : -1);
        v.z += bevel;
      }
      if (
        v.y <= -hh
        || v.y >= hh
      ) {
        v.y += bevel * (v.y < 0 ? 1 : -1);
        v.z += bevel;
      }
    });
    const geometry = (new BufferGeometry()).fromGeometry(plane);
    delete geometry.attributes.normal;
    delete geometry.attributes.uv;
    super(
      geometry,
      Wall.material
    );
  }

  dispose() {
    const { geometry } = this;
    geometry.dispose();
  }
}

export default Wall;
