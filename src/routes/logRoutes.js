import express from 'express';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.post('/log', (req, res) => {
  const { level, message, details } = req.body;
  
  const logMessage = `[FRONTEND] ${message} ${details ? JSON.stringify(details) : ''}`;
  
  if (level === 'error') {
    logger.error(logMessage);
  } else if (level === 'warn') {
    logger.warn(logMessage);
  } else {
    logger.info(logMessage);
  }

  res.status(200).json({ success: true });
});

export default router;
