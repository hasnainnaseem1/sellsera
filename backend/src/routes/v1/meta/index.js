const express = require('express');
const router = express.Router();
const { ETSY_COUNTRIES } = require('../../../utils/constants/etsyCountries');

// @route   GET /api/v1/meta/countries
// @desc    List supported Etsy countries for keyword search
// @access  Public (no auth required — used to populate dropdowns)
router.get('/countries', (req, res) => {
  const countries = ETSY_COUNTRIES.map(c => ({
    value: c.code,
    label: `${c.flag} ${c.name}`,
    name: c.name,
  }));

  res.json({ success: true, data: countries });
});

module.exports = router;
