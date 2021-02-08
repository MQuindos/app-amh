
require('dotenv').config();
const express = require('express');
const router = express.Router();
const session = require('express-session');
const moment = require('moment');

const pdfCrea = require('../pdfcreate/pdfcreatecartola');
const cartolaControl = require('../controllers/cartolaController');

router.get('/cartola/vistagenerarcartola', async(req, res) => {

    return await cartolaControl.getVistaCartola(req,res);    

});

router.get('/cartola/generacartola',async (req, res) => {

    return await pdfCrea.creaCartola(req,res);    

});


module.exports = router;