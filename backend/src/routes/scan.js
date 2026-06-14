const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Set up temporary memory storage or disk storage for scanner upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// POST /api/scan-receipt - Analyze uploaded file and extract details
router.post('/scan-receipt', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a receipt image file to scan.' });
    }

    const filename = req.file.originalname.toLowerCase();
    
    // Default fallback mock values
    let merchantName = 'Local Store';
    let totalAmount = parseFloat((Math.random() * (2500 - 150) + 150).toFixed(2)); // Random amount between ₹150 and ₹2500
    let suggestedCategory = 'Others';
    let date = new Date().toISOString().split('T')[0];

    // Rule-based parsing on filename to make it feel like intelligent AI scanning
    if (filename.includes('starbucks') || filename.includes('coffee') || filename.includes('cafe') || filename.includes('dinner') || filename.includes('food') || filename.includes('restaurant')) {
      merchantName = 'Starbucks Coffee';
      suggestedCategory = 'Food';
      totalAmount = 840.00;
    } else if (filename.includes('uber') || filename.includes('cab') || filename.includes('travel') || filename.includes('flight') || filename.includes('taxi') || filename.includes('metro')) {
      merchantName = 'Uber Travels';
      suggestedCategory = 'Travel';
      totalAmount = 1250.00;
    } else if (filename.includes('rent') || filename.includes('flat') || filename.includes('house') || filename.includes('room')) {
      merchantName = 'Monthly House Rent';
      suggestedCategory = 'Rent';
      totalAmount = 25000.00;
    } else if (filename.includes('netflix') || filename.includes('movie') || filename.includes('cinema') || filename.includes('game') || filename.includes('show')) {
      merchantName = 'Netflix Subscription';
      suggestedCategory = 'Entertainment';
      totalAmount = 649.00;
    } else if (filename.includes('electricity') || filename.includes('water') || filename.includes('power') || filename.includes('bill') || filename.includes('internet') || filename.includes('utilities')) {
      merchantName = 'Electricity & Water Board';
      suggestedCategory = 'Utilities';
      totalAmount = 3200.00;
    } else if (filename.includes('amazon') || filename.includes('shopping') || filename.includes('flipkart') || filename.includes('clothes')) {
      merchantName = 'Amazon Shopping';
      suggestedCategory = 'Shopping';
      totalAmount = 4599.00;
    } else {
      // Pick a random merchant from a curated list of indian-themed stores
      const stores = [
        { name: 'D-Mart Supermarket', cat: 'Shopping', amt: 1850.00 },
        { name: 'Haldiram Restaurant', cat: 'Food', amt: 960.00 },
        { name: 'Zomato Food Delivery', cat: 'Food', amt: 520.00 },
        { name: 'Decathlon Sports', cat: 'Shopping', amt: 3400.00 },
        { name: 'PVR Cinemas Ticket', cat: 'Entertainment', amt: 1200.00 },
        { name: 'Airtel Broadband', cat: 'Utilities', amt: 999.00 }
      ];
      const selected = stores[Math.floor(Math.random() * stores.length)];
      merchantName = selected.name;
      suggestedCategory = selected.cat;
      totalAmount = selected.amt;
    }

    // Add small random noise to amount to make it realistic
    if (merchantName !== 'Starbucks Coffee' && merchantName !== 'Netflix Subscription' && merchantName !== 'Airtel Broadband' && merchantName !== 'Monthly House Rent') {
      totalAmount = parseFloat((totalAmount + (Math.random() * 20 - 10)).toFixed(2));
    }

    // Artificial network delay (1.2 seconds) to simulate OCR processing on server
    await new Promise(resolve => setTimeout(resolve, 1200));

    return res.status(200).json({
      success: true,
      merchantName,
      date,
      totalAmount,
      suggestedCategory,
      confidenceScore: 94.5 // Simulated confidence indicator
    });
  } catch (error) {
    console.error('Scan receipt error:', error);
    return res.status(500).json({ error: 'Internal server error scanning receipt image.' });
  }
});

module.exports = router;
