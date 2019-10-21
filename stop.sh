#!/bin/bash
if [ -e server.pid ]
then
	kill $(cat server.pid)
	rm server.pid
else
	echo 'server.pid not found'
fi
