#!/bin/bash

# Refresh the betanet emulator
docker-compose -p betanet-container -f betanet-emulator.yml pull
