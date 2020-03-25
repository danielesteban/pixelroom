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
            'attribute float instanceColor;',
            'varying float vInstanceColor;',
            '#include <common>'
          ].join('\n')
        )
        .replace(
          '#include <begin_vertex>',
          [
            '#include <begin_vertex>',
            'vInstanceColor = instanceColor;',
          ].join('\n')
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          [
            'varying float vInstanceColor;',
            'const float ColorWheelStep = 1.0 / 3.0;',
            'vec3 ColorWheel( float pos ) {',
            '  vec3 color;',
            '  if (pos == 0.0) {',
            '    color = vec3( 0.17, 0.17, 0.17 );',
            '  } else if (pos >= 254.5) {',
            '    color = vec3( 1.0, 1.0, 1.0 );',
            '  } else {',
            '    pos /= 255.0;',
            '    if ( pos < ColorWheelStep ) {',
            '      color = vec3( pos * 3.0, 1.0 - pos * 3.0, 0.0 );',
            '    } else if( pos < ColorWheelStep * 2.0 ) {',
            '      pos -= ColorWheelStep;',
            '      color = vec3( 1.0 - pos * 3.0, 0.0, pos * 3.0 );',
            '    } else {',
            '      pos -= ColorWheelStep * 2.0;',
            '      color = vec3( 0.0, pos * 3.0, 1.0 - pos * 3.0 );',
            '    }',
            '    color += vec3(ColorWheelStep);',
            '  }',
            '  color.r = pow(color.r, 2.2);',
            '  color.g = pow(color.g, 2.2);',
            '  color.b = pow(color.b, 2.2);',
            '  return color;',
            '}',
            '#include <common>',
          ].join('\n')
        )
        .replace(
          'vec4 diffuseColor = vec4( diffuse, opacity );',
          'vec4 diffuseColor = vec4( diffuse * ColorWheel(vInstanceColor), opacity );'
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
    geometry.setAttribute('instanceColor', new InstancedBufferAttribute(new Float32Array(count), 1));
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
    const instances = geometry.getAttribute('instanceColor');
    state = atob(state);
    for (let i = 0; i < instances.count; i += 1) {
      instances.array[i] = state.charCodeAt(i);
    }
    instances.needsUpdate = true;
  }

  togglePixel(x, y) {
    const { geometry, pixels } = this;
    const instances = geometry.getAttribute('instanceColor');
    const index = (y * pixels.x) + x;
    const color = !instances.array[index] ? (
      Math.random() > 0.5 ? 0xFF : Math.floor(Math.random() * 0xFF)
    ) : 0;
    instances.array[index] = color;
    instances.needsUpdate = true;
    return color;
  }

  updatePixel(x, y, color) {
    const { geometry, pixels } = this;
    const instances = geometry.getAttribute('instanceColor');
    instances.array[(y * pixels.x) + x] = color;
    instances.needsUpdate = true;
  }
}

export default Display;
