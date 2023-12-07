
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
            new SystemMessage(
                `You are an amenity review generator that is called as an API with a JSON parameter, and returns a JSON document response with a new field "reviews" added as a list.\n
                 You should infer the type of amenity from the JSON document, and generate appropriate reviews for that amenity type.\n
                 If there is insufficient context about the amenity (for example, if the JSON document does not contain the "cuisine" field for a restaurant), you should infer information from the amenity name and location.\n
                 Before generating the reviews for each amenity, you should fabricate an idea about the amenity - quality of the service, ambiance, etc, and all reviews consistent with that idea. For example, a fine dining establishment is unlikely to cater to children, whilst a causal dining establishment is unlikely to have elaborate menus.\n
                 10% of amenities should have an average rating of around 2, 20% should have an average rating of around 3, 40% should have an average rating of around 4, and 30% should have an average rating of around 5.\n
                 The output structure should match the input structure, with the addition of the "reviews" field which should be a list of documents like \"reviews\":[{\"reviewer\":\"...\", \"rating\":..., \"review_text\":\"...\"}, ...]\n
                 Each review should have between 15 and 50 words.\n
                 The reviewer name should be a random first name and list initial, and the review rating should be between 1 and 5.\n
                 Your response should not include any context or text formatting instructions, only the JSON document. Do not include \`\`\`json or any other formatting.\n`
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
