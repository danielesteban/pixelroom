const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

class Room {
  constructor({
    dimensions,
    displays,
    storage,
  }) {
    this.clients = [];
    this.dimensions = dimensions;
    this.storage = storage;
    this.load(displays);
  }

  load(displays) {
    const { dimensions, storage } = this;
    const displaySize = dimensions.width * dimensions.height;
    const fileSize = displaySize * displays;
    let stored;
    try {
      stored = fs.readFileSync(path.join(storage, 'room.bin'));
      if (stored.length !== fileSize) {
        stored = undefined;
      }
    } catch (e) {
      // Fail silently
    }
    this.displays = [...Array(displays)].map((v, display) => (
      stored ? (
        Buffer.from(stored.buffer, stored.byteOffset + (displaySize * display), displaySize)
      ) : (
        Buffer.from([...Array(displaySize)].map(() => {
          if (Math.random() > 0.5) {
            return Math.random() > 0.25 ? 0xFF : Math.floor(Math.random() * 0xFF);
          }
          return 0;
        }))
      )
    ));
  }

  persist() {
    const { dimensions, displays, storage } = this;
    const displaySize = dimensions.width * dimensions.height;
    const buffer = Buffer.concat(displays, displaySize * displays.length);
    try {
      if (!fs.existsSync(storage)) {
        fs.mkdirSync(storage);
      }
      fs.writeFileSync(path.join(storage, 'room.bin'), buffer);
    } catch (err) {
      console.error(err);
    }
  }

  onClose(client) {
    const { clients, pingInterval } = this;
    const index = clients.findIndex(({ id }) => (id === client.id));
    if (~index) {
      clients.splice(index, 1);
      this.broadcast({
        type: 'LEAVE',
        data: client.id,
      });
      if (!clients.length && pingInterval) {
        clearInterval(pingInterval);
        delete this.pingInterval;
      }
    }
  }

  onClient(client) {
    const { clients, displays, pingInterval } = this;
    client.id = uuid();
    client.send(JSON.stringify({
      type: 'LOAD',
      data: {
        displays: displays.map((display) => (
          display.toString('base64')
        )),
        peers: clients.map(({ id }) => (id)),
      },
    }), () => {});
    this.broadcast({
      type: 'JOIN',
      data: client.id,
    });
    clients.push(client);
    client.isAlive = true;
    client.once('close', () => this.onClose(client));
    client.on('message', (data) => this.onMessage(client, data));
    client.on('pong', () => {
      client.isAlive = true;
    });
    if (!pingInterval) {
      this.pingInterval = setInterval(this.ping.bind(this), 60000);
    }
  }

  onMessage(client, data) {
    let request;
    try {
      request = JSON.parse(data);
    } catch (e) {
      return;
    }
    const { clients, dimensions, displays } = this;
    switch (request.type) {
      case 'SIGNAL': {
        let { peer, signal } = request.data;
        peer = `${peer}`;
        signal = `${signal}`;
        if (!(
          !peer
          || !signal
          || clients.findIndex(({ id }) => (id === peer)) === -1
        )) {
          if (client) {
            this.broadcast({
              type: 'SIGNAL',
              data: {
                peer: client.id,
                signal,
              },
            }, {
              include: peer,
            });
          }
        }
        break;
      }
      case 'UPDATE': {
        let { display, pixel, color } = request.data;
        display = parseInt(display, 10);
        pixel = {
          x: parseInt((pixel || {}).x, 10),
          y: parseInt((pixel || {}).y, 10),
        };
        color = parseInt(color, 10);
        if (!(
          Number.isNaN(display)
          || display < 0
          || display >= displays.length
          || Number.isNaN(pixel.x)
          || pixel.x < 0
          || pixel.x >= dimensions.width
          || Number.isNaN(pixel.y)
          || pixel.y < 0
          || pixel.y >= dimensions.height
          || Number.isNaN(color)
          || color < 0
          || color > 255
        )) {
          this.update({
            client: client.id,
            display,
            pixel,
            color,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  broadcast(event, { exclude, include } = {}) {
    const { clients } = this;
    const encoded = JSON.stringify(event);
    if (exclude && !Array.isArray(exclude)) {
      exclude = [exclude];
    }
    if (include && !Array.isArray(include)) {
      include = [include];
    }
    clients.forEach((client) => {
      if (
        (!include || ~include.indexOf(client.id))
        && (!exclude || exclude.indexOf(client.id) === -1)
      ) {
        client.send(encoded, () => {});
      }
    });
  }

  ping() {
    const { clients } = this;
    clients.forEach((client) => {
      if (client.isAlive === false) {
        client.terminate();
        return;
      }
      client.isAlive = false;
      client.ping(() => {});
    });
  }

  update({
    client,
    display,
    pixel,
    color,
  }) {
    const { dimensions, displays } = this;
    displays[display][(dimensions.width * pixel.y) + pixel.x] = color;
    this.broadcast({
      type: 'UPDATE',
      data: {
        display,
        pixel,
        color,
      },
    }, {
      exclude: client,
    });
  }
}

module.exports = Room;
