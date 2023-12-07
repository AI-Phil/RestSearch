import { validateEnvVariables } from './common';
import { CassandraStore, CassandraLibArgs, SupportedVectorTypes } from "langchain/vectorstores/cassandra";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Amenity } from '../schema/Amenity';

validateEnvVariables([
    'CASSANDRA_SCB',
    'CASSANDRA_TOKEN',
    'CASSANDRA_KEYSPACE',
    'OPENAI_EMBEDDING_DIMENSIONS',
    'OPENAI_EMBEDDING_MODEL',
]);

let vectorStore: CassandraStore;
let vectorStoreInitialization: Promise<void>;

async function initializeCassandraStore() {
  const config: CassandraLibArgs = {
    cloud: {
      secureConnectBundle: process.env.CASSANDRA_SCB as string,
    },
    credentials: {
      username: "token",
      password: process.env.CASSANDRA_TOKEN as string,
    },
    keyspace: process.env.CASSANDRA_KEYSPACE as string,
    dimensions: parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS as string),
    table: "amenity_reviews",
    vectorType: process.env.VECTOR_TYPE as SupportedVectorTypes || "cosine",
    primaryKey: [
      {name: "amenity_id", type: "text", partition: true},
      {name: "review_id", type: "uuid"},
    ],
    metadataColumns: [
      {name: "amenity_name",type: "text"},
      {name: "type",type: "text"},
      {name: "coords",type: "VECTOR<FLOAT,2>"},
      {name: "locality",type: "text"},
      {name: "reviewer_name",type: "text"},
      {name: "rating",type: "int"},    
    ],
    indices: [
      { name: "coords", value: "(coords)", options:"{'similarity_function': 'euclidean'}" },
    ],
  };
  
  vectorStoreInitialization = CassandraStore.fromExistingIndex(
    new OpenAIEmbeddings({ modelName: process.env.OPENAI_EMBEDDING_MODEL as string }),
    config
  ).then(store => {
    vectorStore = store;
  });
}

initializeCassandraStore();

async function ensureStoreInitialized(): Promise<void> {
    try {
        await vectorStoreInitialization;
    } catch (error) {
        console.error("Error initializing CassandraStore:", error);
        throw error; 
    }

    if (!vectorStore) {
        throw new Error("Failed to initialize CassandraStore");
    }
}

async function save(amenity: Amenity): Promise<void> {
    await ensureStoreInitialized();

    const docs: Document[] = [];
    for (const review of amenity.reviews) {
        const metadata = {
            amenity_id: amenity.id,
            review_id: review.id,
            amenity_name: amenity.name,
            type: amenity.type,
            coords: new Float32Array([amenity.lat, amenity.lon]),
            locality: amenity.locality_name,
            reviewer_name: review.reviewer,
            rating: review.rating,
        };

        const doc = new Document({
            pageContent: review.review_text,
            metadata: metadata
        });
        // console.log("Saving document:", doc);
        docs.push(doc);
    }
    return vectorStore.addDocuments(docs);
}

export {
    save
};
