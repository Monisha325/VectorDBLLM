cmake_minimum_required(VERSION 3.16)
project(VectorDBLLM VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type (Debug|Release)" FORCE)
endif()

add_executable(db main.cpp)

# httplib.h lives in the project root
target_include_directories(db PRIVATE ${CMAKE_SOURCE_DIR})

find_package(Threads REQUIRED)
target_link_libraries(db PRIVATE Threads::Threads)
if(WIN32)
  target_link_libraries(db PRIVATE ws2_32)
endif()

target_compile_options(db PRIVATE
  $<$<CONFIG:Debug>:-g;-O0>
  $<$<CONFIG:Release>:-O2>
)

# ---- Tests -----------------------------------------------------------
include(FetchContent)
FetchContent_Declare(
  Catch2
  GIT_REPOSITORY https://github.com/catchorg/Catch2.git
  GIT_TAG        v3.4.0
)
FetchContent_MakeAvailable(Catch2)

add_executable(vectordb_tests tests/test_vectordb.cpp)
target_include_directories(vectordb_tests PRIVATE ${CMAKE_SOURCE_DIR})
target_link_libraries(vectordb_tests PRIVATE Catch2::Catch2WithMain)
target_compile_options(vectordb_tests PRIVATE
  $<$<CONFIG:Debug>:-g;-O0>
  $<$<CONFIG:Release>:-O2>
)

enable_testing()
list(APPEND CMAKE_MODULE_PATH ${catch2_SOURCE_DIR}/extras)
include(Catch)
catch_discover_tests(vectordb_tests)
