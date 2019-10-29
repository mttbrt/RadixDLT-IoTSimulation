#!/bin/bash

# Reset Docker containers
./scripts/stop_docker.sh
wait
docker rm -f $(docker ps -a -q)
wait
docker volume rm $(docker volume ls -q)
wait
./scripts/start_docker.sh
wait
