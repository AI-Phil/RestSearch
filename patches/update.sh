#!/bin/bash

for d in langchain-community-dist-vectorstores langchain-community-dist-utils langchain-community-vectorstores langchain-dist-vectorstores langchain-vectorstores langchain-community-utils; do
  mkdir -p patches/$d
done

cp /home/phil/winhome/git/langchainjs/libs/langchain-community/dist/vectorstores/cassandra* patches/langchain-community-dist-vectorstores/
cp /home/phil/winhome/git/langchainjs/libs/langchain-community/dist/utils/cassandra*        patches/langchain-community-dist-utils/
cp /home/phil/winhome/git/langchainjs/libs/langchain-community/vectorstores/cassandra*      patches/langchain-community-vectorstores/


#cp /home/phil/winhome/git/langchainjs/libs/langchain-community/vectorstores/cassandra*      patches/langchain-community-vectorstores/
#cp /home/phil/winhome/git/langchainjs/langchain/dist/vectorstores/cassandra*                patches/langchain-dist-vectorstores
#cp /home/phil/winhome/git/langchainjs/langchain/vectorstores/cassandra*                     patches/langchain-vectorstores/
# echo "export * from '../dist/utils/cassandra.js'"                                 > patches/langchain-community-utils/cassandra.js
# echo "export * from '../dist/utils/cassandra.js'"                                 > patches/langchain-community-utils/cassandra.d.js
# echo "module.exports = require('../dist/utils/cassandra.cjs');"                   > patches/langchain-community-utils/cassandra.cjs

cp patches/langchain-community-dist-vectorstores/*                                  node_modules/@langchain/community/dist/vectorstores/
cp patches/langchain-community-dist-utils/*                                         node_modules/@langchain/community/dist/utils/
cp patches/langchain-community-vectorstores/*                                       node_modules/@langchain/community/vectorstores/
#cp patches/langchain-community-utils/*                                              node_modules/@langchain/community/utils/

