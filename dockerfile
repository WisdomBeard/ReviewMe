FROM debian:stable-slim AS builder

SHELL [ "bash", "-c" ]

WORKDIR /opt/ReviewMe/src

RUN apt-get update && apt-get install -y \
    cmake \
    gcc \
    g++ \
    git \
    libboost-dev \
    libboost-filesystem-dev

WORKDIR /opt/
RUN git clone -b v1.2.4 --single-branch https://github.com/ithewei/libhv.git && \
    cd libhv && mkdir build && \
    cd build && \
    cmake .. && \
    cmake --build . -j 4 && cmake --install . --prefix /

WORKDIR /opt/
RUN git clone -b v1.3.1 --single-branch https://github.com/adishavit/argh.git && \
    cd argh && mkdir build && \
    cd build && \
    cmake .. && \
    cmake --build . -j 4 && cmake --install . --prefix /

WORKDIR /opt/
RUN git clone -b v1.0.2 --single-branch https://github.com/redis/hiredis.git && \
    cd hiredis && \
    make && \
    make install

WORKDIR /opt/
RUN git clone -b 1.3.3 --single-branch https://github.com/sewenew/redis-plus-plus.git && \
    cd redis-plus-plus && \
    mkdir build && cd build  && \
    cmake -DREDIS_PLUS_PLUS_CXX_STANDARD=17 .. && \
    make && \
    make install

WORKDIR /opt/
RUN git clone https://github.com/vishnubob/wait-for-it.git

WORKDIR /opt/ReviewMe/
ADD . .
RUN mkdir server/build && cd server/build && cmake .. && cmake --build . -j 4

FROM debian:stable-slim

ENV DB_HOST=
ENV DB_PORT=
ENV TIMEOUT=30

WORKDIR /opt/ReviewMe/reviews/

COPY --from=builder /lib/libhv.so /lib/
COPY --from=builder /usr/lib/x86_64-linux-gnu/libboost_filesystem.so.1.74.0 /usr/lib/x86_64-linux-gnu/
COPY --from=builder /usr/local/lib/libredis++.so.1 /usr/local/lib/libhiredis.so.1.0.0 \
    /usr/local/lib/
COPY --from=builder /opt/wait-for-it/wait-for-it.sh /opt/wait-for-it/
COPY --from=builder /opt/ReviewMe/server/build/ReviewMe /opt/ReviewMe/server/build/
COPY --from=builder /opt/ReviewMe/www /opt/ReviewMe/www/

ENTRYPOINT export LD_LIBRARY_PATH=/usr/local/lib && \
           /opt/wait-for-it/wait-for-it.sh  ${DB_HOST}:${DB_PORT} -s -t ${TIMEOUT} -- \
           /opt/ReviewMe/server/build/ReviewMe --db_host ${DB_HOST} --db_port ${DB_PORT}
# ENTRYPOINT [ "/bin/bash", "-c", "sleep 3600" ]
