const bycript = require('bcryptjs');

const helpers = {};

helpers.encrypPassword = async(password) => {
    /**Recive contraseña, crea un patron con la cantidad de vueltas que le hemos dado 
     * y luego pasamos este patron con la contraseña para que
     * la cifre finalmente
     */
    const salt = await bycript.genSalt(10);
    const hash = await bycript.hash(password, salt);
    return hash;
};

helpers.matchPassword = async(password, savedPassword) => {
    try {
        await bycript.compare(password, savedPassword);
    } catch (error) {
        console.log(error);
    }
};


module.exports = {
    helpers
};