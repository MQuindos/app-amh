/** Definimos los metodos de autentificacion */

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const pool = require('../database');
const helpers = require('../lib/helpers');

passport.use('local.signup', new LocalStrategy({
    usernameField:'username', /**NOmbre del campo enviado en formulario de logeo */
    passwordField:'password',/**NOmbre del campo enviado en formulario de logeo */
    passReqToCallback:true
}, async(req,username,password,done) => {
    
    const { fullname } = req.body;
    const newUser = {
        username,
        password,
        fullname
    };

    newUser.password = await helpers.encrypPassword(password); /**Enviamos la password para encriptar */
    const result = await pool.query('INSERT INTO users set ? ',[newUser]);
    newUser.id = result.insertId;
    return done(null,newUser);
    
}));


/**Para guardar el usuario en una session */
passport.serializeUser((usr,done) => {
    done(null,usr.id);
});

passport.deserializeUser(async(id,done) => {
    const rows = await pool.query('SELECT * FROM users WHERE id = ? ',[id]);
    done(null,rows[0]); /**Retorna el objeto Cero */
});