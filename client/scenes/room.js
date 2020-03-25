import {
  Scene,
  Vector3,
} from '../core/three.js';
import CurveCast from '../core/curvecast.js';
import Peers from '../core/peers.js';
import Player from '../core/player.js';
import Translocable from '../core/translocable.js';
import Display from '../renderables/display.js';
import Wall from '../renderables/wall.js';

class Room extends Scene {
  constructor({ renderer: { camera, renderer: { xr } } }) {
    super();
    const { width, length, height } = Room.dimensions;

    this.auxVector = new Vector3();

    this.player = new Player({ camera, xr });
    this.player.controllers.forEach(({ marker }) => (
      this.add(marker)
    ));
    this.player.position.set(
      Math.floor(Math.random() * 4) - 2,
      0,
      Math.floor(Math.random() * 4) - 2
    );
    this.add(this.player);

    this.peers = new Peers();
    this.add(this.peers);

    const floor = new Wall({ width, height: length, light: 0.6 });
    floor.rotation.set(Math.PI * -0.5, 0, 0);
    this.add(floor);
    const ceiling = new Wall({ width, height: length, light: 0.5 });
    ceiling.position.set(0, height, 0);
    ceiling.rotation.set(Math.PI * 0.5, 0, 0);
    this.add(ceiling);

    this.intersects = [
      new Translocable({ width, length, offset: 0.25 }),
    ];
    this.intersects.forEach((mesh) => this.add(mesh));

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

    this.connect();
  }

  onBeforeRender({ animation: { delta, time } }, scene, camera) {
    const {
      auxVector,
      displays,
      intersects,
      peers,
      player,
      server,
    } = this;
    Display.animateMaterial(time);
    player.onAnimationTick({ delta, camera });
    peers.onAnimationTick({ delta, player });
    player.controllers.forEach((controller) => {
      const {
        hand,
        lastPixel,
        marker,
        raycaster,
      } = controller;
      if (!hand) {
        return;
      }
      const display = displays.findIndex((display) => (
        display.intersect.worldToLocal(auxVector.copy(raycaster.ray.origin)).z <= 1
      ));
      if (~display) {
        let { x, y } = auxVector;
        x += 0.5;
        y += 0.5;
        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
          const { pixels } = displays[display];
          x = Math.floor(x * pixels.x);
          y = Math.floor(y * pixels.y);
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
        }
      } else if (controller.lastPixel) {
        delete controller.lastPixel;
      }
      const {
        forward,
        forwardUp,
        leftwardsDown,
        rightwardsDown,
      } = controller.getButtons();
      if (
        !player.destination
        && hand.handedness === 'left'
        && (leftwardsDown || rightwardsDown)
      ) {
        player.rotate(
          Math.PI * 0.25 * (leftwardsDown ? 1 : -1)
        );
      }
      if (
        !player.destination
        && hand.handedness === 'right'
        && (forward || forwardUp)
      ) {
        const { hit, points } = CurveCast({
          intersects,
          raycaster,
        });
        if (hit) {
          if (forwardUp) {
            player.translocate(hit.point);
          } else {
            marker.update({ hit, points });
          }
        }
      }
    });
  }

  onEvent({ data }) {
    let event;
    try {
      event = JSON.parse(data);
    } catch (e) {
      return;
    }
    const { displays, peers, server } = this;
    switch (event.type) {
      case 'LOAD':
        event.data.displays.forEach((state, display) => (
          displays[display].load(state)
        ));
        peers.init({
          server,
          peers: event.data.peers,
        });
        break;
      case 'UPDATE': {
        const { display, pixel, color } = event.data;
        displays[display].updatePixel(pixel.x, pixel.y, color);
        break;
      }
      case 'JOIN':
        peers.join(event.data);
        break;
      case 'LEAVE':
        peers.leave(event.data);
        break;
      case 'SIGNAL':
        peers.signal(event.data);
        break;
      default:
        break;
    }
  }

  connect() {
    const { peers } = this;
    const url = new URL(window.location);
    url.protocol = url.protocol.replace(/http/, 'ws');
    url.hash = '';
    this.server = new WebSocket(url.toString());
    this.server.addEventListener('close', () => {
      peers.reset();
      setTimeout(() => this.connect(), 1000);
    });
    this.server.addEventListener('error', () => {});
    this.server.addEventListener('message', this.onEvent.bind(this));
  }
}

Room.dimensions = {
  width: 10,
  length: 10,
  height: 3,
};

export default Room;
