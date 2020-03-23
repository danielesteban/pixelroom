import {
  Matrix4,
  Object3D,
  Quaternion,
  Raycaster,
  Vector3,
} from './three.js';
import Hand from '../renderables/hand.js';
import Marker from '../renderables/marker.js';

// Player controller

class Player extends Object3D {
  constructor({ camera, xr }) {
    super();
    this.auxMatrix = new Matrix4();
    this.auxVector = new Vector3();
    this.auxDestination = new Vector3();
    this.direction = new Vector3()
    this.head = {
      position: new Vector3(),
      rotation: new Quaternion(),
    };

    this.camera = camera;
    this.add(camera);

    this.controllers = [...Array(2)].map((v, i) => {
      const controller = xr.getController(i);
      this.add(controller);
      controller.marker = new Marker();
      controller.raycaster = new Raycaster();
      controller.raycaster.ray.quaternion = new Quaternion();
      controller.raycaster.far = 16;
      const onSelectStart = () => {
        controller.trigger = true;
        controller.triggerDown = true;
        const { hand } = controller;
        hand.setFinger('index', true);
        hand.setFinger('middle', true);
      };
      const onSelectEnd = () => {
        controller.trigger = false;
        controller.triggerUp = true;
        const { hand } = controller;
        hand.setFinger('index', false);
        hand.setFinger('middle', false);
      };
      controller.addEventListener('connected', ({ data: { handedness } }) => {
        const hand = new Hand({ handedness });
        controller.hand = hand;
        controller.add(hand);
        controller.addEventListener('selectstart', onSelectStart);
        controller.addEventListener('selectend', onSelectEnd);
      });
      controller.addEventListener('disconnected', () => {
        controller.remove(controller.hand);
        delete controller.hand;
        controller.marker.visible = false;
        controller.removeEventListener('selectstart', onSelectStart);
        controller.removeEventListener('selectend', onSelectEnd);
      });
      return controller;
    });
  }

  onAnimationTick({ delta, camera }) {
    const {
      auxMatrix,
      auxVector,
      controllers,
      destination,
      direction,
      head,
      position,
      speed,
    } = this;
    camera.matrixWorld.decompose(head.position, head.rotation, auxVector);
    controllers.forEach(({
      hand,
      marker,
      matrixWorld,
      raycaster,
    }) => {
      if (!hand) {
        return;
      }
      hand.animate({ delta });
      marker.visible = false;
      auxMatrix.identity().extractRotation(matrixWorld);
      raycaster.ray.origin
        .setFromMatrixPosition(matrixWorld)
        .add(
          auxVector.set(0, -0.1 / 3, 0).applyMatrix4(auxMatrix),
        );
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(auxMatrix);
      raycaster.ray.quaternion.setFromRotationMatrix(auxMatrix);
    });
    if (!destination) {
      return;
    }
    const step = speed * delta;
    const distance = destination.distanceTo(position);
    if (distance <= step) {
      position.copy(destination);
      delete this.destination;
      return;
    }
    position.addScaledVector(direction, step);
  }

  translocate(point) {
    const {
      auxDestination: destination,
      direction,
      head,
      position,
    } = this;
    destination
      .subVectors(point, destination.set(
        head.position.x - position.x,
        0,
        head.position.z - position.z
      ));
    this.destination = destination;
    this.speed = Math.max(destination.distanceTo(position) / 0.2, 2);
    direction
      .copy(destination)
      .sub(position)
      .normalize();
  }
}

export default Player;
