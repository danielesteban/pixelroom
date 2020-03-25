const compression = require('compression');
const express = require('express');
const expressWS = require('express-ws');
const helmet = require('helmet');
const path = require('path');
const Room = require('./room');

const room = new Room({
  dimensions: {
    width: 10 * 4,
    height: 3 * 4,
  },
  displays: 4,
  storage: path.join(__dirname, '..', 'data'),
});

const shutdown = () => {
  room.persist();
  process.exit(0);
};
process
  .on('SIGTERM', shutdown)
  .on('SIGINT', shutdown);

const server = express();
server.use(compression());
server.use(helmet());
server.use(express.static(path.join(__dirname, '..', 'client')));
expressWS(server, null, { clientTracking: false, perMessageDeflate: true });
server.ws('/', room.onClient.bind(room));
server.use((req, res) => res.status(404).end());
server.listen(process.env.PORT || 8080);
