#!/bin/bash

for i in {0..0}
do {
  { sleep 0; node server;  } &
  { sleep 2; node server;  } &
  { sleep 4; node server;  } &
  wait
} done
