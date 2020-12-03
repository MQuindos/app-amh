'use strict';

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        idusuario: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        nom_usuario: DataTypes.STRING,
        password: DataTypes.STRING,
        estado: DataTypes.INTEGER
    }, {
        tableName: 'maeusuarios'
    }, {});
    User.associate = function(models) {
        // associations can be defined here
    };

    return User;
};