'use strict';
const express = require('express');
const router = express.Router();
var session = require('express-session');
const userController = require('../controllers/userController');
const User = require('../db/models/user');

var ssn ;

router.get('/', async(req, res) => {
    ssn = req.session;
    try {

        let token = '';
        if (typeof req.headers.authorization !== 'undefined') {
            token = req.headers.authorization.trim();
        }

        if (typeof req.cookies.authorization !== 'undefined' && token.trim() == '') {
            token = req.cookies.authorization.trim();
        }

        if (token.trim() == '') {
            let data = [];
            await userController.findAlls().then(function(result) {
                for (let i = 0; i < result.length; i++) {
                    let element = result[i];
                    data.push(element.dataValues);
                }
            });

            return res.render('auth/login', { xusuarios: data, flag: 'login',namebbdd:process.env.SERVERBD });

        } else {
            //res.redirect('/amh/home');            
            return res.render('desktop/desktop', { name_user: ssn.nombre, nombrelog: 'ssd',namebbdd:process.env.SERVERBD });
        }

    } catch (error) {

        return res.json({
            mensaje: error.message,
            status: false,
            msg:'Estamos en auth routes.'
        });

        // return res.render('error', {
        //     message: 'Recurso no encontrado, intente nuevamente.'            
        //   });
    }

});

router.post('/auth/autenticar', async(req, res) => {
    
    try {
        ssn=req.session;
        let { usuario, password } = req.body;
        let user = {
            nom_usuario: usuario,
            password
        }

        const respuesta = await userController.authentication(user);
        const token = respuesta.token;        
        
        ssn.iduser = respuesta.iduser;
        ssn.nombre = usuario;

        res.status(201)
            .cookie('authorization', 'Bearer ' + token)
            .cookie('test', 'test')
            .json({ status: true, msg: 'Logueado correctamente !!', token });

    } catch (error) {

        res.json({ status: false, msg: 'Error con las credenciales', msgerror: error.message });
    }

});

router.get('/auth/destroysession', async(req, res) => {

    res.clearCookie("authorization");

    let data = [];
    await userController.findAlls().then(function(result) {
        for (let i = 0; i < result.length; i++) {
            let element = result[i];
            data.push(element.dataValues);
        }
    });

    res.render('auth/login', { xusuarios: data, flag: 'login' });

});

function getDataLogin() {
    try {

    } catch (error) {
        console.log('Problemas al obtener data login:', error.message);
    }
}

module.exports = router;