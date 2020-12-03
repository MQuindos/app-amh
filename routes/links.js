const express = require('express');
const router = express.Router();

//const pool = require('../database');

const mssql = require('mssql');
const database = require('../keys');

const pool1 = new mssql.ConnectionPool(database);

router.get('/add', (req, res) => {
    res.render('links/add');
});

router.post('/add', async(req, res) => {

    //Podriamos enviar el objeto directo del req.body
    const { title, url, description } = req.body;
    let newLinks = {
        title,
        url,
        description
    };

    const requestAdd = pool1.request(); // or: new sql.Request(pool1)
    const resultAdd = await requestAdd.query(`INSERT INTO links(title,url,description,user_id,created_at,status) values ('${title}','${url}','${description}',1,getdate(),1)`);

    //await pool.query('INSERT INTO links set ?', [newLinks]);
    //req.flash('success', 'Link saved successfully');
    res.redirect('/links');

});

router.get('/', async(req, res) => {

    try {

        // let pool1Connect = pool1.connect();
        // await pool1Connect;
        //let links = await pool.query('SELECT * FROM links;');
        //let links = await pool.query('SELECT 1 as Nmero');

        // const request = pool1.request(); // or: new sql.Request(pool1)
        // const result = await request.query('SELECT * FROM links where status = 1;');
        // let links = result.recordsets[0];
        let links = [];
        res.render('links/list', { links });

    } catch (err) {

        console.error('SQL error', err);
    }

});


router.get('/delete/:id', async(req, res) => {
    let id = req.params.id;
    const requestDel = pool1.request(); // or: new sql.Request(pool1)
    const resultDel = await requestDel.query(`UPDATE links set status = 0 where id = ${id}`);
    // let id = req.params.id;
    // await pool.query('DELETE FROM links where id = ?', [id]);
    // req.flash('success', 'Link removed successfully');
    res.redirect('/links');
});

router.get('/edit/:id', async(req, res) => {
    let id = req.params.id;
    const requestEdit = pool1.request(); // or: new sql.Request(pool1)
    const respEdit = await requestEdit.query(`Select * from links where id = ${id}`);
    // let link = await pool.query(`Select * from links where id = ${id}`);
    //req.flash('success', 'Link edited successfully');
    let linksReturn = respEdit.recordsets[0];
    res.render('links/edit', { links: linksReturn[0] });

});

router.post('/edit/:id', async(req, res) => {
    let id = req.params.id;
    let { title, url, description } = req.body;
    let editLink = {
        title,
        url,
        description
    };

    await pool.query('UPDATE links set ? where id = ?', [editLink, id]);
    req.flash('success', 'Link updated successfully');
    res.redirect('/links');

});


module.exports = router;