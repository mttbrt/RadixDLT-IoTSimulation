#!/bin/bash

# Run the server
./scripts/start_docker.sh
wait
./scripts/start_mongo.sh
wait

cd server/
nodemon
