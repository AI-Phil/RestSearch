
import { Amenity } from '../schema/Amenity';
import { Review } from '../schema/Review';
import { validateEnvVariables, normalDistribution } from './common';
import { save as astraSave } from './astraAmenityReviews';
import fs from "fs";
import { v4 as uuidv4 } from 'uuid';

import { ChatOpenAI } from "langchain/chat_models/openai";
import { SystemMessage, HumanMessage, BaseMessage } from "langchain/schema";

interface ParsedReviews {
    reviews: Review[];
}

validateEnvVariables([
    'OPENAI_API_KEY',
    'OPENAI_CHAT_MODEL',
]);

const writeToFile = process.env.WRITE_REVIEWS_TO_FILE === 'true';

const chat = new ChatOpenAI({ 
    openAIApiKey: process.env.OPENAI_API_KEY, 
    modelName: process.env.OPENAI_CHAT_MODEL as string,
    temperature: 0.7,
    maxTokens: 2000,
});

async function generateAndWriteReviews(selectedAmenities: Amenity[], average: number, stdDev: number) {
    if (writeToFile && !fs.existsSync("reviews")) {
        fs.mkdirSync("reviews", { recursive: true });
    }

    for (const amenity of selectedAmenities) {
        const numReviews = Math.max(1, Math.round(normalDistribution(average, stdDev)));
        const response: BaseMessage = await chat.call([
            // This prompt does reasonably well at generating valid JSON, I had only 3 out of 673 fail with gpt-3.5-turbo-1106
            new SystemMessage(
               `- You are an amenity review generator that receives an API call with a JSON parameter and returns a JSON document response.
                - The input JSON will contain details of an amenity, including its name, type, location, and metadata.
                - Your task is to generate reviews for the amenity based on its type and metadata.
                - The response JSON should have the following structure:
                  - The top level of the JSON should include the amenity's original details and a new field "reviews" as a list.
                  - The "reviews" list should contain individual review objects.
                  - Each review object should have fields: "reviewer", "rating", and "review_text".
                  - Ensure that commas are correctly placed, and there are no trailing commas in the list.
                  - The "locality_name" field, if present, should be at the top level of the JSON, outside the "metadata" field.
                - You should determine a "persona" for the amenity, and reviews should be generated based on that persona. Guidelines for this are:
                  - Consistency of service or lack of consistency
                  - Quality of product/service (e.g., food quality, service quality, etc.)
                  - Ambiance (e.g., noise level, lighting, etc.)
                  - Price
                  - Location
                  - Suitability for different occasions (e.g., family, business, etc.)
                - Guidelines for review generation:
                  - Ratings should be consistent with the amenity's persona; e.g., an amenity with poor service should have lower ratings than an amenity with good service.
                  - Each review should contain 15 to 50 words.
                  - Reviewer names should be fabricated, consisting of a first name and last initial (e.g., "Eliot K.").
                  - Ratings should range from 1 to 5.
                - Do not include formatting instructions in your response, only the structured JSON document.
                - Ensure the JSON is valid and correctly structured, with proper opening and closing of arrays and objects.
                
                Example output JSON structure (for reference):
                {
                  "id": "12345",
                  "name": "Sample Amenity",
                  "lat": 12.3456,
                  "lon": -65.4321,
                  "type": "restaurant",
                  "metadata": {
                    // Amenity-specific metadata
                  },
                  "reviews": [
                    {
                      "reviewer": "Jane S.",
                      "rating": 4,
                      "review_text": "Excellent place..."
                    },
                    // Additional reviews, and then the last review has no trailing comma:
                    {
                        "reviewer": "John Q.",
                        "rating": 3,
                        "review_text": "Food was good, but service was slow..."
                    }  
                  ],
                  "locality_name": "Sample City"
                }`
            ),            
            new HumanMessage(
                `Given amentiy ${JSON.stringify(amenity)},\n\n please generate ${numReviews} reviews.`
            ),
          ]);
                
        if (response) {
            let rawReview: string = "";

            if (typeof response.content === 'string') {
              rawReview = response.content;
            } else if (Array.isArray(response.content)) {
              const firstItem = response.content[0];
              if (firstItem && firstItem.type === 'text') {
                rawReview = firstItem.text;
              }
            }

            if (rawReview) {
                try {
                    const parsedReviews: ParsedReviews = JSON.parse(rawReview);
                    if (parsedReviews.reviews && Array.isArray(parsedReviews.reviews)) {
                        parsedReviews.reviews.forEach(review => {
                            review.id = uuidv4(); 
                        });
                    }
    
                    await astraSave({ ...amenity, reviews: parsedReviews.reviews });
                    if (writeToFile) {
                        const filename = `reviews/${amenity.id}.json`;
                        fs.writeFileSync(filename, JSON.stringify(parsedReviews, null, 2));
                    }
                } catch (error) {
                    console.error('Error parsing review content: ', error);
                    console.error('Failed content: ',rawReview);
                }    
            }
            else {
                console.error('Unexpected response format:', response);
            }
        } else {
            console.error('No response from chat!');
        }
    }
}

export default generateAndWriteReviews;
