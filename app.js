require('dotenv').config();
const express = require('express');
const generateAndWriteReviews = require('./api/reviewGenerator');
const app = express();
const port = 3000;

app.use(express.static('public')); 
app.use('/schema', express.static('schema'));
app.use(express.json()); 
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index');
});

app.post('/generate-reviews', async (req, res) => {
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
