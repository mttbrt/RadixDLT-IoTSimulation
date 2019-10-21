#!/bin/sh

{ node server 0; } & { sleep 1; node server 1; } & { sleep 2; node server 2; } &
