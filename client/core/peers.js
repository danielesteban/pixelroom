
import Audio from './audio.js';
import SimplePeer from './simplepeer.js';
import { Object3D } from './three.js';
import Peer from '../renderables/peer.js';

class Peers extends Object3D {
  constructor() {
    super();
    this.audio = new Audio({
      onStream: this.onStream.bind(this),
    });
    this.peers = [];
  }

  onAnimationTick({ delta, player }) {
    const { peers } = this;
    peers.forEach(({ controllers }) => controllers.forEach((controller) => {
      if (controller.visible) {
        controller.hand.animate({ delta });
      }
    }));
    this.broadcast(player);
  }

  onStream() {
    const { audio, peers } = this;
    peers.forEach(({ connection }) => {
      if (!connection.destroyed) {
        connection.addStream(audio.userMedia);
      }
    });
  }

  broadcast({ controllers, head }) {
    const { peers } = this;
    const hands = controllers
      .filter(({ hand }) => (!!hand))
      .sort(({ hand: { handedness: a } }, { hand: { handedness: b } }) => b.localeCompare(a));
    const payload = new Float32Array([
      ...head.position.toArray(),
      ...head.rotation.toArray(),
      ...(hands.length === 2 ? (
        hands.reduce((hands, { hand: { state }, raycaster: { ray } }) => {
          hands.push(
            ...ray.origin.toArray(),
            ...ray.quaternion.toArray(),
            state
          );
          return hands;
        }, [])
      ) : []),
    ]);
    peers.forEach(({ connection }) => {
      if (
        connection
        && connection._channel
        && connection._channel.readyState === 'open'
      ) {
        connection.send(payload);
      }
    });
  }

  connect({ id, initiator = false }) {
    const { audio, server } = this;
    const connection = new SimplePeer({
      initiator,
      stream: audio.userMedia,
    });
    const peer = new Peer({ peer: id, connection });
    connection.on('error', () => {});
    connection.on('data', peer.update.bind(peer));
    connection.on('signal', (signal) => (
      server.send(JSON.stringify({
        type: 'SIGNAL',
        data: {
          peer: id,
          signal: JSON.stringify(signal),
        },
      }))
    ));
    connection.on('track', (track, stream) => {
      if (track.kind === 'audio') {
        if (peer.stream) audio.removeStream(peer.stream);
        peer.stream = audio.addStream(stream);
      }
    });
    this.add(peer);
    return peer;
  }

  init({
    server,
    peers,
  }) {
    this.server = server;
    this.peers = peers.map((id) => this.connect({ id, initiator: true }));
  }

  join(peer) {
    const { peers } = this;
    peers.push(this.connect({ id: peer }));
  }

  leave(peer) {
    const { audio, peers } = this;
    const index = peers.findIndex(({ peer: id }) => (id === peer));
    if (~index) {
      const [peer] = peers.splice(index, 1);
      this.remove(peer);
      const { connection, stream } = peer;
      connection.destroy();
      if (stream) audio.removeStream(stream);
    }
  }

  signal({ peer, signal }) {
    const { peers } = this;
    const { connection } = peers[
      peers.findIndex(({ peer: id }) => (id === peer))
    ] || {};
    if (connection && !connection.destroyed) {
      try {
        signal = JSON.parse(signal);
      } catch (e) {
        return;
      }
      connection.signal(signal);
    }
  }

  reset() {
    const { audio, peers } = this;
    peers.forEach((peer) => {
      this.remove(peer);
      const { connection, stream } = peer;
      if (!connection.destroyed) {
        connection.destroy();
      }
      if (stream) audio.removeStream(stream);
    });
    this.peers = [];
    delete this.server;
  }
}

export default Peers;
