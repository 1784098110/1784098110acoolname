const 
  port = 3000,
  Websocket = require('uws'),
  express = require('express'),
  url = require('url'),

  http = require('http'),
  app = express(),
  server = http.createServer(app);

  //express middlewares
const bodyParser = require('body-parser');
const middlewares = [
  bodyParser.json(),//for json
  bodyParser.urlencoded({extended:true}) //for form data
] 

var game_server = require('./server/game.server.js');


//debug toggle
window.debug = true;

/*
function func2(){
  let start = Date.now();
  for(let i = 0; i < 1000000000; i++){
  let num = Math.floor(Math.random() * 1000000);
  }
  console.log('Func2 Time: ' + (Date.now() - start));
}
function func1(){
  let start = Date.now();
  for(let i = 0; i < 1000000000; i++){
  let num = (Math.random() * 1000000) >> 0;
  }
  console.log('Func1 Time: ' + (Date.now() - start));
}

func2();
func1();
*/

server.listen(port);
console.log('Listening on port ' + port);

//for non-ideal situations
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})
  

//mount middlewares
app.use(middlewares);

//default packets/folder to send to client
app.use('/', express.static('client'));


//fetch file specifically required by client.
app.get( '/*' , function( req, res, next ) {

  //The file requested, needs to be path from app.js directory
  let file = req.params[0];

  //if(debug) console.log(' :: file requested : ' + file);
  res.sendFile( __dirname + '/' + file );

});

//fetch images required by client.
app.get( '/sprites/*' , function( req, res ) {

  //The file requested, needs to be path from app.js directory
  let fileName = req.url.split('/')[1] + '.png';
  //if(debug) console.log(' :: sprite requested : ' + fileName);

  res.sendFile( __dirname + '/' + file );

});

//when player submits config by clicking 'play'
app.post('/*', function(req, res) {

  //if(debug) console.log('Player Config Submitted: ');
  //if(debug) console.log(req.url);

  //fake mini load balancing
  if(game_server.isOpen()){

    let instance = game_server.getInstance(req.body);
    res.json(instance);

  }
  else{
    console.error(' :: Error: Server Unavailable');
  }

  
});



const wss = new Websocket.Server({server: server, clientTracking: true});

wss.on('connection', function(ws){

  if(debug) console.log(' :: New Connection');
  
  ws.on('message', function(message){
    //if (debug) console.log(' :: Message Received: ' + message);
    game_server.onMessage(ws, message);
  });

  ws.on('close', function(code, reason){
    if(debug) console.log(' :: Disconnection with code ' + code + ' : ' + reason);

    game_server.playerLeave(ws); 
  });

  ws.on('error', function(error){
    if(debug) console.error(' :: WS ERROR :: ' + error);
  });

});


