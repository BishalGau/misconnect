const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');

// Configure dotenv to look for .env in backend folder
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Update CORS configuration at the top of the file
const corsOptions = {
  origin: ['http://localhost:3000', 'https://p4pmis.onrender.com'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Make sure this is before any routes
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

// Add headers middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

app.use(express.json());

// Verify MONGODB_URI is available

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
  });
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
});

// User authentication route using UsersMIS collection
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await mongoose.connection.db.collection('UsersMIS')
      .findOne({ username, password });
    
    if (user) {
      res.json({ 
        success: true, 
        user: {
          username: user.username,
          role: user.role || 'user',
          name: user.name || user.username
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
    console.error('Error fetching data:', error);
  }
});

// Generic route to fetch data from any collection
app.get('/api/collections/:collectionName', async (req, res) => {
  try {
    const collectionName = req.params.collectionName;
    const data = await mongoose.connection.db.collection(collectionName).find({}).toArray();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching data' });
    console.error('Error fetching data:', error);
  }
});

// Route to get list of all collections
app.get('/api/collections', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    res.json({ success: true, collections: collections.map(c => c.name) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching collections' });
    console.error('Error fetching collections:', error);
  }
});

// Route to get participant profiles
app.get('/api/participants', async (req, res) => {
  try {
    const data = await mongoose.connection.db.collection('ParticipantPROFILE').find({}).toArray();
    
    // Debug logging
    if (data.length > 0) {
    }

    // Ensure all string fields are actually strings
    const cleanedData = data.map(p => ({
      ...p,
      ID: String(p.ID || ''),
      ParticipantNAME: String(p.ParticipantNAME || ''),
      ParticipantGENDER: String(p.ParticipantGENDER || ''),
      WorkingSectorP4P: String(p.WorkingSectorP4P || ''),
      pAddressDISTRICT: String(p.pAddressDISTRICT || ''),
      EthnicCultureBACKGROUND: String(p.EthnicCultureBACKGROUND || '')
    }));

    res.json({ success: true, data: cleanedData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching data' });
    console.error('Error fetching data:', error);
  }
});

// Route to get leverages data
app.get('/api/leverages', async (req, res) => {
  try {
    const data = await mongoose.connection.db.collection('Leverages').find({}).toArray();
    
    // Group and count by LeverageSTATUS
    const leverageStats = data.reduce((acc, item) => {
      const entity = item.Entity || 'Unknown';
      acc.byEntity[entity] = (acc.byEntity[entity] || 0) + (Number(item.Amount) || 0);
      acc.totalAmount += Number(item.Amount) || 0;
      return acc;
    }, {
      byEntity: {},
      totalAmount: 0
    });

    res.json({
      success: true,
      data: leverageStats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching data' });
    console.error('Error fetching data:', error);
  }
});

// Route to get market survey summary
app.get('/api/market-surveys', async (req, res) => {
  try {
    const [aqua, cattle, fh, maize, poultry, qsr] = await Promise.all([
      mongoose.connection.db.collection('MarketSurveyAQUA').countDocuments(),
      mongoose.connection.db.collection('MarketSurveyCATTLE').countDocuments(),
      mongoose.connection.db.collection('MarketSurveyFH').countDocuments(),
      mongoose.connection.db.collection('MarketSurveyMAIZE').countDocuments(),
      mongoose.connection.db.collection('MarketSurveyPOULTRY').countDocuments(),
      mongoose.connection.db.collection('MarketSurveyQSR').countDocuments()
    ]);
    
    res.json({
      success: true,
      data: { aqua, cattle, fh, maize, poultry, qsr }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching data' });
    console.error('Error fetching data:', error);
  }
});

// Route to get dealer profiles
app.get('/api/dealers', async (req, res) => {
  try {
    const data = await mongoose.connection.db.collection('DealerPROFILE').find({}).toArray();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching dealers:', error);
    res.status(500).json({ success: false, message: 'Error fetching dealers' });
  }
});

// Route to get cooperative profiles
app.get('/api/cooperatives', async (req, res) => {
  try {
    const data = await mongoose.connection.db.collection('CoOpPROFILE').find({}).toArray();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching data' });
    console.error('Error fetching data:', error);
  }
});

// Add this new route for productivity data
app.get('/api/productivity', async (req, res) => {
  try {
    const data = await mongoose.connection.db.collection('Productivity').find({}).toArray();
    
    // Process the data for the chart
    const productivityData = data.reduce((acc, item) => {
      acc.sectors.push(item.Sector);
      acc.baseline.push(item.BaseLine);
      acc.earlyassessment.push(item['Early Productivity Assessment']);
      acc.growth.push(item['% Growth']);
      return acc;
    }, {
      sectors: [],
      baseline: [],
      earlyassessment: [],
      growth: []
    });

    res.json({
      success: true,
      data: productivityData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching data' });
    console.error('Error fetching data:', error);
  }
});

// Add this route to inspect the data structure
app.get('/api/data-structure', async (req, res) => {
  try {
    const participant = await mongoose.connection.db.collection('ParticipantPROFILE').findOne();
    const dealer = await mongoose.connection.db.collection('DealerPROFILE').findOne();
    const coop = await mongoose.connection.db.collection('CoOpPROFILE').findOne();
    
    res.json({
      participant: Object.keys(participant || {}),
      dealer: Object.keys(dealer || {}),
      coop: Object.keys(coop || {})
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching data structure' });
    console.error('Error fetching data structure:', error);
  }
});

// Add this route with other routes
app.get('/api/a2f', async (req, res) => {
  try {
    const data = await mongoose.connection.db.collection('A2F').find({}).toArray();
    
    // Ensure numeric fields are properly converted
    const cleanedData = data.map(item => ({
      ...item,
      ParticipantID: Number(item.ParticipantID) || 0,
      ParticipantAGE: Number(item.ParticipantAGE) || 0,
      LoanAmountAPPLIED: Number(item.LoanAmountAPPLIED) || 0,
      LoanAmountAPPROVED: Number(item.LoanAmountAPPROVED) || 0,
      LoanPERIOD: Number(item.LoanPERIOD) || 0,
      InterestRATE: Number(item.InterestRATE) || 0,
      InsurancePERIOD: Number(item.InsurancePERIOD) || 0,
      InsuranceCOVERAGE: Number(item.InsuranceCOVERAGE) || 0
    }));

    res.json({ success: true, data: cleanedData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching data' });
    console.error('Error fetching data:', error);
  }
});

// Add this route with other routes
app.get('/api/a2m', async (req, res) => {
  try {
    const data = await mongoose.connection.db.collection('A2M').find({}).toArray();
    
    // Ensure numeric fields are properly converted
    const cleanedData = data.map(item => ({
      ...item,
      ParticipantID: Number(item.ParticipantID) || 0,
      ParticipantAGE: Number(item.ParticipantAGE) || 0,
      MarginalizedSTATUS: Number(item.MarginalizedSTATUS) || 0,
      EntityPHONE: Number(item.EntityPHONE) || 0,
      QtySOLD: Number(item.QtySOLD) || 0,
      AmountSOLD: Number(item.AmountSOLD) || 0
    }));

    res.json({ success: true, data: cleanedData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching data' });
    console.error('Error fetching data:', error);
  }
});

// Update the collections list
const VALID_COLLECTIONS = [
  'ParticipantPROFILE',
  'DealerPROFILE', 
  'CooperativePROFILE',
  'AgrovetPROFILE',
  'A2F',
  'A2M'
];

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 