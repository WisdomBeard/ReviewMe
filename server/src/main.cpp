#include <iostream>
#include <hv/HttpServer.h>
#include <argh.h>
#include <string>
#include <fstream>
#include <vector>
#include <unordered_map>
#include <exception>
#include <boost/filesystem.hpp>
#include <boost/uuid/random_generator.hpp>
#include <boost/uuid/uuid_io.hpp>
#include <sw/redis++/redis++.h>

using namespace std;
using namespace boost::filesystem;
using namespace sw::redis;

int main(int argc, char* argv[])
{
    argh::parser cmdl(argv, argh::parser::PREFER_PARAM_FOR_UNREG_OPTION);
    
    // Server config

    unsigned short port;
    cmdl("port", 8080) >> port;

    // DB config

    string         db_host;
    unsigned short db_port;
    cmdl("db_host", "127.0.0.1") >> db_host;
    cmdl("db_port", 6379) >> db_port;

    string db_url = "tcp://";
    db_url += db_host;
    db_url += ':';
    db_url += to_string(db_port);

    HttpService router;

    boost::uuids::random_generator uuidgen;
    (void) uuidgen(); // We generate a first UUID just to deal with eventual initialization costs

    try {
        // Create an Redis object, which is movable but NOT copyable.
        auto redis = Redis(db_url);

        router.GET("/reviews/{uuid}", [&redis](HttpRequest* req, HttpResponse* resp) {
            path dirPath = current_path();
            dirPath /= req->query_params["uuid"];
            if (!is_directory(dirPath))
            {
                return static_cast< int >(HTTP_STATUS_NOT_FOUND);
            }

            // result map:
            // {
            //     file_name : "..."
            //     file_content : "..."
            //     comments : [
            //         {
            //             reviewer : "..."
            //             fromrow: x
            //             ...
            //         },
            //         ...
            //     ]
            // }
            // unordered_map< string, string > res;
            hv::Json res = hv::Json::object();

            // Get file name and content
            for (directory_entry& x : directory_iterator(dirPath))
            {
                // Open the file
                auto& filePath = x.path();
                std::ifstream ifs{filePath.c_str(), std::ifstream::binary};
                if (!ifs)
                    return static_cast< int >(HTTP_STATUS_INTERNAL_SERVER_ERROR);

                // Get its length
                ifs.seekg (0, ifs.end);
                int length = ifs.tellg();
                ifs.seekg (0, ifs.beg);

                // Read its content
                vector< char > buffer(length + 1, 0);
                ifs.read(buffer.data(), length);

                if (!ifs)
                    return static_cast< int >(HTTP_STATUS_INTERNAL_SERVER_ERROR);
                
                // Close the file
                ifs.close();

                res["file_name"] = filePath.filename().c_str();
                res["file_content"] = buffer.data();
                break; // There should be exactly one file
            }

            // Get comments
            try
            {
                res["comments"] = hv::Json::array();
                auto& comments = res["comments"];

                unordered_map<string, string> id2comments;
                redis.hgetall(req->query_params["uuid"], std::inserter(id2comments, id2comments.end()));
                for (auto& [key, val] : id2comments)
                {
// cout << "key: " << key << " val: " << val << endl;
                    comments.push_back(hv::Json::parse(val));
// cout << "comments: " << comments.dump() << endl;
                }
            }
            catch (exception& e)
            {
                cerr << "Failed to retrieve comments of " << req->query_params["uuid"] << endl << e.what() << endl;
            }

            return resp->Json(res);
        });

        router.POST("/reviews", [&uuidgen, &redis](const HttpContextPtr& ctx) {
            // Check if a "file" field was provided in a multipart form
            auto multiMap = ctx->form();
            auto fileIt = multiMap.find("file");
            if (fileIt == multiMap.end())
            {
                return static_cast< int >(HTTP_STATUS_BAD_REQUEST);
            }
            auto& formData = fileIt->second;

            // Generate uuid
            boost::uuids::uuid id = uuidgen();
            const string& strId = to_string(id);
    // cout << "UUID: " << strId << endl;

            // Create directory
            path dirPath = current_path();
            dirPath /= strId;
    //cout << "Directory to create: " << dirPath << endl;
            (void) create_directories(dirPath);

            // Write file in directory
            {
                path filePath = dirPath;
                filePath /= formData.filename;

                std::ofstream ofs{filePath.c_str(), std::ofstream::out};
                ofs << formData.content;
                ofs.close();
            }

            // Return uuid
            return ctx->sendString(strId);
        });

        router.POST("/reviews/{uuid}/comments", [&redis](const HttpContextPtr& ctx) {
            try {
                auto params = ctx->params();
// cout << "POST comment on uuid: " << params["uuid"] << endl;
                auto jBody = ctx->json();
// cout << "comment: " << ctx->body() << endl;
                redis.hset(params["uuid"], to_string(jBody["id"].get<int>()), ctx->body());
            } catch (exception& e) {
                cerr << "Failed to update a reviewing in Redis DB:" << endl << e.what() << endl;
                return static_cast< int >(HTTP_STATUS_INTERNAL_SERVER_ERROR);
            }
    // cout << "/reviews/" << params["uuid"] << "/comments --> " << ctx->body() << endl;
            return static_cast< int >(HTTP_STATUS_OK);
        });


        router.GET("/{file}", [](HttpRequest* req, HttpResponse* resp) {
            string fileName = req->query_params["file"];
            if (fileName.empty())
            {
                fileName = "ReviewMe.html";
            }
            string filePath = "../www/" + fileName;

            return resp->File(filePath.c_str());
        });

        http_server_t server;
        server.port = port;
        server.service = &router;
        http_server_run(&server);

    } catch (exception& e) {
        cerr << "Failed to connect to Redis DB:" << endl << e.what() << endl;
    }

    return 0;
}