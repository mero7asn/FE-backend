require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const sanitize = require('./middleware/sanitize');
const mongoSanitize = require('express-mongo-sanitize');
const { signResponse, verifyRequest } = require('./middleware/integrity');
const geoBlock = require('./middleware/geoBlock');

const path = require('path');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const dropRoutes = require('./routes/dropRoutes');
const couponRoutes = require('./routes/couponRoutes');
const cmsRoutes = require('./routes/cmsRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingRoutes = require('./routes/settingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// Trust only the first proxy (e.g. Nginx / load balancer)
app.set('trust proxy', 1);

// Health check (before DB connection for quick health check)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'First Edition API is running' });
});

// Lazy DB connection for serverless - connect on first request
let dbConnected = false;
const connectMiddleware = (req, res, next) => {
  if (!dbConnected) {
    connectDB().then(() => {
      dbConnected = true;
    }).catch(err => {
      console.error('DB connection failed:', err.message);
    });
  }
  next();
};
app.use(connectMiddleware);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Strict CORS — only allow the frontend origin
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
      // Allow Vercel-served frontend requests when the frontend URL is not configured.
      return callback(null, true);
    }
    callback(new Error('CORS policy: origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Signature'],
  exposedHeaders: ['X-Response-Signature'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Geo-blocking — Egypt only
app.use(geoBlock);

// Body parsing with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Integrity: verify request BEFORE sanitize mutates the body, sign all responses
app.use(verifyRequest);
app.use(sanitize);
app.use(mongoSanitize());
app.use(signResponse);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/drops', dropRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/payments', paymentRoutes);

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Error Handler
app.use(errorHandler);

// Only start a local server when NOT running on Vercel
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
