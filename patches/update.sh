#!/bin/bash

for d in langchain-community-dist-vectorstores langchain-community-vectorstores langchain-dist-vectorstores langchain-vectorstores; do
  mkdir -p patches/$d
done

cp /home/phil/git/langchainjs/libs/langchain-community/dist/vectorstores/cassandra* patches/langchain-community-dist-vectorstores/
cp /home/phil/git/langchainjs/libs/langchain-community/vectorstores/cassandra*      patches/langchain-community-vectorstores/
cp /home/phil/git/langchainjs/langchain/dist/vectorstores/cassandra*                patches/langchain-dist-vectorstores
cp /home/phil/git/langchainjs/langchain/vectorstores/cassandra*                     patches/langchain-vectorstores/
