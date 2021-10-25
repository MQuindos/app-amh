'use strict';
const path = require('path');
const chalk = require('chalk');

function errorHandler (err, req, res, next) {

  if(process.env.NODE_ENV == "development"){
    console.log(chalk.red.underline.bold('E R R O R  H A N D L E R:'));
    console.log(chalk.green.bold('name:'), chalk.yellow.italic(err.name));
    console.log(chalk.green.bold('message:'), chalk.yellow.italic(err.message));
    console.log(chalk.green.bold('err:'), chalk.yellow.italic(err));
    console.log(chalk.green.bold('stack:'), chalk.yellow.italic(err.stack));
  }
  if (err) {
    res.statusCode = err.statusCode || 500
    let response = {
        err: {
          type: 'Error handler',
          statusCode: res.statusCode,
          name: err.name,
          message: err.message,
        }
      };
    // res.send(response);
    return res.render('error', {
      message: 'Recurso no encontrado, intente nuevamente.'
      // error:{
      //   status:false
      // }      
    });
  }
  next();
}

module.exports = {
  errorHandler
};
