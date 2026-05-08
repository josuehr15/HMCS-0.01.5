const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const { getRatings, createRating, deleteRating } = require('../controllers/ratingController');

router.use(auth);
router.use(checkRole('admin'));

router.get('/',     getRatings);
router.post('/',    createRating);
router.delete('/:id', deleteRating);

module.exports = router;
