const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

const allowedOrigins = [
  'https://c-ic-d-frontend.vercel.app/',
  'https://c-ic-d-frontend-git-main-pasindus-projects-4ef6e1a8.vercel.app/',
  'http://localhost:3000'
];
// Enable CORS with proper configuration for production
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));
// =============================================
// CONFIGURATION
// =============================================
const config = {
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://pasindupriyalanka:T9cZNXvjmZ4Q8m2d@cluster0.esvsjg4.mongodb.net/image_upload?retryWrites=true&w=majority&appName=Cluster0',
  PORT: process.env.PORT || 3001,
  UPLOAD_DIR: path.join(__dirname, 'uploads'),
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`
};

// =============================================
// MONGODB CONNECTION
// =============================================
mongoose.connect(config.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  ssl: true,                   // Enforce TLS/SSL
  authSource: 'admin',         // Specify authentication database
  retryWrites: true,           // Enable retryable writes
  retryReads: true,            // Enable retryable reads
      
})
.then(() => console.log('✅ MongoDB connected successfully to Image_upload database'))
.catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1);
});

// =============================================
// DATABASE SCHEMA
// =============================================
const imageSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalname: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  mimetype: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Image = mongoose.model('Image', imageSchema, 'images');

// =============================================
// FILE UPLOAD CONFIG
// =============================================
if (!fs.existsSync(config.UPLOAD_DIR)) {
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
  console.log(`📁 Created upload directory: ${config.UPLOAD_DIR}`);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `img-${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, GIF, or WEBP images are allowed'));
    }
  }
});

// =============================================
// MIDDLEWARE
// =============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================
// API ENDPOINTS
// =============================================
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const newImage = new Image({
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    const savedImage = await newImage.save();
    
    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      image: {
        id: savedImage._id,
        name: savedImage.originalname,
        url: `${config.BASE_URL}/uploads/${savedImage.filename}`,
        size: savedImage.size,
        uploadedAt: savedImage.createdAt
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.get('/api/images', async (req, res) => {
  try {
    const images = await Image.find().sort({ createdAt: -1 });
    res.json({ 
      success: true,
      count: images.length,
      images: images.map(img => ({
        id: img._id,
        name: img.originalname,
        url: `${config.BASE_URL}/uploads/${img.filename}`,
        size: img.size,
        uploadedAt: img.createdAt
      }))
    });
  } catch (err) {
    console.error('Error fetching images:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch images' 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// =============================================
// STATIC FILES AND SERVER START
// =============================================
app.use('/uploads', express.static(config.UPLOAD_DIR));

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ 
      success: false,
      error: err.message 
    });
  }
  console.error(err);
  res.status(500).json({ 
    success: false,
    error: 'Something went wrong' 
  });
});

app.listen(config.PORT, () => {
  console.log(`🚀 Server running on port ${config.PORT}`);
  console.log(`📂 Uploads directory: ${config.UPLOAD_DIR}`);
  console.log(`🌍 Base URL: ${config.BASE_URL}`);
});