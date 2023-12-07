const AmenitySchema = {
    id: 'string',
    type: 'string',
    name: 'string',
    lat: 'number',
    lon: 'number',
    metadata: 'object',
    reviews: 'object'
};

if (typeof module !== 'undefined') {
    module.exports = AmenitySchema;
} else {
    window.AmenitySchema = AmenitySchema;
}