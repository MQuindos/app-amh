'use strict';

const fs = require("fs-extra");
const path = require("path");
const puppeteer = require('puppeteer');
const hbs = require("handlebars");
const moment = require('moment');
const session = require('express-session');
var ssn;

const cartola = require('../controllers/cartolaController');

async function creaCartola(req,res) {
    try {   
        
        let data = await cartola.getMovimiento_formatoCartola();

        let codigoAnt = 0;
        let codigoAct = 0;
        let movGeneral = []
        let movCobro = [];
        let fullPathFile = [];
        let pathFile = [];
        let nombreCtaCte = '';
        let idmovimiento = 0;
        let cont = 1;
        let fueCreado = false;
        let respcreapdf;

        if(data.status) 
        {
            if(data.data.length > 0) {

                for(let i in data.data)
                {
                    fueCreado = false;

                    if(i < 1) {                        
                        codigoAnt = data.data[i].codigo;
                    }

                    codigoAct = data.data[i].codigo;
                    nombreCtaCte = data.data[i].nombrectacte;
                    idmovimiento = data.data[i].idmovimiento;

                    if(codigoAnt === codigoAct) {
                        
                        if(idmovimiento != 41 && idmovimiento != 6 && idmovimiento != 17)
                        {
                            movGeneral.push({
                                'ID':cont,                                
                                'fecha':data.data[i].fctexto,
                                'movimiento':data.data[i].movimiento,
                                'glosa': data.data[i].glosa,
                                'entrada':data.data[i].entrada,
                                'salida':data.data[i].salida
                            });

                            cont++;

                        }
                        else
                        {
                            movCobro.push({
                                    'fecha':data.data[i].fctexto,
                                    'movimiento':data.data[i].movimiento,
                                    'glosa': data.data[i].glosa,
                                    'monto' : data.data[i].monto
                                });
                        }                       
                         
                        codigoAnt = data.data[i].codigo;
                        
                    }
                    else
                    {
                        cont = 1;
                        
                        respcreapdf = await creaCartolaFile(codigoAnt,nombreCtaCte,movGeneral,movCobro,'Enero');
                        if(respcreapdf.status) {
                            fueCreado=true;
                            movGeneral = [];       
                            movCobro = [];                            
                            pathFile.push({'codigo':codigoAnt,'path':respcreapdf.fullPathFile,'nombrectacte':nombreCtaCte});
                            
                        }

                        codigoAct = data.data[i].codigo;
                        codigoAnt = data.data[i].codigo;

                        if(idmovimiento != 41 && idmovimiento != 6 && idmovimiento != 17) {

                            movGeneral.push({
                                'ID':cont,                                
                                'fecha':data.data[i].fctexto,
                                'movimiento':data.data[i].movimiento,
                                'glosa': data.data[i].glosa,
                                'entrada':data.data[i].entrada,
                                'salida':data.data[i].salida
                            });

                        }
                        else
                        {
                            movCobro.push({
                                    'fecha':data.data[i].fctexto,
                                    'movimiento':data.data[i].movimiento,
                                    'glosa': data.data[i].glosa,
                                    'monto' : data.data[i].monto
                                });
                        }

                    }
                    
                }

                if(!fueCreado) {                   

                    respcreapdf = await creaCartolaFile(codigoAnt,nombreCtaCte,movGeneral,movCobro,'Enero');                    
                    pathFile.push({'codigo':codigoAnt,'path':respcreapdf.fullPathFile,'nombrectacte':nombreCtaCte});
                }

                return res.json( {
                    status : true,
                    archivos: pathFile
                });

            }    
            else
            {
                return res.json(  {
                    status : false,
                    message: 'No hay registros en la cuentas corrientes para generar cartola.'
                });
            }        
            
        }
        else
        {
            return res.json(  {
                status : false,
                message: 'Problemas al obtener la información.'
            });
        }

        
    } catch (error) {       

        console.log('error (pdf):(creaCartola):: ',error);

        return res.json(  {
            status : false,
            message: error.message
        });
        
    }
}

async function creaCartolaFile(codigoAnt,nombreCtaCte,movGeneral,movCobro,mes) {

    try {

        moment.locale('es');
        let fullPathFile = '';
                
        //Comprobamos exitencia de carpeta,
        let nameFilePdf = `cartola_${codigoAnt}_${moment().format('YYYYMMDD_HHmmss')}.pdf`;            
        let folderFilePdf = '/public/download/comprobantes/cartola/'+moment().format('MMMM-YYYY')+'/';
        let pathPdf = path.join(process.cwd(),folderFilePdf,nameFilePdf);
        let patCreate = path.join(process.cwd(),folderFilePdf);
        let respues = await fs.promises.mkdir(patCreate, { recursive: true })
    
        fullPathFile = '/download/comprobantes/cartola/'+moment().format('MMMM-YYYY')+'/' + nameFilePdf;
        
        //Preparamos creacion de archivo PDF.
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
    
        //DATA PARA CREAR PDF
        let ress = {
                codigo : codigoAnt,
                nombrectacte: nombreCtaCte,
                data: movGeneral,
                datacobromq:movCobro,
                fc:mes
            }
    
        const content = await compile('formatCartola',ress);
        await page.setContent(content);
    
        await page.pdf({
            path: pathPdf,
            format: '',
            printBackground: true,
            displayHeaderFooter: false,
            headerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:48px;">                                
                                <span style="margin-left: 20px;"></span>
                            </div>`,
            footerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:48px;width:100%;text-align:center;">
                        </div>`,
            margin: {
                top: '20px',
                right: '18px',
                bottom: '28px',
                left: '20px'
            }
        });
    
        await browser.close();


        return {
            status: true,
            fullPathFile
        }
    } catch (error) {

        return {
            status: false,
            message : error.message
        }
    }

    

}

const compile = async function(templateName, data) {
    const filePath = path.join(process.cwd(),'pdfcreate',`${templateName}.hbs`);
    const html = await fs.readFile(filePath,'utf-8');
    
    return await hbs.compile(html)(data);
};

module.exports = {
    creaCartola
}