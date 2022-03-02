cmake_minimum_required(VERSION 3.13)

set(PROJECT_NAME ReviewMe)
set(PROJECT_VERSION 0.1)

project(${PROJECT_NAME}
        VERSION ${PROJECT_VERSION}
        LANGUAGES CXX)
# find_package ( Threads REQUIRED )
find_package(Boost COMPONENTS system filesystem REQUIRED)

file(GLOB_RECURSE SRC src/*.cpp src/*.h src/*.hpp)

add_executable(${PROJECT_NAME} ${SRC})

target_include_directories(${PROJECT_NAME}
    PRIVATE
        ./src/
)

target_include_directories(${PROJECT_NAME} SYSTEM
    PRIVATE
        /include/
)

# target_link_directories(${PROJECT_NAME}
#     PUBLIC
#     PRIVATE
#         /usr/local/lib
# )

target_compile_features(${PROJECT_NAME} PUBLIC cxx_std_17)

target_link_libraries(${PROJECT_NAME}
    PUBLIC
    PRIVATE
        hv
        hiredis
        redis++
        ${Boost_FILESYSTEM_LIBRARY}
        ${Boost_SYSTEM_LIBRARY}
)
# ${CMAKE_THREAD_LIBS_INIT}
