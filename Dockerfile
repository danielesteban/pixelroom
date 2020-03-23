FROM node:erbium

# Install forever
ENV NODE_ENV=production
RUN npm install --global forever

# Set the timezone
RUN rm -f /etc/localtime && ln -s /usr/share/zoneinfo/Europe/Madrid /etc/localtime

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

# De-escalate privileges
USER node

# Start server
CMD [ "forever", "src/index.js" ]
