import { validateEnvVariables } from './common';
import { CassandraStore, CassandraLibArgs, SupportedVectorTypes } from "langchain/vectorstores/cassandra";
import { Client as NativeClient } from "cassandra-driver";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Amenity } from '../schema/Amenity';
import { Review } from '../schema/Review';
import { getClosestAmenities } from './common';

validateEnvVariables([
    'CASSANDRA_SCB',
    'CASSANDRA_TOKEN',
    'CASSANDRA_KEYSPACE',
    'OPENAI_EMBEDDING_DIMENSIONS',
    'OPENAI_EMBEDDING_MODEL',
]);

let vectorStore: CassandraStore;
let vectorStoreInitialization: Promise<void>;
let nativeClient: NativeClient;
let nativeClientInitialization: Promise<void>;

const KEYSPACE = process.env.CASSANDRA_KEYSPACE as string;
const TABLE = "amenity_reviews";

async function initializeCassandraStore() {
  const config: CassandraLibArgs = {
    cloud: {
      secureConnectBundle: process.env.CASSANDRA_SCB as string,
    },
    credentials: {
      username: "token",
      password: process.env.CASSANDRA_TOKEN as string,
    },
    keyspace: KEYSPACE,
    dimensions: parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS as string),
    table: TABLE,
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
      {name: "metadata", type: "text"},
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

  nativeClient = new NativeClient(config);
  nativeClientInitialization = nativeClient.connect();
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

async function ensureNativeClientInitialized(): Promise<void> {
    ensureStoreInitialized();  

    try {
        await nativeClientInitialization;
    } catch (error) {
        console.error("Error initializing NativeClient:", error);
        throw error; 
    }

    if (!nativeClient) {
        throw new Error("Failed to initialize NativeClient");
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
            metadata: JSON.stringify(amenity.metadata),
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

async function findWithinRadiusUsingText(text: string, k: number, radius: number, lat: number, lon: number): Promise<Amenity[]> {
  await ensureStoreInitialized();

  const filter = { name: "GEO_DISTANCE(coords,?)", operator: "<=", value: [new Float32Array([lat, lon]), radius] };
  const results = await vectorStore.similaritySearch(text, k, filter);

  const amenitiesMap = new Map<string, Amenity>();

  for (const result of results) {
      const review: Review = {
          id: result.metadata.review_id,
          reviewer: result.metadata.reviewer_name,
          rating: result.metadata.rating,
          review_text: result.pageContent
      };

      const amenityId = result.metadata.amenity_id;

      if (amenitiesMap.has(amenityId)) {
          amenitiesMap.get(amenityId)?.reviews.push(review);
      } else {
          const amenity: Amenity = {
              id: amenityId,
              name: result.metadata.amenity_name,
              type: result.metadata.type,
              lat: result.metadata.coords[0],
              lon: result.metadata.coords[1],
              reviews: [review],
              metadata: JSON.parse(result.metadata.metadata),
          };
          amenitiesMap.set(amenityId, amenity);
      }
  }

  return Array.from(amenitiesMap.values());
}

async function findWithinRadius(k: number, radius: number, lat: number, lon: number): Promise<Amenity[]> {
  await ensureNativeClientInitialized();

  const selectStmt = `SELECT amenity_id ,review_id ,amenity_name, coords,locality, metadata, rating, reviewer_name, text, type 
                        FROM ${KEYSPACE}.${TABLE}
                       WHERE geo_distance(coords, ?) <= ?`;

  const resultSet = await nativeClient.execute(selectStmt, [new Float32Array([lat, lon]), radius], {prepare: true});
  const amenitiesMap = new Map<string, Amenity>();

  for (const row of resultSet.rows) {
      const review: Review = {
          id: row.review_id,
          reviewer: row.reviewer_name,
          rating: row.rating,
          review_text: row.text
      };

      const amenityId = row.amenity_id;

      if (amenitiesMap.has(amenityId)) {
          amenitiesMap.get(amenityId)?.reviews.push(review);
      } else {
          const amenity: Amenity = {
              id: amenityId,
              name: row.amenity_name,
              type: row.type,
              lat: row.coords[0],
              lon: row.coords[1],
              reviews: [review],
              metadata: JSON.parse(row.metadata),
          };
          amenitiesMap.set(amenityId, amenity);
      }
  }

  const amenities = Array.from(amenitiesMap.values());
  return getClosestAmenities(amenities, lat, lon, k);
}

export {
    save, findWithinRadiusUsingText, findWithinRadius
};

// astra db unload -o csv -url ./amenity_reviews -query 'SELECT amenity_id ,review_id ,amenity_name, coords,locality, metadata, rating, reviewer_name ,\"text\" as c_text,\"type\"  as c_type,\"vector\" as c_vector FROM restsearch.amenity_reviews' -- vectors

