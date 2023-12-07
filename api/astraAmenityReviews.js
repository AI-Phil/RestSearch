const { validateEnvVariables } = require('./common.js');
const { CassandraStore } = require("langchain/vectorstores/cassandra");
const { Document } = require("langchain/document");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");

validateEnvVariables([
    'CASSANDRA_SCB',
    'CASSANDRA_TOKEN',
    'CASSANDRA_KEYSPACE',
    'OPENAI_EMBEDDING_DIMENSIONS',
    'OPENAI_EMBEDDING_MODEL',
  ]);
  
let vectorStore;
let vectorStoreInitialization;

async function initializeCassandraStore() {
  const config = {
    cloud: {
      secureConnectBundle: process.env.CASSANDRA_SCB,
    },
    credentials: {
      username: "token",
      password: process.env.CASSANDRA_TOKEN,
    },
    keyspace: process.env.CASSANDRA_KEYSPACE,
    dimensions: process.env.OPENAI_EMBEDDING_DIMENSIONS,
    table: "amenity_reviews",
    vector_type: process.env.VECTOR_TYPE || "cosine",
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
    new OpenAIEmbeddings({ model: process.env.OPENAI_EMBEDDING_MODEL }),
    config
  ).then(store => {
    vectorStore = store;
  });
}

initializeCassandraStore();

async function ensureStoreInitialized() {
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

async function save(amenity) {
  await ensureStoreInitialized();

  const docs = [];
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

module.exports = {
  save
};
