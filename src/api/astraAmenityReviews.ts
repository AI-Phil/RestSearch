import { validateEnvVariables } from './common';
import { CassandraStore, CassandraLibArgs, SupportedVectorTypes } from "langchain/vectorstores/cassandra";
import { Client as NativeClient } from "cassandra-driver";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Amenity } from '../schema/Amenity';
import { Review } from '../schema/Review';
import { getClosestAmenities } from './common';
import { createReadStream } from 'fs';
import zlib from 'zlib';
import Papa from 'papaparse';
import fs from 'fs';
import { pipeline } from 'stream/promises';

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
  const results = await vectorStore.similaritySearchWithScore(text, k, filter);

  const amenitiesMap = new Map<string, Amenity>();

  for (const result of results) {
      const document: Document = result[0];
      const score: number = result[1];

      const review: Review = {
          id: document.metadata.review_id,
          reviewer: document.metadata.reviewer_name,
          rating: document.metadata.rating,
          review_text: document.pageContent,
          similarity: score
      };

      const amenityId = document.metadata.amenity_id;

      if (amenitiesMap.has(amenityId)) {
          amenitiesMap.get(amenityId)?.reviews.push(review);
      } else {
          const amenity: Amenity = {
              id: amenityId,
              name: document.metadata.amenity_name,
              type: document.metadata.type,
              lat: document.metadata.coords[0],
              lon: document.metadata.coords[1],
              reviews: [review],
              metadata: JSON.parse(document.metadata.metadata),
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

// File content based on this output, which then needed combining from multiple files
// astra db unload -o csv -url ./amenity_reviews -query 'SELECT amenity_id ,review_id ,amenity_name, coords,locality, metadata, rating, reviewer_name ,\"text\" as c_text,\"type\"  as c_type,\"vector\" as c_vector FROM restsearch.amenity_reviews' -- vectors
async function load() {
    await ensureNativeClientInitialized();

    const file = './amenity_reviews.csv.gz';
    const fileStream = fs.createReadStream(file).pipe(zlib.createGunzip());
    const concurrentLimit = 50;
    let counter = 0;
    const processingQueue: Promise<void>[] = [];

    const parsingComplete = new Promise<void>((resolve, reject) => {
        Papa.parse(fileStream, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            quoteChar: '"',
            escapeChar: '\\',
            step: (result, parser) => {
                parser.pause();
                const processPromise = processRow(result.data as RowData).then(() => {
                    counter++;
                    if (counter % 100 === 0) {
                        console.log(`Processed ${counter} records`);
                    }
                });
                processingQueue.push(processPromise);

                if (processingQueue.length >= concurrentLimit) {
                    Promise.all(processingQueue).then(() => {
                        processingQueue.length = 0; // Clear the queue
                        parser.resume();
                    }).catch(error => {
                        console.error(`Error processing batch: ${error}`);
                        parser.abort();
                        reject(error);
                    });
                } else {
                    parser.resume();
                }
            },
            complete: async () => {
                // Wait for any remaining queued operations to finish
                await Promise.all(processingQueue);
                console.log('CSV file successfully processed');
                console.log(`Total records processed: ${counter}`);
                resolve();
            },
            error: (error) => {
                console.error(`Parsing error: ${error}`);
                reject(error);
            }
        });
    });

    try {
        await parsingComplete;
    } catch (error) {
        console.error(`Load failed: ${error}`);
    }
}

interface RowData {
    amenity_id: string;
    review_id: string;
    amenity_name: string;
    coords: string;
    locality: string;
    metadata: string;
    rating: string;
    reviewer_name: string;
    c_text: string;
    c_type: string;
    c_vector: string;
}

async function processRow(row: RowData) {
    try {
        const coordsArray = parseVector(row.coords, 2);
        const vectorArray = parseVector(row.c_vector, 1536);

        const query = `INSERT INTO ${KEYSPACE}.${TABLE} (amenity_id, review_id, amenity_name, coords, locality, metadata, rating, reviewer_name, text, type, vector) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [row.amenity_id, row.review_id, row.amenity_name, coordsArray, row.locality, row.metadata, row.rating, row.reviewer_name, row.c_text, row.c_type, vectorArray];
        
        await nativeClient.execute(query, params, { prepare: true });
    } catch (error) {
        console.error(`Error processing row with id ${row.amenity_id},${row.review_id}: ${error}`);
        throw error;
    }
}

function parseVector(vectorString: string, expectedDims: number): Float32Array {
    const start = vectorString.indexOf('[') + 1;
    const end = vectorString.lastIndexOf(']');
    const vectorSubString = vectorString.substring(start, end);

    if (typeof vectorString === 'undefined' || vectorString === null) {
        console.error('Vector string is undefined or null');
        return new Float32Array();
    }

    try {
        const vectorValues = vectorSubString.split(',').map(val => parseFloat(val.trim()));
        if (vectorValues.length !== expectedDims) {
            throw new Error(`Unexpected number of elements in vector: found ${vectorValues.length}, expected ${expectedDims}`);
        }

        return new Float32Array(vectorValues);
    } catch (error) {
        console.error('===============================================================================');
        console.error('Vector parsing error:', error);
        console.error('vectorString:', vectorString);
        console.error('vectorSubString:', vectorSubString);
        console.error('===============================================================================');
        throw error;
    }
}

export {
    save, load, findWithinRadiusUsingText, findWithinRadius
};


