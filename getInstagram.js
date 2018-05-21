var localjuice = require('./index');

var instagramUsers = ['troy_beverage','newburghbrewing','woodstockbrewing','burlingtonbeer','planbeefarmbrewery','alchemistbeer','peekskillbrewery','rareformbrewco','fiddleheadbrewing','chathambrewing','druthersbrewing','commonrootsbrewing','paradoxbrewery','adirondackbrewery','suarezfamilybrewery','rootandbranchbrewing','foambrewers','hudsonvalleybrewery','mainebeerco','kcbcbeer','barrierbrewingco','singlecutbeer','otherhalfnyc','prairieales','nightshiftbeer','bissellbrothers','industrialartsbrewing','lawsonsfinest','treehousebrewco','grimmales','licbeerproject','trilliumbrewing','finbackbrewery','eqbrewery','fobeerco','hillfarmstead','sloopbrewingco','albanyaleandoyster'];

instagramUsers.forEach(function (item) {
    localjuice.instagramByUser(item).then(function(result){
        console.log('Finished ' + item);
    })
    .catch(function(err){
        console.log('there was an error');
    });
});

//localjuice.instagramByUser('lawsonsfinest');
