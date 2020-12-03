const Jwt = require('../utils/jwt');
const jwt = new Jwt();

module.exports = (req, res, next) => {

    try {
console.log('auth');
        let token = '';
        if (typeof req.headers.authorization !== 'undefined') {
            token = req.headers.authorization.trim();
        }

        if (typeof req.cookies.authorization !== 'undefined' && token.trim() == '') {
            token = req.cookies.authorization.replace('Bearer ', '').trim();
        }

        if (token == '') {
            return res.redirect('/');
        }

        try {
            console.log('verify token');
            jwt.verifyToken(token);

        } catch (error) {

            console.log('catch verify token');
            return res.status(201)
                .cookie('authorization', '')
                .cookie('test', 'test')
                .redirect('/');

            //.json({ status: false, msg: 'Expiró la session, debe loguearse nuevamente' })
        }

        console.log('salimos auth');
        next();
    } catch (e) {
        console.log('catch auth');
        res.status(401);
        next(e);
    }
};