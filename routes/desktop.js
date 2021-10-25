const express = require('express');
const router = express.Router();
var session = require('express-session');
var ssn;
router.get('/desktop/init', (req, res) => {
    ssn = req.session;
    res.render('desktop/desktop', { name_user: ssn.nombre, nombrelog: 'ssd',namebbdd:process.env.SERVERBD });

});

module.exports = router;