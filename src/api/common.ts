import { Amenity } from '../schema/Amenity';

// Function to validate required environment variables
function validateEnvVariables(requiredVars: string[]): void {
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

function normalDistribution(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num * stdDev + mean;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1); 
  var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
  ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180)
}

function getClosestAmenities(amenities: Amenity[], lat: number, lon: number, closest_n: number): Amenity[] {
  return amenities
      .sort((a, b) => getDistanceFromLatLonInKm(a.lat, a.lon, lat, lon) - 
                      getDistanceFromLatLonInKm(b.lat, b.lon, lat, lon))
      .slice(0, closest_n);
}

function parseVector(vectorString: string, expectedDims: number): Float32Array {
  const start = vectorString.indexOf('[') + 1;
  const end = vectorString.lastIndexOf(']');
  const vectorSubString = vectorString.substring(start, end);

  if (typeof vectorString === 'undefined' || vectorString === null) {
      console.error('Vector string is undefined or null');
      return new Float32Array();
  }

  try {
      const vectorValues = vectorSubString.split(',').map(val => parseFloat(val.trim()));
      if (vectorValues.length !== expectedDims) {
          throw new Error(`Unexpected number of elements in vector: found ${vectorValues.length}, expected ${expectedDims}`);
      }

      return new Float32Array(vectorValues);
  } catch (error) {
      console.error('===============================================================================');
      console.error('Vector parsing error:', error);
      console.error('vectorString:', vectorString);
      console.error('vectorSubString:', vectorSubString);
      console.error('===============================================================================');
      throw error;
  }
}

export { 
  validateEnvVariables,
  normalDistribution,
  getClosestAmenities,
  parseVector
};
