const express = require('express');
const admin = require('firebase-admin');
const geofire = require('geofire-common');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
const PORT = 3001;

app.get('/api/cafes', async (req, res) => {
  try {
    const { preferences, lat, lon } = req.query;
    if(!lat || !lon) {/* ...*/}
    const center = [ parseFloat(lat), parseFloat(lon) ];
    const radiusInM = 5 * 1000;
    const bounds = geofire.geohashQueryBounds(center, radiusInM);
    const snapshot = await db.collection('cafes').get();

    if (snapshot.empty) {
      return res.json([]);
    }
    const promises = [];
    for (const b of bounds) {
      const q = db.collection('cafes').orderBy('geohash').startAt(b[0]).endAt(b[1]);
      promises.push(q.get());
    }
    const snapshots = await Promise.all(promises);
    let allCafes = [];
     for (const snap of snapshots) {
      for (const doc of snap.docs) {
        const data = doc.data();
        let coordinates = null;
        if (data.coordinates) {
          coordinates = {
            latitude: data.coordinates.latitude || data.coordinates._latitude,
            longitude: data.coordinates.longitude || data.coordinates._longitude
          };
        }
         allCafes.push({
          id: doc.id,
          name: data.name,
          location: data.location,
          features: data.features,
          geohash: data.geohash,
          coordinates: coordinates 
        });
      }
    }
    if (!preferences || preferences === "") {
      return res.json(allCafes);
    }
    
    const requestedPreferences = preferences.split(',').map(pref => pref.trim());

    const filteredCafes = allCafes.filter(cafe => {
      if (!cafe.features || !Array.isArray(cafe.features)) {
        return false;
      }
      return requestedPreferences.every(pref => cafe.features.includes(pref));
    });

    res.json(filteredCafes);

  } catch (error) {
    console.error("Error fetching cafes:", error);
    res.status(500).send('Something went wrong');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});