import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response } from 'express';
import generateAndWriteReviews from './api/reviewGenerator';
import { findWithinRadiusUsingText, findWithinRadius, load } from './api/astraAmenityReviews';
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
        const text = req.body.text;
        const k = parseInt(req.body.k, 10);
        const radius = parseFloat(req.body.radius);
        const lat = parseFloat(req.body.lat);
        const lon = parseFloat(req.body.lon);

        // Check if any of the numeric values are not numbers
        if (isNaN(radius) || isNaN(lat) || isNaN(lon) || isNaN(k)) {
            return res.status(400).send('Invalid numeric parameters');
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

app.get('/load', async (req: Request, res: Response) => {
    try {
        await load();
        res.send('Load successful');
    } catch (error) {
        console.error('Load failed:', error);
        res.status(500).send('Load failed');
    }
});

app.get('/config', (req, res) => {
    res.json({
        MAP_INIT_LATITUDE: process.env.MAP_INIT_LATITUDE,
        MAP_INIT_LONGITUDE: process.env.MAP_INIT_LONGITUDE
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
