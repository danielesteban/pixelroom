FROM node:erbium

# Create working directory
RUN mkdir -p /usr/src/pixelroom
WORKDIR /usr/src/pixelroom

# Install dependencies
COPY package.json .
COPY package-lock.json .
RUN npm install

# Copy server & client
COPY server/ server/
COPY client/ client/

# Create data volume
RUN mkdir data && chown node:node data

# De-escalate privileges
USER node

# Start server
CMD [ "node", "server/main.js" ]
