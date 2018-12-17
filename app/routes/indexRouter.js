const express = require('express');
const router = express.Router();
const wrap = require('express-async-wrap');
const path = require('path');

const IndexCtrl = require('../controllers/IndexCtrl');

router.route('/')
	.get((req, res, next) => {
		res.sendFile(path.join(__dirname, "../../public/index.html"));
	});

router.route('/search')
	.get(wrap(IndexCtrl.searchText));

module.exports = router;