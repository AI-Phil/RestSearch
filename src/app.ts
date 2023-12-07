import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response } from 'express';
import generateAndWriteReviews from './api/reviewGenerator';
const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/schema', express.static(path.join(__dirname, 'schema')));
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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
