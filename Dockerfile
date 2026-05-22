# ---- Build stage ----
FROM gcc:13 AS builder
RUN apt-get update && apt-get install -y --no-install-recommends cmake && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY main.cpp httplib.h vectordb_core.h CMakeLists.txt ./
COPY tests/ ./tests/
RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build

# ---- Runtime stage ----
FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /build/build/db .
EXPOSE 8080
CMD ["./db"]
