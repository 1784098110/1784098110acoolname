

  var game_server = module.exports;


  //?? how exactly does this line work.
    //Since we are sharing code with the browser, we
    //are going to include some values to handle that.
  global.window = global.document = global;
  
    //Import shared game library code.
  require('../shared/game.core.js');
  require('../shared/types.js');
  require('../shared/weapons.js');
  require('../shared/fires.js');
  require('../shared/landscape.js');
  require('../shared/helpers.js');

  //outside libraries needed by game mechanism
  window.MersenneTwister = require('mersenne-twister');

  //?? closure a good idea?
(function(){

    //A simple wrapper for logging so we can toggle it,
    //and augment it for clarity.
  game_server.log = function() {
    if(debug) console.log.apply(this,arguments);
  };

  game_server.local_time = 0;
  game_server._dt = new Date().getTime();
  game_server._dte = new Date().getTime();

  //what for ??
  setInterval(function(){
    game_server._dt = new Date().getTime() - game_server._dte;
    game_server._dte = new Date().getTime();
    game_server.local_time += game_server._dt/1000.0;
  }, 4);



  //specefic to this particular game room/server
  game_server.port = 3000;
  game_server.ip = 'localhost';

  //specific to game mode
  game_server.width = 2000;
  game_server.height = 2000;
  game_server.cellSize = 50;
  game_server.mapSeed;//generated each time game is created

  

  //fake load balancing
  game_server.isOpen = function(){
    return true;
  }

  //return game init data for client as json
  game_server.getInstance = function(clientConfig){

    if(!this.gamecore) this.createGame();//create game if no game

    if(debug) console.assert(clientConfig.mode);//replace with proper verification. todo
    if(debug) console.assert(this.mapSeed !== undefined);

    let instance = {//init package for client
      width: this.width, 
      height: this.height, 
      cellSize: this.cellSize, 
      mapSeed: this.mapSeed,
      url: 'ws://' + this.ip + ':' + this.port,
      players: [], //list of playerconfigs
      objects: [],  //obstacles that changed from initial configuration based on seed
      spawn: undefined,
      pID: undefined,
      tID: undefined,
      server_time: undefined
    }


    this.gamecore.players.forEach((player) => {
      instance.players.push(player.playerConfig);
    });

    instance.objects = this.gamecore.server_getChangedObstacles();

    //for client side syncing
    instance.server_time = this.gamecore.local_time;

    return instance;
  }




  game_server.onMessage = function(client,message) {
    /**
     * todo. needs more message types. (client player init/config etc.)
     * i header means client input
     */
    if(!this.gamecore) return;//sometimes a client might send msg after killGame.

    let update = message.split('/');

    switch(update[0]){
      case 'j':
        game_server.onJoin(client, update[1]);
      case 'i':
        game_server.onInput(client, update[1]);
      case 'p':
        game_server.onPing(client, update[1]); 
    }
  };

  game_server.onPing = function(client, data){
    //if(debug) console.log('Ping received: ' + data);

    client.send('s/p/' + data);
  }

  game_server.onInput = function(ws, parts) {
      //The input commands come in like u-l,
      //so we split them up into separate commands,
      //and then update the players
    var update = parts.split(';');
    var input_commands = update[0];
    var input_time = update[1];
    var input_seq = update[2];

    //if(debug) console.log('Input received: ' + parts);

      //the client should be in a game, so
      //we can tell that game to handle the input
    if(debug) console.assert(ws.pID !== undefined);
    this.gamecore.handle_server_input(ws.pID, input_commands, input_time, input_seq);
  

  }; //game_server.onInput

  //todo, this is where server starts a new game according to mode with no player
    //Define some required functions
  game_server.createGame = function() {
    //optimize. gameconfig and gameinstance redundant
    //?? does game need an id? not necessary if one process one game?
      //Create a new game instance
    let generator = new MersenneTwister();
    this.mapSeed = Math.floor(generator.random() * 300);//magic number. randomly get a seed from 0 to 299

    var gameInstance = {
        //id : UUID(),        //generate a new id for the game
        width: this.width,
        height: this.height,
        cellSize: this.cellSize,
        mapSeed: this.mapSeed
      };


      //Create a new game core instance, this actually runs the
      //game code like collisions and such.
    this.gamecore = new game_core(true, gameInstance );
    this.gamecore.server_gameOverInterface = this.gameOverInterface.bind(this);
    
      //Start updating the game loop on the server
    this.gamecore.update( new Date().getTime() );

    //setTimeout(this.gamecore.killGame.bind(this.gamecore), 5000);

  }; //game_server.createGame

  //add a player to the game
  game_server.onJoin = function(ws, clientConfig){

    clientConfig = JSON.parse(clientConfig);

    this.gamecore.server_playerConnect(ws, clientConfig);
  }   

  //if player is no longer in the game
  game_server.playerLeave = function(ws){
    let pID = ws.pID;
    
    if(pID === undefined) return;
    //if(debug) console.log(' :: Player left: pId: ' + pID);

    //proceed to remove from game only player's in a game
    if(!this.gamecore || !this.gamecore.players.has(pID)) return;
    this.gamecore.removePlayer(pID)
  }   

  //for gamecore to call when game ends
  game_server.gameOverInterface = function(){

    if(debug) console.log(' :: Game Finished');

    this.mapSeed = undefined;
    this.gamecore = undefined;
  }

})();


