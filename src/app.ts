import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response } from 'express';
import generateAndWriteReviews from './api/reviewGenerator';
import { findWithinRadiusUsingText, findWithinRadius } from './api/astraAmenityReviews';
import { Amenity } from './schema/Amenity';
const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.set('view engine', 'ejs');

app.get('/', (req: Request, res: Response) => {
    res.render('index');
});

app.post('/generate-reviews', async (req: Request, res: Response) => {
    try {
        const { amenity, average, stdDev } = req.body;

        if (!amenity || average === undefined || stdDev === undefined) {
            return res.status(400).send('Missing required data');
        }

        await generateAndWriteReviews([amenity], average, stdDev);

        res.send(`Reviews generated for ${amenity.name}.`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating reviews');
    }
});

app.post('/find-within-radius', async (req: Request, res: Response) => {
    try {
        const { text, k, radius, lat, lon } = req.body;

        if (radius === undefined || lat === undefined || lon === undefined) {
            return res.status(400).send('Missing required parameters');
        }
        let amenities: Amenity[] = [];
        if (text) {
            amenities = await findWithinRadiusUsingText(text, k, radius, lat, lon);
        } 
        else {
            amenities = await findWithinRadius(k, radius, lat, lon);
        }
        res.json(amenities);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error processing request');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
