
ARG DOCKER_REGISTRY=""
FROM ${DOCKER_REGISTRY}node:10.14.2-slim
LABEL maintainer="yehiyam@gmail.com"
RUN apt update && apt install nano
RUN mkdir /hkube
COPY . /hkube/algorithm-runner
RUN cd /hkube/algorithm-runner
WORKDIR /hkube/algorithm-runner

RUN npm i
CMD ["npm", "start"]