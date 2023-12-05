require("dotenv").config();

const { OpenAI } = require("openai");
const fs = require("fs");
const { promisify } = require("util");

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function normalDistribution(mean, stdDev) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
}

async function generateAndWriteReviews(selectedRestaurants, average, stdDev) {
    // Ensure the 'reviews' directory exists
    await mkdirAsync("reviews", { recursive: true });

    const reviewData = [];

    for (const restaurant of selectedRestaurants) {
        const numReviews = Math.max(1, Math.round(normalDistribution(average, stdDev)));
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_CHAT_MODEL,
            messages: [
                {
                    "role": "system",
                    "content": "You are a restaurant review generator that is called as an API, and returns a JSON document response.  If a cuisine is labelled \"Unknown\" you should infer a cuisine from the name of the restaurant. \n\nThe structure of the document should be {\"restaurant_name\":\"...\", \"cuisines\":[], \"reviews\":[{\"reviewer\":\"...\", \"rating\":..., \"review_text\":\"...\"}, ...]}\n\nEach review should have between 15 and 50 words.\n\nYour response should not include any context or text formatting instructions, only the JSON document."
                },
                {
                    "role": "user",
                    "content": `Given a restaurant named "${restaurant.name}" in the location "${restaurant.location}", serving cuisine "${restaurant.cuisine}", please generate ${numReviews} reviews.`
                }
            ],
            temperature: 0.6,
            max_tokens: 2000
        });

        // Extract and parse the review text from the response
        const reviewContent = response.choices && response.choices.length > 0 ? response.choices[0].message.content : null;

        // console.log(restaurant);

        if (reviewContent) {
            try {
                const parsedReviews = JSON.parse(reviewContent);
                const filename = `reviews/${restaurant.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
                await writeFileAsync(filename, JSON.stringify(parsedReviews, null, 2));
            } catch (parseError) {
                console.error('Error parsing review content:', parseError);
            }
        } else {
            console.error('Review text not found in response:', response);
        }
    }

    // Write to a JSON file
    await writeFileAsync("reviews.json", JSON.stringify(reviewData, null, 2));
}

module.exports = generateAndWriteReviews;
