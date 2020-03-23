const { v4: uuid } = require('uuid');

class Room {
  constructor({
    dimensions,
    displays,
  }) {
    this.clients = [];
    this.dimensions = dimensions;
    this.displays = [...Array(displays)].map(() => (
      new Uint8Array([...Array(dimensions.width * dimensions.height)].map(() => (
        Math.random() > 0.5 ? 1 : 0
      )))
    ));
  }

  onClose(client) {
    const { clients, pingInterval } = this;
    const index = clients.findIndex(({ id }) => (id === client.id));
    if (~index) {
      clients.splice(index, 1);
      this.push({
        event: {
          type: 'LEAVE',
          data: client.id,
        },
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
          Buffer.from(display.buffer).toString('base64')
        )),
        peers: clients.map(({ id }) => (id)),
      },
    }), () => {});
    this.push({
      event: {
        type: 'JOIN',
        data: client.id,
      },
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
            this.push({
              event: {
                type: 'SIGNAL',
                data: {
                  peer: client.id,
                  signal,
                },
              },
              include: peer,
            });
          }
        }
        break;
      }
      case 'UPDATE': {
        let { display, pixel, state } = request.data;
        display = parseInt(display, 10);
        pixel = {
          x: parseInt(pixel ? pixel.x : 0, 10),
          y: parseInt(pixel ? pixel.y : 0, 10),
        };
        state = parseInt(state, 10);
        if (!(
          (
            isNaN(display)
            || display < 0
            || display >= displays.length
          )
          || (
            isNaN(pixel.x)
            || pixel.x < 0
            || pixel.x >= dimensions.width
          )
          || (
            isNaN(pixel.y)
            || pixel.y < 0
            || pixel.y >= dimensions.height
          )
          || (
            isNaN(state)
            || state < 0
            || state > 1
          )
        )) {
          this.update({
            client: client.id,
            display,
            pixel,
            state,
          });
        }
        break;
      }
      default:
        break;
    }
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

  push({ event, exclude, include }) {
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

  update({
    client,
    display,
    pixel,
    state,
  }) {
    const { dimensions, displays } = this;
    displays[display][(dimensions.width * pixel.y) + pixel.x] = state;
    this.push({
      event: {
        type: 'UPDATE',
        data: {
          display,
          pixel,
          state,
        },
      },
      exclude: client,
    });
  }
}

module.exports = Room;
