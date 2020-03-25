import { Vector3 } from '../core/three.js';
import Scene from '../core/scene.js';
import Translocable from '../core/translocable.js';
import Display from '../renderables/display.js';
import Wall from '../renderables/wall.js';

class Room extends Scene {
  constructor(renderer) {
    super(renderer);
    const { width, length, height } = Room.dimensions;

    this.player.position.set(
      Math.floor(Math.random() * 4) - 2,
      0,
      Math.floor(Math.random() * 4) - 2
    );

    this.auxVector = new Vector3();

    const floor = new Wall({ width, height: length, light: 0.6 });
    floor.rotation.set(Math.PI * -0.5, 0, 0);
    this.add(floor);
    const ceiling = new Wall({ width, height: length, light: 0.5 });
    ceiling.position.set(0, height, 0);
    ceiling.rotation.set(Math.PI * 0.5, 0, 0);
    this.add(ceiling);

    const translocable = new Translocable({ width, length, offset: 0.25 });
    this.translocables.push(translocable);
    this.add(translocable);

    this.displays = [
      [width, 0, length * -0.5],
      [length, width * 0.5, 0],
      [width, 0, length * 0.5],
      [length, width * -0.5, 0],
    ]
      .map(([width, x, z]) => {
        const wall = new Wall({ width, height });
        wall.position.set(x, height * 0.5, z);
        wall.lookAt(0, height * 0.5, 0);
        const display = new Display({ width, height });
        wall.add(display);
        this.add(wall);
        return display;
      });
  }

  onBeforeRender(renderer, scene, camera) {
    super.onBeforeRender(renderer, scene, camera);
    Display.animateMaterial(renderer.animation.time);
    const {
      displays,
      player,
      server,
    } = this;
    player.controllers.forEach((controller) => {
      const {
        hand,
        lastPixel,
        raycaster,
      } = controller;
      if (!hand) {
        return;
      }
      const pixel = this.getPixelAtPosition(raycaster.ray.origin);
      if (pixel) {
        const { display, x, y } = pixel;
        if (
          !lastPixel
          || lastPixel.display !== display
          || lastPixel.x !== x
          || lastPixel.y !== y
        ) {
          controller.lastPixel = { display, x, y };
          const color = displays[display].togglePixel(x, y);
          server.send(JSON.stringify({
            type: 'UPDATE',
            data: {
              display,
              pixel: { x, y },
              color,
            },
          }));
        }
      } else if (controller.lastPixel) {
        delete controller.lastPixel;
      }
    });
  }

  onEvent(event) {
    super.onEvent(event);
    const { displays } = this;
    const { type, data } = event;
    switch (type) {
      case 'LOAD':
        data.displays.forEach((state, display) => (
          displays[display].load(state)
        ));
        break;
      case 'UPDATE': {
        const { display, pixel, color } = data;
        displays[display].updatePixel(pixel.x, pixel.y, color);
        break;
      }
      default:
        break;
    }
  }

  getPixelAtPosition(position) {
    const { auxVector, displays } = this;
    const display = displays.findIndex((display) => (
      display.intersect.worldToLocal(auxVector.copy(position)).z <= 1
    ));
    if (~display) {
      let { x, y } = auxVector;
      x += 0.5;
      y += 0.5;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        const { pixels } = displays[display];
        return {
          display,
          x: Math.floor(x * pixels.x),
          y: Math.floor(y * pixels.y),
        };
      }
    }
    return false;
  }
}

Room.dimensions = {
  width: 10,
  length: 10,
  height: 3,
};

export default Room;
