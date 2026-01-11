import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import lotteryRoutes from './routes/lotteryRoutes.js';
import packageRoutes from './routes/packageRoutes.js';

// Load environment variables
dotenv.config();

// Critical Process Error Listeners (Keep server responding)
process.on('uncaughtException', (err) => {
  console.error('🔥 CRITICAL: Uncaught Exception:', err.message);
  console.error(err.stack);
  // In a production app, you might want to restart via PM2
  // but we keep it alive for now to ensure response.
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});


const app = express();
const PORT = process.env.PORT || 5007;

// Connect to MongoDB
connectDB();

// Parse frontend URLs from environment variable
const allowedOrigins = process.env.FRONTEND_URLS
  ? process.env.FRONTEND_URLS.split(',').map((url) => url.trim())
  : ['https://retailchampions.com', 'http://localhost:5173', 'http://localhost:3000'];

// CORS configuration for multiple frontends with credentials
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked for origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/lottery', lotteryRoutes);
app.use('/api/packages', packageRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global Error:', err);

  // Default response for any error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Specific handling for known errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: err.code === 'LIMIT_FILE_SIZE' ? 'File size exceeds 5MB limit' : err.message,
    });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS: Origin not allowed',
    });
  }

  // Database Connection or Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Data validation failed',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ID format: ${err.value}`
    });
  }

  // Ensure server keeps responding with JSON for any exception
  res.status(statusCode).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
