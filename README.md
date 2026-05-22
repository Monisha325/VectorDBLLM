# VectorDB — Vector Database from Scratch in C++

A working vector database built in C++17 with three search algorithms, a RAG pipeline, and a web UI. Built as an educational project to show how systems like Pinecone, Weaviate, and Chroma work under the hood.

<img width="1381" height="868" alt="image" src="https://github.com/user-attachments/assets/826b86fe-513f-43b2-9d07-443436f74f23" />

---

## Features

| | |
|---|---|
| **HNSW** | Hierarchical Navigable Small World — approximate nearest-neighbor search in O(log N) |
| **KD-Tree** | Exact k-NN via binary space partitioning — degrades gracefully to show dimensional tradeoffs |
| **Brute Force** | Exact O(N·d) baseline for correctness comparison and benchmarking |
| **Distance Metrics** | Euclidean, Cosine, Manhattan — switchable at query time |
| **REST API** | Full CRUD + search + benchmark endpoints at `localhost:8080` |
| **Ollama Embeddings** | Paste text → `nomic-embed-text` converts it to a 768D vector |
| **RAG Pipeline** | HNSW retrieves relevant chunks → `llama3.2` generates a grounded answer |
| **Web UI** | PCA scatter plot, algorithm comparison, document store, and chat — React + Vite frontend at `localhost:5173` |
| **Docker** | `docker compose up --build` starts the app and Ollama together |
| **Test Suite** | 33 Catch2 tests covering all algorithms, distance metrics, and edge cases |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Core | C++17, single translation unit |
| Build | CMake 3.16+, Debug and Release configs |
| Tests | Catch2 v3 (via FetchContent) |
| HTTP | [cpp-httplib](https://github.com/yhirose/cpp-httplib) — single-header server |
| Containers | Docker, Docker Compose |
| LLM | [Ollama](https://ollama.com) — `nomic-embed-text` (768D embeddings), `llama3.2` (generation) |
| Frontend | React 18, Vite 5 — Canvas 2D for PCA visualization |

---

## How It Works

```
User query
    │
    ▼
Ollama — nomic-embed-text     converts text to a 768D vector
    │
    ▼
HNSW Index (C++)              finds nearest-neighbor chunks in O(log N)
    │
    ▼
Retrieved context chunks
    │
    ▼
Ollama — llama3.2             generates an answer grounded in those chunks
    │
    ▼
Answer
```

---

## Build and Run

### Option 1 — Docker (API) + React frontend

Start the API and Ollama:
```bash
docker compose up --build
```

Pull the AI models once (persisted in a named volume):
```bash
docker exec -it vectordblm-main-ollama-1 ollama pull nomic-embed-text
docker exec -it vectordblm-main-ollama-1 ollama pull llama3.2
```

The API runs at `http://localhost:8080`. Then start the React UI in a separate terminal:
```bash
cd frontend-react
npm install
npm run dev
```

Open `http://localhost:5173`.

### Option 2 — CMake (local build)

**Prerequisites:** GCC/Clang with C++17, CMake 3.16+, Git

```bash
# Release build
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .
./db

# Debug build
cmake .. -DCMAKE_BUILD_TYPE=Debug
cmake --build .
```

Ollama must be running separately (`ollama serve`) for the embedding and RAG features to work.

---

## Tests

**33 test cases** built with [Catch2 v3](https://github.com/catchorg/Catch2), covering:

| Tag | What is tested |
|---|---|
| `[distance]` | Euclidean, cosine, manhattan — zero distance, known values (3-4-5 triangle), edge cases (zero vector, orthogonal, opposite) |
| `[bruteforce]` | Insert, knn correctness, empty index, k > N, duplicate embeddings |
| `[kdtree]` | Insert, knn correctness, empty index, k > N, duplicate embeddings |
| `[hnsw]` | Insert, knn correctness, empty index, k > N, remove |
| `[vectordb]` | Unified insert/remove/search across all 3 algorithms; algorithm agreement |

**Build and run tests:**

```bash
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Debug   # downloads Catch2 via FetchContent on first run
cmake --build . --target vectordb_tests
ctest --output-on-failure

# Or run directly with tag filtering:
./vectordb_tests "[distance]"
./vectordb_tests "[hnsw]"
```

---

## REST API

### Demo Vector Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/search?v=f1,f2,...&k=5&metric=cosine&algo=hnsw` | K-NN search |
| `POST` | `/insert` | Insert a vector |
| `DELETE` | `/delete/:id` | Delete by ID |
| `GET` | `/items` | List all vectors |
| `GET` | `/benchmark?v=...&k=5&metric=cosine` | Compare all 3 algorithms |
| `GET` | `/hnsw-info` | Graph structure and layer statistics |
| `GET` | `/stats` | Database statistics |

### Document and RAG Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/doc/insert` | Chunk, embed, and store a document |
| `GET` | `/doc/list` | List stored chunks |
| `DELETE` | `/doc/delete/:id` | Delete a chunk |
| `POST` | `/doc/ask` | RAG: retrieve relevant chunks and generate an answer |
| `GET` | `/status` | Ollama availability and model info |

---

## Project Structure

```
VectorDBLLM/
├── main.cpp            HTTP server, REST handlers, OllamaClient, DocumentDB
├── vectordb_core.h     VectorItem, BruteForce, KDTree, HNSW, VectorDB, distance functions
├── httplib.h           cpp-httplib single-header HTTP library
├── frontend-react/     React web UI — Vite dev server proxies API calls to :8080
├── CMakeLists.txt      CMake build — db target + vectordb_tests target with Catch2
├── Dockerfile          Multi-stage: gcc:13 builder → debian:bookworm-slim runtime
├── docker-compose.yml  vectordb + ollama services with persistent model volume
└── tests/
    └── test_vectordb.cpp   33 Catch2 tests
```

---

## Engineering Decisions

**Why C++?**
The goal is to show how vector search actually works — not to use a library that hides it. C++17 gives full control over memory layout and algorithm implementation with no magic.

**Why HNSW as the primary algorithm?**
It's the same algorithm used in production vector databases (Pinecone, Weaviate, Chroma, Milvus). KD-Tree is included side-by-side specifically to demonstrate the curse of dimensionality: it's competitive at 16D but collapses at 768D because axis-aligned pruning stops working in high-dimensional space.

**Why local Ollama?**
No API keys, no cloud costs, no data leaving the machine. Keeps the project fully self-contained and reproducible.

**Why CMake and Docker?**
CMake makes the project buildable across Windows (MSYS2), Linux, and macOS without changing source. Docker makes the entire stack — app, Ollama, model serving — runnable on any machine with one command, which matters for reviewers who want to try it quickly.

---

## Future Improvements

- **Persistence** — serialize the HNSW graph and stored embeddings to disk so the index survives restarts
- **Recall benchmarks** — measure recall@k against a ground-truth dataset to quantify HNSW approximation quality
- **Performance tuning** — SIMD distance functions, expose M and ef_construction as runtime parameters

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Ollama: OFFLINE` | Run `ollama serve`, or start the Docker stack |
| Embedding is slow on first use | Ollama is downloading the model — wait ~2 minutes |
| Port 8080 in use | `netstat -ano \| findstr 8080` then `taskkill /PID <pid> /F` |
| LLM answers are slow | Normal on CPU — switch to `llama3.2:1b` for faster responses |
| `g++: command not found` (Windows) | Add `C:\msys64\ucrt64\bin` to your PATH |
