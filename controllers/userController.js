const models = require('../db/models');
const Jwt = require('../utils/jwt');
const jwt = new Jwt();
//const md5 = require('md5');

async function createUser(user) {
    try {
        if (!user) {
            throw new Error('User does not be falsy.');
        }

        if (!user.userName || !user.password) {
            throw new Error('All fields are required.');
        }

        //user.password = md5(user.password);
        return await models.User.create(user);
    } catch (e) {
        throw e;
    }
};

async function authentication(user) {
    try {
        if (!user) {
            throw new Error('User does not be falsy.');
        }

        if (!user.nom_usuario || !user.password) {
            throw new Error('userName and password are required.');
        }

        //user.password = md5(user.password);
        let userFound = await findOne(user);        

        if (!userFound) {
            throw new Error('User not found.');
        }

        const payload = {
            profile: userFound.profile,
            nom_usuario: user.nom_usuario,
        };

        const token = await jwt.createToken(payload);
        return {
            token: token,
            iduser: userFound.dataValues.idusuario
        }
    } catch (e) {
        throw e;
    }
};

// Funcioes del modelo User

function findOne(user) {
    return models.User.findOne({
            where: {
                nom_usuario: user.nom_usuario,
                password: user.password
            }
        })
        .then(user => {
            return user;
        })
        .catch(e => {
            throw e;
        });
};


function findByObject(object) {
    return models.User.findOne({
        where: object
    })
}


function findAlls() {
    return models.User.findAll({
            where: {
                estado: 'activo'
            },
            order: [
                ['nom_usuario', 'ASC'],

            ]
        })
        .then(user => {
            return user;
        })
        .catch(e => {
            throw e;
        });
};

module.exports = {
    findAlls,
    findByObject,
    createUser,
    authentication

};