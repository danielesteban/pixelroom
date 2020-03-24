// Audio stream manager

class Audio {
  constructor({ onStream }) {
    this.players = [];
    this.onFirstInteraction = this.onFirstInteraction.bind(this);
    window.addEventListener('mousedown', this.onFirstInteraction);
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        this.userMedia = stream;
        if (onStream) {
          onStream();
        }
      })
      .catch(() => {});
  }

  onFirstInteraction() {
    const { players } = this;
    window.removeEventListener('mousedown', this.onFirstInteraction);
    this.isReady = true;
    players.forEach((player) => (player.play()));
  }

  addStream(stream) {
    const { isReady, players } = this;
    const player = document.createElement('audio');
    player.srcObject = stream;
    players.push(player);
    if (isReady) player.play();
    return player;
  }

  removeStream(player) {
    const { players } = this;
    const index = players.findIndex((stream) => (stream === player));
    if (~index) {
      players.splice(index, 1);
    }
    player.srcObject = null;
  }
}

export default Audio;
