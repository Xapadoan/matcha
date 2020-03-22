#!/bin/bash
node serveur.js > error.log 2>&1 &
echo $! > server.pid
