import {
  BoxBufferGeometry,
  BoxGeometry,
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  VertexColors,
} from '../core/three.js';

// Instanced display

class Display extends InstancedMesh {
  static setupGeometry() {
    const pixel = new BoxGeometry(0.175, 0.175, 0.05);
    pixel.faces.splice(10, 2);
    pixel.faces.forEach((face, i) => {
      if (i % 2 === 1) {
        face.color.setHSL(0, 0, i > 8 ? 1 : 0.5);
        pixel.faces[i - 1].color.copy(face.color);
      }
    });
    Display.geometry = (new BufferGeometry()).fromGeometry(pixel);
    Display.intersectGeometry = new BoxBufferGeometry(1, 1, 1, 1, 1, 1);
    [
      Display.geometry,
      Display.intersectGeometry
    ].forEach((geometry) => {
      delete geometry.attributes.normal;
      delete geometry.attributes.uv;
    });
  }

  static setupMaterial() {
    const material = new MeshBasicMaterial({
      vertexColors: VertexColors,
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          [
            'attribute float instanceIsOn;',
            'varying float vInstanceIsOn;',
            '#include <common>'
          ].join('\n')
        )
        .replace(
          '#include <begin_vertex>',
          [
            '#include <begin_vertex>',
            'vInstanceIsOn = instanceIsOn;',
          ].join('\n')
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          [
            'varying float vInstanceIsOn;',
            '#include <common>',
          ].join('\n')
        )
        .replace(
          'vec4 diffuseColor = vec4( diffuse, opacity );',
          'vec4 diffuseColor = vec4( diffuse * max(vInstanceIsOn, 0.02), opacity );'
        );
    };
    Display.material = material;
    Display.intersectMaterial = new MeshBasicMaterial({
      visible: false,
    });
  }

  constructor({ width, height }) {
    if (!Display.geometry || !Display.intersectGeometry) {
      Display.setupGeometry();
    }
    if (!Display.material || !Display.intersectMaterial) {
      Display.setupMaterial();
    }
    const count = (width * 4) * (height * 4);
    const geometry = Display.geometry.clone();
    geometry.setAttribute('instanceIsOn', new InstancedBufferAttribute(new Float32Array(count), 1));
    super(
      geometry,
      Display.material,
      count
    );
    const size = {
      x: width - 0.5,
      y: height - 0.5,
    };
    this.pixels = {
      x: width * 4,
      y: height * 4,
    };
    const step = {
      x: size.x / this.pixels.x,
      y: size.y / this.pixels.y,
    };
    const offset = {
      x: size.x * -0.5 + step.x * 0.5,
      y: size.y * -0.5 + step.y * 0.5,
    };
    const pixel = new Object3D();
    for (let i = 0, y = 0; y < this.pixels.y; y += 1) {
      for (let x = 0; x < this.pixels.x; x += 1, i += 1) {
        pixel.position.set(
          offset.x + x * step.x,
          offset.y + y * step.y,
          0
        );
        pixel.updateMatrix();
        this.setMatrixAt(i, pixel.matrix);
      }
    }
    this.intersect = new Mesh(
      Display.intersectGeometry,
      Display.intersectMaterial
    );
    this.intersect.scale.set(size.x, size.y, 0.05);
    this.add(this.intersect);
    this.position.set(0, 0, 0.025);
  }

  dispose() {
    const { geometry } = this;
    geometry.dispose();
  }

  load(state) {
    const { geometry } = this;
    const isOn = geometry.getAttribute('instanceIsOn');
    state = atob(state);
    for (let i = 0; i < isOn.count; i += 1) {
      isOn.array[i] = state.charCodeAt(i);
    }
    isOn.needsUpdate = true;
  }

  togglePixel(x, y) {
    const { geometry, pixels } = this;
    const isOn = geometry.getAttribute('instanceIsOn');
    const index = (y * pixels.x) + x;
    const state = isOn.array[index] ? 0 : 1;
    isOn.array[index] = state;
    isOn.needsUpdate = true;
    return state;
  }

  updatePixel(x, y, state) {
    const { geometry, pixels } = this;
    const isOn = geometry.getAttribute('instanceIsOn');
    isOn.array[(y * pixels.x) + x] = state;
    isOn.needsUpdate = true;
  }
}

export default Display;
