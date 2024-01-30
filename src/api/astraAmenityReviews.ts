import { validateEnvVariables, parseVector } from './common';
import { SupportedVectorTypes } from "langchain/vectorstores/cassandra";
import AstraClientManager from './astra';
import { Client } from "cassandra-driver";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Amenity } from '../schema/Amenity';
import { Review } from '../schema/Review';
import { getClosestAmenities } from './common';
import zlib from 'zlib';
import Papa from 'papaparse';
import fs from 'fs';

validateEnvVariables([
    'ASTRA_DB_ENDPOINT',
    'ASTRA_TOKEN',
    'CASSANDRA_KEYSPACE',
    'OPENAI_EMBEDDING_DIMENSIONS',
    'OPENAI_EMBEDDING_MODEL',
]);

const KEYSPACE = process.env.CASSANDRA_KEYSPACE as string;
const TABLE = "amenity_reviews";

const astra = new AstraClientManager(
    new OpenAIEmbeddings({ modelName: process.env.OPENAI_EMBEDDING_MODEL as string }),
    {
        serviceProviderArgs: {
            astra: {
                token: process.env.ASTRA_TOKEN as string,
                endpoint: process.env.ASTRA_DB_ENDPOINT as string,
            },
        },
        keyspace: process.env.CASSANDRA_KEYSPACE as string,
        table: TABLE,
        vectorType: process.env.VECTOR_TYPE as SupportedVectorTypes || "cosine",
        dimensions: parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS as string),
        primaryKey: [
            { name: "amenity_id", type: "text", partition: true },
            { name: "review_id", type: "uuid" },
        ],
        metadataColumns: [
            { name: "amenity_name", type: "text" },
            { name: "type", type: "text" },
            { name: "coords", type: "VECTOR<FLOAT,2>" },
            { name: "locality", type: "text" },
            { name: "reviewer_name", type: "text" },
            { name: "rating", type: "int" },
            { name: "metadata", type: "text" },
        ],
        indices: [
            { name: "coords", value: "(coords)", options: "{'similarity_function': 'euclidean'}" },
        ],
    });


async function findWithinRadiusUsingText(text: string, k: number, radius: number, lat: number, lon: number): Promise<Amenity[]> {
    const vectorStore = await astra.getVectorStore();

    const filter = { name: "GEO_DISTANCE(coords,?)", operator: "<=", value: [new Float32Array([lat, lon]), radius] };
    const results = await vectorStore.similaritySearchWithScore(text, k, filter);

    const documents = results.map(result => result[0]);
    const scores = results.map(result => result[1]);

    const amenitiesMap = processAmenityResults(documents, scores);

    return Array.from(amenitiesMap.values());
}

async function findWithinRadius(k: number, radius: number, lat: number, lon: number): Promise<Amenity[]> {
    const nativeClient = await astra.getNativeClient();

    const selectStmt = `SELECT amenity_id ,review_id ,amenity_name, coords,locality, metadata, rating, reviewer_name, text, type 
                          FROM ${KEYSPACE}.${TABLE}
                         WHERE geo_distance(coords, ?) <= ?`;

    const resultSet = await nativeClient.execute(selectStmt, [new Float32Array([lat, lon]), radius], { prepare: true });

    // Transform rows into Document-like objects and create a corresponding array of null scores
    const documents = resultSet.rows.map(row => ({
        metadata: {
            amenity_id: row.amenity_id,
            review_id: row.review_id,
            amenity_name: row.amenity_name,
            type: row.type,
            coords: [row.coords[0], row.coords[1]],
            locality: row.locality,
            reviewer_name: row.reviewer_name,
            rating: row.rating,
            metadata: row.metadata,
        },
        pageContent: row.text,
    }));
    const scores = new Array(resultSet.rows.length).fill(null); // Array of nulls

    // Process the documents and scores to get a map of amenities
    const amenitiesMap = processAmenityResults(documents, scores);

    return getClosestAmenities(Array.from(amenitiesMap.values()), lat, lon, k);
}

function processAmenityResults(documents: Document[], scores: (number | null)[]): Map<string, Amenity> {
    if (documents.length !== scores.length) {
        throw new Error("The lengths of documents and scores must be the same.");
    }

    const amenitiesMap: Map<string, Amenity> = new Map<string, Amenity>();
    documents.forEach((doc, index) => {
        const score = scores[index];
        const metadata = doc.metadata;
        const review: Review = {
            id: metadata.review_id,
            reviewer: metadata.reviewer_name,
            rating: metadata.rating,
            review_text: doc.pageContent,
            similarity: score !== null ? score : undefined // Include score if not null
        };

        const amenityId = metadata.amenity_id;

        if (amenitiesMap.has(amenityId)) {
            amenitiesMap.get(amenityId)?.reviews.push(review);
        } else {
            const amenity: Amenity = {
                id: amenityId,
                name: metadata.amenity_name,
                type: metadata.type,
                lat: metadata.coords[0],
                lon: metadata.coords[1],
                reviews: [review],
                metadata: JSON.parse(metadata.metadata),
            };
            amenitiesMap.set(amenityId, amenity);
        }
    });
    
    return amenitiesMap;
}

async function save(amenity: Amenity): Promise<void> {
    const vectorStore = await astra.getVectorStore();

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

// File content based on this output, which then needed combining from multiple files
// astra db unload -o csv -url ./amenity_reviews -query 'SELECT amenity_id ,review_id ,amenity_name, coords,locality, metadata, rating, reviewer_name ,\"text\" as c_text,\"type\"  as c_type,\"vector\" as c_vector FROM restsearch.amenity_reviews' -- vectors

let loadCounter = 0;
let loadingComplete = false;

function loadProgress() {
    return loadingComplete ? -1 : loadCounter;
}

async function load() {
    const nativeClient = await astra.getNativeClient();
    loadingComplete = false;
    loadCounter = 0;

    const file = './amenity_reviews.csv.gz';
    const fileStream = fs.createReadStream(file).pipe(zlib.createGunzip());
    const concurrentLimit = 50;
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
                const processPromise = processRow(result.data as RowData, nativeClient).then(() => {
                    loadCounter++;
                    if (loadCounter % 100 === 0) {
                        console.log(`Processed ${loadCounter} records`);
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
                console.log(`Total records processed: ${loadCounter}`);
                loadingComplete = true;
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

async function processRow(row: RowData, nativeClient: Client) {
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

export {
    save, load, loadProgress, findWithinRadiusUsingText, findWithinRadius
};
