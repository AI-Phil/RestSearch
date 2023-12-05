const express = require('express');
const generateAndWriteReviews = require('./reviewGenerator');
const app = express();
const port = 3000;

app.use(express.static('public')); 
app.use(express.json()); 
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index');
});

app.post('/generate-reviews', async (req, res) => {
    try {
        const { restaurant, average, stdDev } = req.body;

        if (!restaurant || average === undefined || stdDev === undefined) {
            return res.status(400).send('Missing required data');
        }

        await generateAndWriteReviews([restaurant], average, stdDev);

        res.send(`Reviews generated for ${restaurant.name}.`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating reviews');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
