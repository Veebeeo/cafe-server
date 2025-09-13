require('dotenv').config();
const axios = require('axios');
const admin = require('firebase-admin');
const geofire = require('geofire-common');


const serviceAccount = require('./serviceAccountKey.json'); 
const PLACES_API_KEY = process.env.PLACES_API_KEY; 
const SEARCH_LOCATION = { lat: 12.9716, lon: 77.5946 }; // Your location
const SEARCH_RADIUS = 5000;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function fetchAndSeedCafes() {
  console.log("Starting to fetch cafes from Google Places API...");
  try {
    const url = `https://places.googleapis.com/v1/places:searchNearby`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.editorialSummary'
    };
    const body = {
      "includedTypes": ["cafe", "coffee_shop"],
      "maxResultCount": 20, 
      "locationRestriction": {
        "circle": {
          "center": { "latitude": SEARCH_LOCATION.lat, "longitude": SEARCH_LOCATION.lon },
          "radius": SEARCH_RADIUS
        }
      }
    };

    const response = await axios.post(url, body, { headers });
    const { places } = response.data;

    if (!places || places.length === 0) {
      console.log("No cafes found in the specified area.");
      return;
    }

    console.log(`Found ${places.length} cafes. Preparing to upload to Firestore...`);

    const batch = db.batch();

    places.forEach(place => {
      const docRef = db.collection('cafes').doc(); 
      const coordinates = {
        latitude: place.location.latitude,
        longitude: place.location.longitude
      };
      const hash = geofire.geohashForLocation([coordinates.latitude, coordinates.longitude]);

   
      const newCafe = {
        name: place.displayName.text,
        location: place.formattedAddress,
        features: ['wifi'],
        coordinates: new admin.firestore.GeoPoint(coordinates.latitude, coordinates.longitude),
        geohash: hash,
        rating: place.rating || null, 
        description: place.editorialSummary?.text || "No description available." 
      };

      batch.set(docRef, newCafe);
    });

    await batch.commit();
    console.log(`Successfully uploaded ${places.length} cafes to Firestore!`);

  } catch (error) {
    if (error.response) {
      console.error("Error fetching data from Google Places API:", error.response.data);
    } else {
      console.error("An unexpected error occurred:", error.message);
    }
  }
}

fetchAndSeedCafes();