#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>
#include "vectordb_core.h"

using Catch::Approx;

// ---- helpers --------------------------------------------------------

static VectorItem makeItem(int id, std::vector<float> emb) {
    return {id, "item" + std::to_string(id), "test", emb};
}

// Three clearly separated 2D points used across multiple test cases:
//   A = (1, 0)    B = (0, 1)    C = (10, 10)
// Query (0.9, 0) is unambiguously closest to A by any metric.

// =====================================================================
//  DISTANCE METRICS
// =====================================================================

TEST_CASE("euclidean: zero distance for identical vectors", "[distance]") {
    REQUIRE(euclidean({0.f, 0.f}, {0.f, 0.f}) == Approx(0.f));
    REQUIRE(euclidean({3.f, 4.f}, {3.f, 4.f}) == Approx(0.f));
}

TEST_CASE("euclidean: known 3-4-5 right triangle", "[distance]") {
    // sqrt(3^2 + 4^2) = 5
    REQUIRE(euclidean({3.f, 0.f}, {0.f, 4.f}) == Approx(5.f));
}

TEST_CASE("euclidean: unit axis vectors", "[distance]") {
    REQUIRE(euclidean({1.f, 0.f}, {0.f, 0.f}) == Approx(1.f));
    REQUIRE(euclidean({0.f, 0.f}, {0.f, 1.f}) == Approx(1.f));
}

TEST_CASE("cosine: identical vectors have distance 0", "[distance]") {
    REQUIRE(cosine({1.f, 0.f}, {1.f, 0.f}) == Approx(0.f).margin(1e-5f));
    REQUIRE(cosine({1.f, 1.f}, {1.f, 1.f}) == Approx(0.f).margin(1e-5f));
}

TEST_CASE("cosine: orthogonal vectors have distance 1", "[distance]") {
    REQUIRE(cosine({1.f, 0.f}, {0.f, 1.f}) == Approx(1.f).margin(1e-5f));
}

TEST_CASE("cosine: opposite vectors have distance 2", "[distance]") {
    REQUIRE(cosine({1.f, 0.f}, {-1.f, 0.f}) == Approx(2.f).margin(1e-5f));
}

TEST_CASE("cosine: zero vector returns sentinel 1.0", "[distance]") {
    // Guard branch: na < 1e-9 → return 1.0f
    REQUIRE(cosine({0.f, 0.f}, {1.f, 0.f}) == Approx(1.f));
}

TEST_CASE("manhattan: known values", "[distance]") {
    REQUIRE(manhattan({0.f, 0.f}, {0.f, 0.f}) == Approx(0.f));
    // |1-4| + |2-6| = 3 + 4 = 7
    REQUIRE(manhattan({1.f, 2.f}, {4.f, 6.f}) == Approx(7.f));
}

TEST_CASE("getDistFn returns correct function", "[distance]") {
    auto fn = getDistFn("cosine");
    REQUIRE(fn({1.f, 0.f}, {1.f, 0.f}) == Approx(0.f).margin(1e-5f));

    fn = getDistFn("manhattan");
    REQUIRE(fn({1.f, 2.f}, {4.f, 6.f}) == Approx(7.f));

    fn = getDistFn("euclidean");
    REQUIRE(fn({3.f, 0.f}, {0.f, 4.f}) == Approx(5.f));

    // unknown metric falls back to euclidean
    fn = getDistFn("unknown");
    REQUIRE(fn({3.f, 0.f}, {0.f, 4.f}) == Approx(5.f));
}

// =====================================================================
//  BRUTE FORCE
// =====================================================================

TEST_CASE("BruteForce: empty index returns no results", "[bruteforce]") {
    BruteForce bf;
    REQUIRE(bf.knn({1.f, 0.f}, 5, euclidean).empty());
}

TEST_CASE("BruteForce: insertion grows item count", "[bruteforce]") {
    BruteForce bf;
    bf.insert(makeItem(1, {1.f, 0.f}));
    bf.insert(makeItem(2, {0.f, 1.f}));
    REQUIRE(bf.items.size() == 2);
}

TEST_CASE("BruteForce: nearest neighbor is correct", "[bruteforce]") {
    BruteForce bf;
    bf.insert(makeItem(1, {1.f, 0.f}));
    bf.insert(makeItem(2, {0.f, 1.f}));
    bf.insert(makeItem(3, {10.f, 10.f}));

    auto res = bf.knn({0.9f, 0.f}, 1, euclidean);
    REQUIRE(res.size() == 1);
    REQUIRE(res[0].second == 1);
}

TEST_CASE("BruteForce: results are sorted ascending by distance", "[bruteforce]") {
    BruteForce bf;
    bf.insert(makeItem(1, {1.f, 0.f}));
    bf.insert(makeItem(2, {0.f, 1.f}));
    bf.insert(makeItem(3, {10.f, 10.f}));

    auto res = bf.knn({0.9f, 0.f}, 3, euclidean);
    REQUIRE(res.size() == 3);
    REQUIRE(res[0].first <= res[1].first);
    REQUIRE(res[1].first <= res[2].first);
}

TEST_CASE("BruteForce: k greater than N returns all N items", "[bruteforce]") {
    BruteForce bf;
    bf.insert(makeItem(1, {1.f, 0.f}));
    bf.insert(makeItem(2, {0.f, 1.f}));

    auto res = bf.knn({0.5f, 0.5f}, 100, euclidean);
    REQUIRE(res.size() == 2);
}

TEST_CASE("BruteForce: duplicate embeddings both inserted and found", "[bruteforce]") {
    BruteForce bf;
    bf.insert(makeItem(1, {1.f, 0.f}));
    bf.insert(makeItem(2, {1.f, 0.f}));  // same embedding, different id

    REQUIRE(bf.items.size() == 2);
    auto res = bf.knn({1.f, 0.f}, 2, euclidean);
    REQUIRE(res.size() == 2);
    REQUIRE(res[0].first == Approx(0.f));
    REQUIRE(res[1].first == Approx(0.f));
}

// =====================================================================
//  KD-TREE
// =====================================================================

TEST_CASE("KDTree: empty index returns no results", "[kdtree]") {
    KDTree kdt(2);
    REQUIRE(kdt.knn({1.f, 0.f}, 5, euclidean).empty());
}

TEST_CASE("KDTree: nearest neighbor is correct", "[kdtree]") {
    KDTree kdt(2);
    kdt.insert(makeItem(1, {1.f, 0.f}));
    kdt.insert(makeItem(2, {0.f, 1.f}));
    kdt.insert(makeItem(3, {10.f, 10.f}));

    auto res = kdt.knn({0.9f, 0.f}, 1, euclidean);
    REQUIRE(res.size() == 1);
    REQUIRE(res[0].second == 1);
}

TEST_CASE("KDTree: results are sorted ascending by distance", "[kdtree]") {
    KDTree kdt(2);
    kdt.insert(makeItem(1, {1.f, 0.f}));
    kdt.insert(makeItem(2, {0.f, 1.f}));
    kdt.insert(makeItem(3, {10.f, 10.f}));

    auto res = kdt.knn({0.9f, 0.f}, 3, euclidean);
    REQUIRE(res.size() == 3);
    REQUIRE(res[0].first <= res[1].first);
    REQUIRE(res[1].first <= res[2].first);
}

TEST_CASE("KDTree: k greater than N returns all N items", "[kdtree]") {
    KDTree kdt(2);
    kdt.insert(makeItem(1, {1.f, 0.f}));
    kdt.insert(makeItem(2, {0.f, 1.f}));

    auto res = kdt.knn({0.5f, 0.5f}, 100, euclidean);
    REQUIRE(res.size() == 2);
}

TEST_CASE("KDTree: duplicate embeddings both inserted and found", "[kdtree]") {
    KDTree kdt(2);
    kdt.insert(makeItem(1, {1.f, 0.f}));
    kdt.insert(makeItem(2, {1.f, 0.f}));

    auto res = kdt.knn({1.f, 0.f}, 2, euclidean);
    REQUIRE(res.size() == 2);
    REQUIRE(res[0].first == Approx(0.f));
    REQUIRE(res[1].first == Approx(0.f));
}

// =====================================================================
//  HNSW
// =====================================================================

TEST_CASE("HNSW: empty index returns no results", "[hnsw]") {
    HNSW h;
    REQUIRE(h.knn({1.f, 0.f}, 5, 50, euclidean).empty());
}

TEST_CASE("HNSW: single insertion, size is 1", "[hnsw]") {
    HNSW h;
    h.insert(makeItem(1, {1.f, 0.f}), euclidean);
    REQUIRE(h.size() == 1);
}

TEST_CASE("HNSW: nearest neighbor is correct", "[hnsw]") {
    HNSW h;
    h.insert(makeItem(1, {1.f, 0.f}), euclidean);
    h.insert(makeItem(2, {0.f, 1.f}), euclidean);
    h.insert(makeItem(3, {10.f, 10.f}), euclidean);

    auto res = h.knn({0.9f, 0.f}, 1, 50, euclidean);
    REQUIRE(res.size() == 1);
    REQUIRE(res[0].second == 1);
}

TEST_CASE("HNSW: k greater than N returns at most N items", "[hnsw]") {
    HNSW h;
    h.insert(makeItem(1, {1.f, 0.f}), euclidean);
    h.insert(makeItem(2, {0.f, 1.f}), euclidean);

    auto res = h.knn({0.5f, 0.5f}, 100, 50, euclidean);
    REQUIRE(res.size() <= 2);
}

TEST_CASE("HNSW: remove reduces size and excludes item from results", "[hnsw]") {
    HNSW h;
    h.insert(makeItem(1, {1.f, 0.f}), euclidean);
    h.insert(makeItem(2, {0.f, 1.f}), euclidean);
    h.insert(makeItem(3, {10.f, 10.f}), euclidean);

    h.remove(1);
    REQUIRE(h.size() == 2);

    auto res = h.knn({0.9f, 0.f}, 3, 50, euclidean);
    for (auto& [d, id] : res)
        REQUIRE(id != 1);
}

// =====================================================================
//  VECTOR DATABASE  (unified interface)
// =====================================================================

TEST_CASE("VectorDB: insert increments size", "[vectordb]") {
    VectorDB db(2);
    REQUIRE(db.size() == 0);
    db.insert("a", "t", {1.f, 0.f}, euclidean);
    REQUIRE(db.size() == 1);
    db.insert("b", "t", {0.f, 1.f}, euclidean);
    REQUIRE(db.size() == 2);
}

TEST_CASE("VectorDB: remove decrements size and returns false for missing id", "[vectordb]") {
    VectorDB db(2);
    int id = db.insert("a", "t", {1.f, 0.f}, euclidean);
    REQUIRE(db.remove(id) == true);
    REQUIRE(db.size() == 0);
    REQUIRE(db.remove(id) == false);  // already gone
}

TEST_CASE("VectorDB: bruteforce search finds nearest neighbor", "[vectordb]") {
    VectorDB db(2);
    int id1 = db.insert("near",    "t", {1.f,  0.f},  euclidean);
    /*int id2=*/ db.insert("far",  "t", {0.f,  1.f},  euclidean);
    /*int id3=*/ db.insert("far2", "t", {10.f, 10.f}, euclidean);

    auto out = db.search({0.9f, 0.f}, 1, "euclidean", "bruteforce");
    REQUIRE(out.hits.size() == 1);
    REQUIRE(out.hits[0].id == id1);
}

TEST_CASE("VectorDB: kdtree search finds nearest neighbor", "[vectordb]") {
    VectorDB db(2);
    int id1 = db.insert("near",    "t", {1.f,  0.f},  euclidean);
    /*int id2=*/ db.insert("far",  "t", {0.f,  1.f},  euclidean);
    /*int id3=*/ db.insert("far2", "t", {10.f, 10.f}, euclidean);

    auto out = db.search({0.9f, 0.f}, 1, "euclidean", "kdtree");
    REQUIRE(out.hits.size() == 1);
    REQUIRE(out.hits[0].id == id1);
}

TEST_CASE("VectorDB: hnsw search finds nearest neighbor", "[vectordb]") {
    VectorDB db(2);
    int id1 = db.insert("near",    "t", {1.f,  0.f},  euclidean);
    /*int id2=*/ db.insert("far",  "t", {0.f,  1.f},  euclidean);
    /*int id3=*/ db.insert("far2", "t", {10.f, 10.f}, euclidean);

    auto out = db.search({0.9f, 0.f}, 1, "euclidean", "hnsw");
    REQUIRE(out.hits.size() == 1);
    REQUIRE(out.hits[0].id == id1);
}

TEST_CASE("VectorDB: search after remove excludes deleted item", "[vectordb]") {
    VectorDB db(2);
    int id1 = db.insert("near",    "t", {1.f,  0.f},  euclidean);
    /*int id2=*/ db.insert("next", "t", {1.1f, 0.f},  euclidean);

    db.remove(id1);

    for (auto& algo : {"bruteforce", "kdtree", "hnsw"}) {
        auto out = db.search({0.9f, 0.f}, 2, "euclidean", algo);
        for (auto& h : out.hits)
            REQUIRE(h.id != id1);
    }
}

TEST_CASE("VectorDB: k greater than N returns at most N hits", "[vectordb]") {
    VectorDB db(2);
    db.insert("a", "t", {1.f, 0.f}, euclidean);
    db.insert("b", "t", {0.f, 1.f}, euclidean);

    for (auto& algo : {"bruteforce", "kdtree", "hnsw"}) {
        auto out = db.search({0.5f, 0.5f}, 100, "euclidean", algo);
        REQUIRE(out.hits.size() <= 2);
    }
}

TEST_CASE("VectorDB: all three algorithms agree on nearest neighbor", "[vectordb]") {
    VectorDB db(2);
    int id1 = db.insert("near",    "t", {1.f,  0.f},  euclidean);
    /*int id2=*/ db.insert("far",  "t", {0.f,  1.f},  euclidean);
    /*int id3=*/ db.insert("far2", "t", {10.f, 10.f}, euclidean);

    for (auto& algo : {"bruteforce", "kdtree", "hnsw"}) {
        auto out = db.search({0.9f, 0.f}, 1, "euclidean", algo);
        REQUIRE(out.hits.size() == 1);
        REQUIRE(out.hits[0].id == id1);
    }
}
