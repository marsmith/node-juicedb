var localjuice = require('./index');

var instagramUsers = ['troy_beverage','newburghbrewing','westkillbrewing','woodstockbrewing','oxbowbrewingcompany','burlingtonbeer','planbeefarmbrewery','alchemistbeer','peekskillbrewery','rareformbrewco','fiddleheadbrewing','chathambrewing','druthersbrewing','commonrootsbrewing','paradoxbrewery','adirondackbrewery','suarezfamilybrewery','rootandbranchbrewing','foambrewers','tiredhandsbrewing','threesbrewing','hudsonvalleybrewery','mainebeerco','woodlandbeer','kcbcbeer','barrierbrewingco','singlecutbeer','otherhalfnyc','prairieales','nightshiftbeer','bissellbrothers','industrialartsbrewing','lawsonsfinest','treehousebrewco','grimmales','licbeerproject','trilliumbrewing','finbackbrewery','eqbrewery','fobeerco','hillfarmstead','sloopbrewingco']

instagramUsers.forEach(function (item) {
    localjuice.instagramByUser(item).then(function(result){
        console.log('Finished ' + item);
    })
    .catch(function(err){
        console.log('there was an error');
    });
});

//localjuice.instagramByUser('lawsonsfinest');
