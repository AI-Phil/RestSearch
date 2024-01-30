import { CassandraStore, CassandraLibArgs } from "@langchain/community/vectorstores/cassandra";
import { CassandraClientFactory } from "@langchain/community/utils/cassandra";
import { Client } from "cassandra-driver";
import { OpenAIEmbeddings } from "@langchain/openai";

class AstraClientManager {
    private vectorStoreInitialization: Promise<CassandraStore> | null = null;
    private nativeClientInitialization: Promise<Client> | null = null;
    private config: CassandraLibArgs;
    private embeddings: OpenAIEmbeddings;

    constructor(embeddings: OpenAIEmbeddings, config: CassandraLibArgs) {
        this.embeddings = embeddings;
        this.config = config;

        this.vectorStoreInitialization = CassandraStore.fromExistingIndex(this.embeddings, this.config);
        this.nativeClientInitialization = CassandraClientFactory.getClient(this.config);
    }

    async getVectorStore(): Promise<CassandraStore> {
        if (!this.vectorStoreInitialization) {
            this.vectorStoreInitialization = CassandraStore.fromExistingIndex(this.embeddings, this.config);
        }

        try {
            return await this.vectorStoreInitialization;
        } catch (error) {
            console.error("Error initializing CassandraStore:", error);
            this.vectorStoreInitialization = null;
            throw error;
        }
    }


    async getNativeClient(): Promise<Client> {
        if (!this.nativeClientInitialization) {
            this.nativeClientInitialization = CassandraClientFactory.getClient(this.config);
        }

        try {
            return await this.nativeClientInitialization!;
        } catch (error) {
            console.error("Error initializing NativeClient:", error);
            this.nativeClientInitialization = null;
            throw error;
        }
    }
}

export default AstraClientManager;
