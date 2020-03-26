
import SimplePeer from './simplepeer.js';
import { Object3D, PositionalAudio } from './three.js';
import Peer from '../renderables/peer.js';

class Peers extends Object3D {
  constructor({ listener }) {
    super();
    this.listener = listener;
    this.peers = [];
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(this.onUserMedia.bind(this))
      .catch(() => {});
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

  onUserMedia(stream) {
    const { peers } = this;
    this.userMedia = stream;
    peers.forEach(({ connection }) => {
      if (!connection.destroyed) {
        connection.addStream(stream);
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
        hands.reduce((hands, { hand: { state }, worldspace: { position, rotation } }) => {
          hands.push(
            ...position.toArray(),
            ...rotation.toArray(),
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
    const {
      listener,
      server,
      userMedia,
    } = this;
    const connection = new SimplePeer({
      initiator,
      stream: userMedia,
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
        if (!peer.audio) {
          peer.audio = new PositionalAudio(listener);
          peer.audio.setRefDistance(1);
          peer.audio.setDirectionalCone(180, 230, 0.1);
          peer.head.add(peer.audio);
          const player = document.createElement('audio');
          player.muted = true;
          peer.audio.player = player;
        } else {
          peer.audio.source.mediaStream.getTracks().forEach((track) => track.stop());
          peer.audio.disconnect();
        }
        peer.audio.setMediaStreamSource(stream);
        peer.audio.player.srcObject = stream;
        peer.audio.player.play();
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
    const { peers } = this;
    const index = peers.findIndex(({ peer: id }) => (id === peer));
    if (~index) {
      const [peer] = peers.splice(index, 1);
      this.remove(peer);
      const { audio, connection } = peer;
      if (audio) {
        audio.source.mediaStream.getTracks().forEach((track) => track.stop());
        audio.player.srcObject = null;
        audio.disconnect();
      }
      if (!connection.destroyed) {
        connection.destroy();
      }
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
    const { peers } = this;
    peers.forEach((peer) => {
      this.remove(peer);
      const { audio, connection } = peer;
      if (audio) {
        audio.source.mediaStream.getTracks().forEach((track) => track.stop());
        audio.player.srcObject = null;
        audio.disconnect();
      }
      if (!connection.destroyed) {
        connection.destroy();
      }
    });
    this.peers = [];
    delete this.server;
  }
}

export default Peers;
