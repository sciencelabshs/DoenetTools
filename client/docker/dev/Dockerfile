FROM node:19.8-bullseye

RUN echo "deb http://deb.debian.org/debian bullseye-backports main" >/etc/apt/sources.list.d/bullseye-backports.list

RUN apt-get update && \
    apt-get -y install \
    gnome-keyring \
    # for docker from source
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    #update git to support ssh signing
    git/bullseye-backports

WORKDIR /
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

RUN echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

RUN apt-get update && \
    apt-get -y install docker-ce docker-ce-cli containerd.io

RUN rm -rf /var/lib/apt/lists/* &&\
    apt-get -y autoremove && \
    apt-get clean

RUN mkdir -p /home/node/workspace/node_modules && chown -R node:node /home/node/workspace
WORKDIR /home/node/workspace
COPY --chown=node:node package*.json vite.config.js ./
USER node

CMD ["npm", "run", "dev"]