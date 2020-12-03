'use strict';

var fs = require('fs');
var path = require('path');
var Sequelize = require('sequelize');
var basename = path.basename(__filename);
var env = process.env.NODE_ENV || 'development';
// var config    = require(__dirname + '../../../config/database.json')[env];
// var config    = require(__dirname + '../../../config/database');
var config = require('../../config/database');
var db = {};

if (config.use_env_variable) {
    var sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
    var sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
    .readdirSync(__dirname)
    .filter(file => {
        return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
    })
    .forEach(file => {
        var model = sequelize['import'](path.join(__dirname, file));
        db[model.name] = model;
    });

Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});


// sequelize.query('SELECT top 1 * FROM maeusuarios').then(function(result) {
//     console.log(result);
// }).error(function(err) {
//     console.log(err);
// });

// sequelize
//     .authenticate()
//     .then(function(err) {
//         console.log('Connection has been established successfully.');
//     })
//     .catch(function(err) {
//         console.log('Unable to connect to the database:', err);
//     });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;