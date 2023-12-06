const AmenitySchema = {
    id: 'string',
    type: 'string',
    name: 'string',
    lat: 'number',
    lon: 'number',
    metadata: 'object'
};

if (typeof module !== 'undefined') {
    module.exports = AmenitySchema;
} else {
    window.AmenitySchema = AmenitySchema;
}