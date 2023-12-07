
import { Amenity } from '../schema/Amenity';
import { Review } from '../schema/Review';
import { validateEnvVariables, normalDistribution } from './common';
import { save as astraSave } from './astraAmenityReviews';
import { OpenAI } from "openai";
import fs from "fs";
import { promisify } from "util";
import { v4 as uuidv4 } from 'uuid';

validateEnvVariables([
    'OPENAI_API_KEY',
    'OPENAI_CHAT_MODEL',
]);

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ParsedReviews {
    reviews: Review[];
}

async function generateAndWriteReviews(selectedAmenities: Amenity[], average: number, stdDev: number) {
    await mkdirAsync("reviews", { recursive: true });

    for (const amenity of selectedAmenities) {
        const numReviews = Math.max(1, Math.round(normalDistribution(average, stdDev)));
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_CHAT_MODEL as string,
            messages: [
                {
                    "role": "system",
                    "content": `You are an amenity review generator that is called as an API with a JSON, and returns a JSON document response with a new field "reviews" added as a list.\n
                                You should infer the type of amenity from the JSON document, and generate appropriate reviews for that amenity type.\n
                                If there is insufficient context about the amenity (for example, if the JSON document does not contain the "cuisine" field for a restaurant), you should infer information from the amenity name and location.\n
                                Before generating these reviews, you should fabricate an idea about the amenity - quality of the service, ambiance, etc, and all reviews consistent with that idea. For example, a fine dining establishment is unlikely to cater to children, whilst a causal dining establishment is unlikely to have elaborate menus.\n
                                10% of amenities should have an average rating of around 2, 20% should have an average rating of around 3, 40% should have an average rating of around 4, and 30% should have an average rating of around 5.\n
                                The output structure should match the input structure, with the addition of the "reviews" field which should be a list of documents like \"reviews\":[{\"reviewer\":\"...\", \"rating\":..., \"review_text\":\"...\"}, ...]\n
                                Each review should have between 15 and 50 words.\n
                                The reviewer name should be a random first name and list initial, and the review rating should be between 1 and 5.\n
                                Your response should not include any context or text formatting instructions, only the JSON document.`
                },
                {
                    "role": "user",
                    "content": `Given amentiy ${JSON.stringify(amenity)},\n\n please generate ${numReviews} reviews.`
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        // Extract and parse the review text from the response
        const reviewContent = response.choices && response.choices.length > 0 ? response.choices[0].message.content : null;

        if (reviewContent) {
            try {
                const parsedReviews: ParsedReviews = JSON.parse(reviewContent);

                if (parsedReviews.reviews && Array.isArray(parsedReviews.reviews)) {
                    parsedReviews.reviews.forEach(review => {
                        review.id = uuidv4(); 
                    });
                }

                const filename = `reviews/${amenity.id}.json`;
                await writeFileAsync(filename, JSON.stringify(parsedReviews, null, 2));
                await astraSave({ ...amenity, reviews: parsedReviews.reviews });
            } catch (parseError) {
                console.error('Error parsing review content:', parseError);
            }
        } else {
            console.error('Review text not found in response:', response);
        }
    }
}

export default generateAndWriteReviews;
