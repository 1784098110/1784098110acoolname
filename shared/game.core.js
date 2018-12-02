'use strict';

//The main update loop runs on requestAnimationFrame,
//Which falls back to a setTimeout loop on the server
//optimize: setimmediate instead of settimeout
//Code below is from Three.js, and sourced from links below

  // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
  // http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

  // requestAnimationFrame polyfill by Erik Möller
  // fixes from Paul Irish and Tino Zijdel

  var frame_time = 60/1000; // run the local game at 16ms/ 60hz
  if('undefined' != typeof(global)) frame_time = 50; //on server we run at 45ms, 22hz
  
  ( function () {
  
    var lastTime = 0;
    var vendors = [ 'ms', 'moz', 'webkit', 'o' ];
  
    for ( var x = 0; x < vendors.length && !window.requestAnimationFrame; ++ x ) {
      window.requestAnimationFrame = window[ vendors[ x ] + 'RequestAnimationFrame' ];
      window.cancelAnimationFrame = window[ vendors[ x ] + 'CancelAnimationFrame' ] || window[ vendors[ x ] + 'CancelRequestAnimationFrame' ];
    }
  
    if ( !window.requestAnimationFrame ) {
      window.requestAnimationFrame = function ( callback) {
        var currTime = Date.now(), timeToCall = Math.max( 0, frame_time - ( currTime - lastTime ) );
        var id = window.setTimeout( function() { callback( currTime + timeToCall ); }, timeToCall );
        lastTime = currTime + timeToCall;
        return id;
      };
    }
  
    if ( !window.cancelAnimationFrame ) {
      window.cancelAnimationFrame = function ( id ) { clearTimeout( id ); };
    }
  
  }() );
  
      //Now the main game class. This gets created on
      //both server and client. Server creates one for
      //each game that is hosted, and client creates one
      //for itself to play the game.
  
  /* The game_core class */
    //game instance needs world width, height, cellsize
    var game_core = function(isServer, gameInstance){

      if(debug) console.log(' {{ :: New Gamecore :: }}');
      
      //Store a flag if we are the server
      this.server = isServer;

      //undefined on clientSide and later assigned by initGame
      this.instance = gameInstance;
      
      //include both upper and under ground
      this.players = new Map();//including dead spectates etc.
      this.fires = new Map();   //fire objects(bullets, active melee weapons etc.)
      this.obstacles = new Map();

      this.oidCounter = 0; //ostacles id apply to both server and client

      //Set up some physics integration values ?? (just for prediction && interpolation)
      this._pdt = 0.0001;         //The physics update delta time
      this._pdte = new Date().getTime();  //The physics update last delta time
        //A local timer for precision on server and client
        //?? necessary?
      this.local_time = 0.016;      //The local timer in seconds
      //these two are for measuring local_time
      this._dt = new Date().getTime();  //The local timer delta
      this._dte = new Date().getTime();   //The local timer last frame time
        
      //for regular update
      this.dt;
      this.lastframetime;
      this.updateid; //for requestanimationframe tracking
      
      //store intervals to be cleared when unneeded for memory management
      this.intervals = [];
    

      //?? it this necessary?
      //updates _dt, _dte, local_time
        //Start a fast paced timer for measuring time easier
      this.create_timer();

      if(!this.server) {

        //client only. keep a reference in order to execute killGame
        this.client_gameOverInterface; //?? better way to execute killGame through gamecore?

        //necessary for players on clientside because client has all players' stats but only some's actions
        this.currPlayersID = [];
        this.clientConfig; //store temporarily to be sent when ws is connected

        this.self; //special pointer for self. But self is also in regular players array
        
          //Fetch the viewport
        this.canvas = document.getElementById('gameCanvas');
        this.showMap = false;//show player map toggle ?? where should this toggle be for best practice?
        this.upperMap;//to be created by map

          //Adjust their size
        //if(debug) console.log('client gamecore init: canvas width: ' + game.camera.width + ' height: ' + game.camera.height);
        this.canvas.width = document.body.clientWidth;
        this.canvas.height = document.body.clientHeight;
        this.ctx = this.canvas.getContext('2d');

        //camera will be set to follow self upon init
        this.camera = new Game.Camera(undefined, this.canvas.width, this.canvas.height);

        //to be fetched periodically by input handler and sent to server
        this.controls = {
          mouseX: 0, //relative to canvas not world
          mouseY: 0,
          up: false,
          down: false,
          left: false,
          right: false,
          lClick: false,
          rClick: false
        };

        this.ws;
        //for making sure no message is sent to server before connection is ready
        this.connectionReady = false;
        this.suspendGame = false;//when player died but still in game room

           //Create the default configuration settings ?? from original game. delete unneeded code
        this.client_create_configuration();
  
           //A list of recent server updates we interpolate across
           //This is the buffer that is the driving factor for our networking
        this.server_updates = [];

      } else { //if it's server

        this.playerAlives = 0;//count of how many are alive
        this.server_gameOverInterface;//to call server.js when game ends. ?? cleaner way to let server.js know?

        this.server_time = 0;
        this.laststate = {};

        this.fidCounter = 0; //for assigning fid to fires
        this.pidCounter = 0; //for assigning pID to players
        
        this.map = new Game.Land(this.instance.width, this.instance.height, this.instance.cellSize);
        this.generateMap(this.instance.mapSeed);

        this.create_physics_simulation();
  
      }
  
    }; //game_core.constructor
  
  //server side we set the 'game_core' class to a global type, so that it can use it anywhere.
  if( 'undefined' != typeof global ) {
    module.exports = global.game_core = game_core;
  }
  
  /*
    Helper functions for the game code
  
      Here we have some common maths and game related code to make working with 2d vectors easy,
      as well as some helpers for rounding numbers to fixed point.
  
  */
  
    // (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
  Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };
    //copies a 2d vector like object from one to another
  game_core.prototype.pos = function(a) { return {x:a.x,y:a.y}; };
    //Add a 2d vector with another one and return the resulting vector
  game_core.prototype.v_add = function(a,b) { return { x:(a.x+b.x).fixed(), y:(a.y+b.y).fixed() }; };
    //Subtract a 2d vector with another one and return the resulting vector
  game_core.prototype.v_sub = function(a,b) { return { x:(a.x-b.x).fixed(),y:(a.y-b.y).fixed() }; };
    //Multiply a 2d vector with a scalar value and return the resulting vector
  game_core.prototype.v_mul_scalar = function(a,b) { return {x: (a.x*b).fixed() , y:(a.y*b).fixed() }; };
    //Simple linear interpolation
  game_core.prototype.lerp = function(p, n, t) { var _t = Number(t); _t = (Math.max(0, Math.min(1, _t))).fixed(); return (p + _t * (n - p)).fixed(); };
    //Simple linear interpolation between 2 vectors
  game_core.prototype.v_lerp = function(v,tv,t) { return { x: this.lerp(v.x, tv.x, t), y:this.lerp(v.y, tv.y, t) }; };


  
  /*
  
   Common functions(not true)
  
    These functions are shared between client and server, and are generic
    for the game state. The client functions are client_* and server functions
    are server_* so these have no prefix.
  
  */

  //actually kills the process. 
   game_core.prototype.killGame = function(){

    //if(debug) console.assert(this.players.size === 0); //make sure no player is in game
    if(debug) console.log(' :: Kill Game: intervals to be cleared: ' + this.intervals.length);
    if(debug) console.assert(this.updateid);

    window.cancelAnimationFrame(this.updateid);

    //clear intervals for memory management
    for(let i = 0, l = this.intervals.length; i < l; i++){
      clearInterval(this.intervals[i]); 
    }
    
    if(this.server) this.server_gameOverInterface();//call server.js's endgame

  }

  //upon receiving init response from server.
  game_core.prototype.client_initGame = function(serverResponse, viewWidth, viewHeight){
    if(debug) console.assert(this.instance === undefined);
    if(debug) console.log(' :: Client initGame');

    //connect to ws server and attach pid for identification
    this.client_connect_to_server(serverResponse.url);

    let gameInstance = {
      width: serverResponse.width,
      height: serverResponse.height,
      cellSize: serverResponse.cellSize,
      mapSeed: serverResponse.mapSeed
    }
    this.instance = gameInstance;
    
    //?? is this necessary?
    this.local_time = serverResponse.server_time + this.net_latency;

    //init map
    this.map = new Game.Land(this.instance.width, this.instance.height, this.instance.cellSize);
    //const start0 = Date.now();
    this.generateMap(this.instance.mapSeed);
    //if(debug) console.log(`map generate time: ${Date.now() - start0}`);
    this.camera.setViewport(viewWidth, viewHeight);//?? client or gamecore fetch window size? messy?
    this.upperMap = this.map.render(this.obstacles); //generate background graphics
    //init other players
    for(let i = 0, l = serverResponse.players.length; i < l; i++){

      let playerConfig = serverResponse.players[i];
      let player = new Game.Player(playerConfig.health, playerConfig.speed, playerConfig.vision, 
        playerConfig.pID, playerConfig.tID, this.createWeapon(playerConfig.lWeapon), this.createWeapon(playerConfig.rWeapon), playerConfig.color, playerConfig.name, playerConfig.viewW, playerConfig.viewH, this);
      //since we don't spawn other players, manually set them to active, ?? or do others' states not matter?
      player.state = Game.enums.PState.active;
      this.players.set(player.pID, player);//todo. for 'self in players array' strategy we can put player in array with pId as their index for easy access
    }
  }

  game_core.prototype.createPID = function(){//players

    if(this.server){
      return this.pidCounter++;
    }
    else return undefined;
  }
  game_core.prototype.createFID = function(){//fires
    
    if(this.server){
      if(this.fidCounter > 3000){//todo. find the right max id. also should be different on client and server
        this.fidCounter = 0;
      }
      return this.fidCounter++;
    }
    else return undefined;
  }
  game_core.prototype.createOID = function(){
    //becase obstacles are generated on server and client in the same sequence, return the same id
    return this.oidCounter++;
  }

  game_core.prototype.compressPlayerConfig = function(playerConfig){
    let msg = 's/j/'; //player join message header

    msg += playerConfig.health + ';';
    msg += playerConfig.speed + ';';
    msg += playerConfig.vision + ';';
    msg += playerConfig.pID + ';';
    msg += playerConfig.tID + ';';
    msg += playerConfig.lWeapon + ';';
    msg += playerConfig.rWeapon + ';';
    msg += playerConfig.color + ';';
    msg += playerConfig.name;

    return msg;
  }


    //create playerconfig out of json sent from client
  game_core.prototype.buildPlayerConfig = function(clientConfig){
    let pID = this.createPID();

    let playerConfig = {

      pID: pID, //is undefined if this is client core
      tID: pID, //todo. no team play for now
      health: 100, //todo. these stats should change depending on clientConfig(carrying weight, buffs)
      speed: 300,
      vision: 1,
      lWeapon: clientConfig.lWeapon, //todo. make sure chosen weapon is not unavailable
      rWeapon: clientConfig.rWeapon,
      color: clientConfig.color,
      name: clientConfig.name || 'A Poor Boy',
      viewW: clientConfig.viewW,
      viewH: clientConfig.viewH

    };

    return playerConfig;

  }

  game_core.prototype.client_addPlayer = function(playerConfig){
    //create new player based on config from client
    let player = new Game.Player(playerConfig.health, playerConfig.speed, playerConfig.vision, 
      playerConfig.pID, playerConfig.tID, this.createWeapon(playerConfig.lWeapon), this.createWeapon(playerConfig.rWeapon), playerConfig.color, playerConfig.name, playerConfig.viewW, playerConfig.viewH, this);

    if(this.self === undefined) {
      this.self = player;
    }else{
      this.players.set(player.pID, player);//self is also in regular players list, but right now self has no pid
      if(debug) console.log(' :: Player Join: pID: ' + player.pID);
    }
  }

  game_core.prototype.server_addPlayer = function(playerConfig){
    
    if(debug) console.log(' :: AddPlayer: pID: ' + playerConfig.pID + ' tID: ' + playerConfig.tID + ' player count before adding: ' + this.players.size);
    
    //inform all clients about it
    let update = this.compressPlayerConfig(playerConfig);
    this.players.forEach((player) => {
      player.instance.send(update);
    });

    //create new player based on config from client
    let player = new Game.Player(playerConfig.health, playerConfig.speed, playerConfig.vision, 
      playerConfig.pID, playerConfig.tID, this.createWeapon(playerConfig.lWeapon), this.createWeapon(playerConfig.rWeapon), playerConfig.color, playerConfig.name, playerConfig.viewW, playerConfig.viewH, this);
    
    player.playerConfig = playerConfig;

    //testing. for quick getting to gameover.
    /*
    setTimeout(() => {
      player.dmgs.push({pID: 0, dmg: 159, wType: 0});
    }, 5000);*/

    //if(debug) console.log('New Player viewW: ' + player.viewW + ' viewH: ' + player.viewH);
    
    //?? should bound be decided here or by spawn function?
    //put the player onto the actual map within the passed in bounds
    let spawnPos = this.spawnObject(player, 100, 100, this.map.width - 100, this.map.height - 100);
      
    if(debug) console.assert(player.pID !== undefined);
    this.players.set(player.pID, player);
    this.map.addObject(player); 
    
    return spawnPos;
  }

  game_core.prototype.server_playerConnect = function(ws, clientConfig){

    let playerConfig = this.buildPlayerConfig(clientConfig);

    //create and add player to game, then send spawn position to player ws
    let spawnPos = this.server_addPlayer(playerConfig);
    let player = this.players.get(playerConfig.pID);
    console.assert(player);

    //bind ws instance with player
    ws.pID = player.pID; //?? this is repeating. seems necessary though. better way?
    player.instance = ws;

    //inform client and game has officially began
    ws.send('s/s/' + player.pID + ';' + player.tID + ';' + spawnPos.x + ';' + spawnPos.y);

  }
  
  game_core.prototype.removePlayer = function(pID){//erased from game

    if(debug) console.log(' :: Remove Player: pID: ' + pID);
    
    let player = this.players.get(pID);
    //take off the map if it's on map
    if(player.cells.length > 0){
      this.map.removeObject(player);
    }
    this.players.delete(pID);

    if(this.players.size === 0) {
      this.killGame();
      return true;//to let server.js know game has ended
    }
    return false;
  }

  //decide location of spawn and tell object to spawn
  game_core.prototype.spawnObject = function(obj, xMin, yMin, xMax, yMax){
    //random spawn location
    let x = Math.round(Math.random() * (xMax - xMin)) + xMin;
    let y = Math.round(Math.random() * (yMax - yMin)) + yMin;

    obj.spawn(x, y);

    if(obj.pID !== undefined){//if it's a player
      this.playerAlives ++;
      if(debug) console.log('Player ' + obj.pID + ' spawned: alive count: ' + this.playerAlives);
    }

    return({x: x, y: y});
  }

  //return equippable weapon object of wType passed in as string
  game_core.prototype.createWeapon = function(name){

    let weapon;
    //client side weapons get extra params for graphic
    switch(name){ 
      /**
       * Weapon Params:
       * 
       * WClose: cool, dmg, range, (fire)life, spriteCount, name
       * WShoot: cool, dmg, range, speed, length, spriteCount, name
       * 
       *  */
      
      case 'dagger': 
        weapon =  new Game.Weapons.WClose(300, 8, 47, 200, 3, name);
        if(!this.server){weapon.addGraphic(Game.sprites[name], 0.2, 0, 0);}
        break;
      case 'katana':
        weapon = new Game.Weapons.WClose(1000, 99, 62, 600, 8, name);
        if(!this.server){weapon.addGraphic(Game.sprites[name], 0.8, 0.5, 0.5);}
        break;
      case 'fist':
        weapon = new Game.Weapons.WShoot(200, 4, 500, 400, 20, 1, name);
        if(!this.server){weapon.addGraphic(undefined);}//fist is invisible
        break;
      //todo. more weapons
    }

    return weapon;
    
  }

  //add a firing object to fire object list 
  game_core.prototype.server_addFire = function(obj){
    
    if(debug) console.assert(obj); 
    obj.fID = this.createFID(); 

    this.fires.set(obj.fID, obj); 
    this.map.addObject(obj); 

    //if(debug) console.log('\n\nadded fire: this.fires: ' + this.fires);
  }
  //remove from map and fires list and inform clients
  game_core.prototype.server_removeFire = function(fire){//i is index in fires list
    if(debug) console.assert(fire.fID !== undefined);

    //delete from players' visibles and inform clients of removal
    for(let i = 0, l = fire.viewers.length; i < l; i++){
      let player = fire.viewers[i];
      
      if(player.visibleFires.has(fire.fID)){
        player.visibleFires.delete(fire.fID);
        player.removedFires.push(fire.fID);//store fid for server update to later inform clients
      }
    }

    this.map.removeObject(fire);
    this.fires.delete(fire.fID); 
  }

    //Main update loop
  game_core.prototype.update = function(t) {

    //if(debug) console.log('core update');
    
      //Work out the delta time
      //optimize keep each object's shape the same for v8 
      //so don't declare outside constructor like this
      //change this.dt to let dt?
    
    this.dt = (this.lastframetime) ? ( (t - this.lastframetime)/1000.0).fixed() : 0.016;
  
      //Store the last frame time
    this.lastframetime = t;
  
      //Update the game specifics
    if(!this.server) {
      this.client_update();
    } else {
      this.server_update();
    }
  
      //schedule the next update
    this.updateid = window.requestAnimationFrame( this.update.bind(this));
  
  }; //game_core.update
  
  
  //executes all changes based on all accumulated unprocessed inputs 
  game_core.prototype.process_input = function( player ) {
    //optimize. only actually execute/change pos/clicks after all inputs are processed?
    //if(debug) console.log('core process input');

    //It's possible to have recieved multiple inputs by now
    //process one by one
    var ic = player.inputs.length;
    if(ic) {
      for(var j = 0; j < ic; ++j) {
        //if(debug) console.log('process input: pID: ' + player.pID + ' input time: ' + player.inputs[j].time + ' seq: ' + player.inputs[j].seq + ' last seq: ' + player.last_input_seq);

          //don't process ones we already have simulated locally
        if(player.inputs[j].seq <= player.last_input_seq) continue;
        
        let time = player.inputs[j].time;
        let step = time - player.last_input_time || 0.016; //0.016 is the ideal timestep in seconds

        player.handleControls(player.inputs[j].inputs, step); 
        player.last_input_time = time;
        player.last_input_seq = player.inputs[j].seq;
        
        
      } //for each input command
    } 
  
  }; //game_core.process_input
  
  game_core.prototype.parseClientInput = function( msg ) {
    if(debug) console.assert(typeof msg === 'string');

    let parts = msg.split(',');

    let controls = {};
    controls.mouseX = parseInt(parts[0], 10);
    controls.mouseY = parseInt(parts[1], 10);
    controls.up = parseInt(parts[2], 10);
    controls.down = parseInt(parts[3], 10);
    controls.left = parseInt(parts[4], 10);
    controls.right = parseInt(parts[5], 10);
    controls.lClick = parseInt(parts[6], 10);
    controls.rClick = parseInt(parts[7], 10);
    
    return controls;
  }
  
  game_core.prototype.update_physics = function() {
  
    if(this.server) {
      this.server_update_physics();
    } else {
      this.client_update_physics();
    }
  
  }; //game_core.prototype.update_physics

  /**
   * Concerning landscape
   * 
   * which happens in same sequence on server and client
   */

  //generate map based on a seed. create all the obstacles etc. but not AI
  game_core.prototype.generateMap = function (seed){

    const generator = new MersenneTwister(seed);//pseudorandom number
    const width = this.map.width;
    const height = this.map.height;
    if(debug) console.assert(width && height);

    this.map.addTerrian(new Game.Terrian(0, 0, width, height, Game.enums.TType.river, generator, true));

    //list of obstacles to generate and how many to generate.
    //argument: count, minSize, maxSize, xMin, xMax, yMin, yMax, oType 
    let templatesUpper = [//upper ground
      //new Game.Obstacle(1, 80, 80, 400, 400, 400, 400, Game.enums.OType.door),
      [0, 80, 80, 440, 440, 360, 360, Game.enums.OType.entrance, true],
      [0, 60, 120, 200, width - 200, 200, height - 200, Game.enums.OType.rock, true],
      [20, 50, 200, 100, width - 100, 100, height - 100, Game.enums.OType.house, true],
      [10, 30, 80, 100, width - 100, 100, height - 100, Game.enums.OType.tree, true],
      [0, 30, 80, 100, width - 100, 100, height - 100, Game.enums.OType.entrance, true],
    ];
    let templatesUnder = [//under ground
      [0, 80, 80, 440, 440, 360, 360, Game.enums.OType.entrance, false],
      [0, 60, 120, 100, width - 100, 100, height - 100, Game.enums.OType.rock, false],
      [0, 100, 400, 100, width - 100, 100, height - 100, Game.enums.OType.house, false],
      [0, 30, 80, 100, width - 100, 100, height - 100, Game.enums.OType.tree, false],
    ];

    let tooManyCollideCounterUpper = 0;
    let tooManyCollideCounterUnder = 0;
    templatesUpper.forEach((template) => {
      let count = template[0];
      template.splice(0, 1);//take out count when passing in to obstacle constructor
      for(let i = 0; i < count; i ++){
        let ob = new Game.Obstacle(...template, generator);//create the obstacle
        tooManyCollideCounterUpper += this.addObstacle(ob, 0);//find a place for it on map
      } 
    });
    templatesUnder.forEach((template) => {
      let count = template[0];
      template.splice(0, 1);//take out count when passing in to obstacle constructor
      for(let i = 0; i < count; i ++){
        let ob = new Game.Obstacle(...template, generator);//create the obstacle

        tooManyCollideCounterUnder += this.addObstacle(ob, 0);//find a place for it on map
      } 
    });

    if(debug) console.log(`generateMap: instances of too many failed fittings: upper: ${tooManyCollideCounterUpper} under: ${tooManyCollideCounterUnder} obstacles count: ${this.obstacles.size}`);
  }
  //add one obstacle object based on passed in template and pseudorandom num generator, also make sure no collides
  game_core.prototype.addObstacle = function(obj, count){

    //count how many times have tried to fit one obstacle. 
    if(count === undefined) count = 0;
    let collide = false;

    //for each physical part: add to map and check collides. if yes get new positoin and start over
    obj.parts.forEach((part) => {
      if(collide) return;//one collide is enough no need to continue

      this.map.addObject(part);
      if(this.map.checkCollides(part) || this.map.checkZones(part)) collide = true;
      this.map.removeObject(part);//need to remove even if this part fits otherwise can't remove it if another part doesn't fit midway through collision checking. ?? better way?
    });

    if(collide){//start over if doesn't fit
      if(++count > 5){
        //if(debug) console.log('addobstacle: too many failed fittings');
        return 1;//abandon obstacle after too many failed fittings
      } 

      obj.scramblePosition();
      return this.addObstacle(obj, count);
    }

    //else if fitted
    const oID = this.createOID();
    obj.oID = oID;

    //add all parts and zones and add to list
    obj.parts.forEach((part) => {
      part.oID = oID;//parts have the same oID ?? best idea?
      //if(debug) console.log('map addobstacle: part upperGround: ' + part.upperGround);
      this.map.addObject(part);
    });
    obj.zones.forEach(zone => {
      zone.oID = oID;
      this.map.addZone(zone);
    });
    obj.generator = undefined;//generator's sequence matters. safer to nullify after use
    //doesn't differentiate between ground levels
    this.obstacles.set(oID, obj);

    //if(debug) console.log(`addobstacle: oid: ${obj.oID} cellsg length: ${cellsgCount} x: ${obj.x} y: ${obj.y}`);
    
    return 0;
  }
  game_core.prototype.removeObstacle = function(obj){

    //remove all parts
    obj.parts.forEach(part => {
      this.map.removeObject(part);
    });

    //zones can't be removed. 

    //remove obstacle from list
    this.obstacles.delete(obj.oID);
  }


  /*
  
   Server side functions
   
    These functions below are specific to the server side only,
    and usually start with server_* to make things clearer.
  
  */

  //butt wipings
  game_core.prototype.server_endGame = function(){

    //set a timeout for smoothness
    window.setTimeout(()=>{
      //removeplayer will call killGame.
      this.players.forEach((player) => {  
        this.removePlayer(player.pID);
      });
    }, 3000);
  }

    //handle sprite indexes to keep clients updated on other clients' animations
  game_core.prototype.server_update_graphics = function(){
     
    this.players.forEach((player) => {
      if(player.state === Game.enums.PState.active) player.updateGraphics();
    });
  }

  game_core.prototype.server_update_stats = function(){

    this.players.forEach((player) => {
      if(player.state !== Game.enums.PState.active)return;

      player.updateStats();
      //if player just died
      if(player.health <= 0){
        this.server_player_died(player);

        //if only one left declare victory
        if(this.playerAlives !== 1) return;
        this.players.forEach((player) => {
          if(player.state === Game.enums.PState.active){this.server_player_won(player);}
        });  
      }
    });
  }
  game_core.prototype.server_update_zones = function() {
      
    this.players.forEach((player) => {

        //?? is checking for alive or not each time too inefficient?
        if(player.state === Game.enums.PState.active){
          this.map.handleZones(player);
        }
      
      });
  
  }
    //Updated at 15ms , simulates the world state, on sync with client
  game_core.prototype.server_update_physics = function() {
    
    let t = Date.now();//get current timestamp for time dependent physics update

    //handle fires(objects that hurt/move(projectiles etc))
    this.fires.forEach((fire) => {
      //git rid of the 'dead' objects. -1 is the life code for self termination
      if(fire.terminate) {
        //if(debug) console.log('update physics: remove fire: fID: ' + fire.fID + ' time passed: ' + (t-fire.lastTime));
        this.server_removeFire(fire);
        return;
      }
      //update the active ones
      fire.update(t);
      //if(debug) console.log('fire updated: left: ' + fire.left);

      //remove if out of map
      if(!this.map.checkWorldBoundary(fire)){
        this.server_removeFire(fire);
        return;
      }

      this.map.updateObject(fire);
      this.map.handleCollides(fire);
    });

    //handle players
    this.players.forEach((player) => {

      //?? is checking for alive or not each time too inefficient?
      if(player.state === Game.enums.PState.active){
        //?? should process input be handled by player? where exactly to call map updateobject?
        this.process_input(player);  
        player.inputs = [];

        //if(debug) console.log('server update physics: player[i]: x: ' + player.x + ' y: ' + player.y + ' angle: ' + player.angle);

        this.map.updateObject(player);
        this.map.handleCollides(player);
      }
    
    });

  }; //game_core.server_update_physics
  
    //Makes sure things run smoothly and notifies clients of changes
  game_core.prototype.server_update = function(){
    //?? after a while of continuous firing two weapons equilibrate to the same beat, cuz of round off?

    this.server_update_graphics();//has to be in rhythm with update broadcast
    this.server_update_stats();//todo. optimize. stats update and broadcast can be on slower loop
    this.server_update_zones();//no need to be on physics fast loop. ?? should it be?
    
      //Update the state of our local clock to match the timer
      //necessary ??
    this.server_time = this.local_time;

      //todo. needs to be curated to each client's view
      //optimize. string for now, should be binary. 
      //format: s/u/t;lastinputseq;x,y,angle(self);x,y,angle(other) etc.
      //Make a snapshot of the current state, for updating the clients
    this.players.forEach((player) => {

      let update = "s/u/";
      update += this.server_time.fixed();
      update += ':' + player.last_input_seq;
      update += ':';

      //now add the updates of players, including self despite 'oth' variable name
      this.players.forEach((oth) => {
        if(!player.sees(oth) || oth.state !== Game.enums.PState.active) return; //skip if it's self or self can't see it
        
        //else add the player's info to the update
        update += oth.x + ',' + oth.y + ',' + oth.angle + ',' + oth.pID + ',' + oth.lWeapon.spriteIndex + ',' + oth.rWeapon.spriteIndex + ',' + oth.health + ';';
      });

      update += ':';
      
      //todo. can't iterate over all fires. need to use visual grid
      //add newly visible fires' construction params.
      this.fires.forEach((fire) => {
        //check if player can see fire and if fire is already updated to client. fire only gets updated on creation and destruction
        if(player.sees(fire) && !player.visibleFires.has(fire.fID)){
          //optimize. right now sending a brand new fire constructor parameter set. client should only need a few for graphics
          switch(fire.wType){//diferent fire types need different params. update needs wtype in fron so client can identify
            case(Game.enums.WType.dagger):
              update += fire.wType + ',' + fire.fID + ',' + fire.dmg + ',' + fire.x + ',' + fire.y + ',' + fire.range  + ',' + fire.angle + ',' + fire.life  + ',' + fire.left + ',' + fire.holdRadius + ',' + fire.pID + ',' + fire.shape + ',' + fire.hitOnce + ',' + fire.hurtOnce + ',' + fire.passable + ';';
              break;
            case(Game.enums.WType.katana):
              update += fire.wType + ',' + fire.fID + ',' + fire.dmg + ',' + fire.x + ',' + fire.y + ',' + fire.range  + ',' + fire.angle + ',' + fire.life  + ',' + fire.left + ',' + fire.holdRadius + ',' + fire.pID + ',' + fire.shape + ',' + fire.hitOnce + ',' + fire.hurtOnce + ',' + fire.passable + ';'; 
              break;
            case(Game.enums.WType.fist):
              update += fire.wType + ',' + fire.fID + ',' + fire.dmg + ',' + fire.x + ',' + fire.y + ',' + fire.range  + ',' + fire.angle + ',' + fire.speed  + ',' + fire.pID + ',' + fire.shape + ',' + fire.hitOnce + ',' + fire.hurtOnce + ',' + fire.traveled + ';';
              break;
            default:
              console.log('::ERROR:: server update: fire update: no matching WType');
          }
          
          player.visibleFires.set(fire.fID, fire);
          fire.viewers.push(player);
        }
      });

      update += ':';

      //send out fids of fires to remove
      for(let j = 0, l = player.removedFires.length; j < l; j++){
      
        update += player.removedFires[j] + ';'; //add fid of fire to be removed 
      }
      player.removedFires = [];

      //if(debug) console.log('server update sent: ' + update);

      player.instance.send(update);
    });
  
  }; //game_core.server_update
  
  //optimize. no need for so many middleman at input handling
  game_core.prototype.handle_server_input = function(pID, input, input_time, input_seq) { //all passed in as original ws message segments 
  
      //Fetch which client this refers to out of the two
    var player = this.players.get(pID);

    if(!player) return; //player might be dead
    //if(debug) console.log('server handle input pID: ' + pID + ' input: ' + input);
    
    let controls = this.parseClientInput(input);
    let time = parseFloat(input_time);
    let seq = parseInt(input_seq, 10);


      //Store the input on the player instance for processing in the physics loop
    player.inputs.push({inputs:controls, time:time, seq:seq});

    //if(debug) console.log('Handle server input: input pushed, player inputs length: ' + player.inputs.length);

  }; //game_core.handle_server_input

  game_core.prototype.server_player_won = function(player){
    //inform other clients
    let update = 's/o/' + Game.enums.GOver.playerWin + ';' + player.pID;
    this.players.forEach((player) => {
      if(player.state !== Game.enums.PState.dead) player.instance.send(update);//only inform spectaters or actives
    });

    if(debug) console.log('Player ' + player.pID + ' is the Winner');

    this.server_endGame();//all the butt wipings

  }
  
  //handle a player's death. 
  game_core.prototype.server_player_died = function(player){

    //inform clients
    let deathUpdate = 's/d/' + player.pID + ';' + player.killerID;
    this.players.forEach((oth) => {

      oth.instance.send(deathUpdate);
    });

    //if(debug) console.log('Player death update: ' + deathUpdate);

    //then inform victim gameover. todo. there's respawn in some game modes
    let gameOverUpdate = 's/o/' + Game.enums.GOver.death + ';';
    player.instance.send(gameOverUpdate);
    
    //put to 'dead' state. remove only when quit game
    this.map.removeObject(player);
    player.state = Game.enums.PState.dead;
    this.playerAlives --;

    if(debug) console.log('Player ' + player.pID + ' died: alive count: ' + this.playerAlives);
  }

  /*
  
   Client side functions
  
    These functions below are specific to the client side only,
    and usually start with client_* to make things clearer.
  
  */
  
  game_core.prototype.client_handle_input = function(){
  
      //This takes input from the client and keeps a record,
      //It also sends the input information to the server immediately
      //as it is pressed. It also tags each input with a sequence number.
    
    //don't do anything before connestion with server is ready
    if(this.suspendGame || !this.connectionReady) return;

    let input = {
      mouseX: this.controls.mouseX,
      mouseY: this.controls.mouseY,
      up: this.controls.up,
      down: this.controls.down,
      left: this.controls.left,
      right: this.controls.right,
      lClick: this.controls.lClick,
      rClick: this.controls.rClick
    };
  
    this.input_seq += 1;

      //Store the input state as a snapshot of what happened.
    this.self.inputs.push({
      inputs : input,
      time : this.local_time.fixed(3), 
      seq : this.input_seq
    });

      //Send the packet of information to the server.
      //The input packets are labelled with an 'i' in front.
      //example packet: "i/34,500,001010(up down left right lclick rclick);169.232(local_time);7(seq)""
    var server_packet = 'i/';
      server_packet += input.mouseX; //relative to world not canvas
      server_packet += ',' + input.mouseY;
      server_packet += ',' + (input.up ? 1 : 0);
      server_packet += ',' + (input.down ? 1 : 0);
      server_packet += ',' + (input.left ? 1 : 0);
      server_packet += ',' + (input.right ? 1 : 0);
      server_packet += ',' + (input.lClick ? 1 : 0);
      server_packet += ',' + (input.rClick ? 1 : 0);
      server_packet += ';' + this.local_time.toFixed(3);
      server_packet += ';' + this.input_seq;

    //if(debug) console.log('client handleinput: message: ' + server_packet + ' xView: ' + this.camera.xView + ' yView: ' + this.camera.yView);
    //todo. ?? graphics suddenly jumped, but connection seemed to be there and says this line tries to use no longer usable object. connection interference?
    this.ws.send(  server_packet  );
  
  }; //game_core.client_handle_input
  
  //todo only after basic game is up
  game_core.prototype.client_process_net_prediction_correction = function() {
  /*
      //No updates...
    if(!this.server_updates.length) return;
  
      //The most recent server update
    var latest_server_data = this.server_updates[this.server_updates.length-1];
  
      //Our latest server position
    var my_server_pos = this.players.self.host ? latest_server_data.hp : latest_server_data.cp;
  
      //Update the debug server position block
    this.ghosts.server_pos_self.pos = this.pos(my_server_pos);
  
        //here we handle our local input prediction ,
        //by correcting it with the server and reconciling its differences
  
      var my_last_input_on_server = this.players.self.host ? latest_server_data.his : latest_server_data.cis;
      if(my_last_input_on_server) {
          //The last input sequence index in my local input list
        var lastinputseq_index = -1;
          //Find this input in the list, and store the index
        for(var i = 0; i < this.players.self.inputs.length; ++i) {
          if(this.players.self.inputs[i].seq == my_last_input_on_server) {
            lastinputseq_index = i;
            break;
          }
        }
  
          //Now we can crop the list of any updates we have already processed
        if(lastinputseq_index != -1) {
          //so we have now gotten an acknowledgement from the server that our inputs here have been accepted
          //and that we can predict from this known position instead
  
            //remove the rest of the inputs we have confirmed on the server
          var number_to_clear = Math.abs(lastinputseq_index - (-1));
          this.players.self.inputs.splice(0, number_to_clear);
            //The player is now located at the new server position, authoritive server
          this.players.self.cur_state.pos = this.pos(my_server_pos);
          this.players.self.last_input_seq = lastinputseq_index;
            //Now we reapply all the inputs that we have locally that
            //the server hasn't yet confirmed. This will 'keep' our position the same,
            //but also confirm the server position at the same time.
          this.client_update_physics();
          this.client_update_local_position();
  
        } // if(lastinputseq_index != -1)
      } //if my_last_input_on_server
  */
  }; //game_core.client_process_net_prediction_correction
  
  //todo only after basic game is up
  game_core.prototype.client_process_net_updates = function() {
  /*
      //No updates...
    if(!this.server_updates.length) return;
  
    //First : Find the position in the updates, on the timeline
    //We call this current_time, then we find the past_pos and the target_pos using this,
    //searching throught the server_updates array for current_time in between 2 other times.
    // Then :  other player position = lerp ( past_pos, target_pos, current_time );
  
      //Find the position in the timeline of updates we stored.
    var current_time = this.client_time;
    var count = this.server_updates.length-1;
    var target = null;
    var previous = null;
  
      //We look from the 'oldest' updates, since the newest ones
      //are at the end (list.length-1 for example). This will be expensive
      //only when our time is not found on the timeline, since it will run all
      //samples. Usually this iterates very little before breaking out with a target.
    for(var i = 0; i < count; ++i) {
  
      var point = this.server_updates[i];
      var next_point = this.server_updates[i+1];
  
        //Compare our point in time with the server times we have
      if(current_time > point.t && current_time < next_point.t) {
        target = next_point;
        previous = point;
        break;
      }
    }
  
      //With no target we store the last known
      //server position and move to that instead
    if(!target) {
      target = this.server_updates[0];
      previous = this.server_updates[0];
    }
  
      //Now that we have a target and a previous destination,
      //We can interpolate between then based on 'how far in between' we are.
      //This is simple percentage maths, value/target = [0,1] range of numbers.
      //lerp requires the 0,1 value to lerp to? thats the one.
  
     if(target && previous) {
  
      this.target_time = target.t;
  
      var difference = this.target_time - current_time;
      var max_difference = (target.t - previous.t).fixed(3);
      var time_point = (difference/max_difference).fixed(3);
  
        //Because we use the same target and previous in extreme cases
        //It is possible to get incorrect values due to division by 0 difference
        //and such. This is a safe guard and should probably not be here. lol.
      if( isNaN(time_point) ) time_point = 0;
      if(time_point == -Infinity) time_point = 0;
      if(time_point == Infinity) time_point = 0;
  
        //The most recent server update
      var latest_server_data = this.server_updates[ this.server_updates.length-1 ];
  
        //These are the exact server positions from this tick, but only for the ghost
      var other_server_pos = this.players.self.host ? latest_server_data.cp : latest_server_data.hp;
  
        //The other players positions in this timeline, behind us and in front of us
      var other_target_pos = this.players.self.host ? target.cp : target.hp;
      var other_past_pos = this.players.self.host ? previous.cp : previous.hp;
  
        //update the dest block, this is a simple lerp
        //to the target from the previous point in the server_updates buffer
      this.ghosts.server_pos_other.pos = this.pos(other_server_pos);
      this.ghosts.pos_other.pos = this.v_lerp(other_past_pos, other_target_pos, time_point);
  
      if(this.client_smoothing) {
        this.players.other.pos = this.v_lerp( this.players.other.pos, this.ghosts.pos_other.pos, this._pdt*this.client_smooth);
      } else {
        this.players.other.pos = this.pos(this.ghosts.pos_other.pos);
      }
  
        //Now, if not predicting client movement , we will maintain the local player position
        //using the same method, smoothing the players information from the past.
      if(!this.client_predict && !this.naive_approach) {
  
          //These are the exact server positions from this tick, but only for the ghost
        var my_server_pos = this.players.self.host ? latest_server_data.hp : latest_server_data.cp;
  
          //The other players positions in this timeline, behind us and in front of us
        var my_target_pos = this.players.self.host ? target.hp : target.cp;
        var my_past_pos = this.players.self.host ? previous.hp : previous.cp;
  
          //Snap the ghost to the new server position
        this.ghosts.server_pos_self.pos = this.pos(my_server_pos);
        var local_target = this.v_lerp(my_past_pos, my_target_pos, time_point);
  
          //Smoothly follow the destination position
        if(this.client_smoothing) {
          this.players.self.pos = this.v_lerp( this.players.self.pos, local_target, this._pdt*this.client_smooth);
        } else {
          this.players.self.pos = this.pos( local_target );
        }
      }
      
    } //if target && previous
  */
  }; //game_core.client_process_net_updates
  
  //parse regular server update(websocket message)
  game_core.prototype.client_parseServerUpdate = function(data){
    
    if(debug) console.assert(typeof data === 'string');
    //if(debug) console.log('server update: ' + data);

    //optimize
    let update = {};
    let commands = data.split(':');


    update.t = parseFloat(commands[0]);
    update.last_input_seq = parseInt(commands[1], 10);
    update.players = commands[2].split(';').slice(0, -1);
    update.fires = commands[3].split(';').slice(0, -1);
    update.firesRemoved = commands[4].split(';').slice(0, -1);

    //if(debug) console.log('server update players: ' + update.players);

    update.players = update.players.map(this.client_parseServerPlayerUpdate.bind(this));
    update.fires = update.fires.map(this.client_parseServerFireUpdate.bind(this));
    update.firesRemoved = update.firesRemoved.map(this.client_parseServerFireRemoveUpdate.bind(this));

    
    return update;
  }

  //PLAYER: parse individual player portion of regular server update(as ws message)
  game_core.prototype.client_parseServerPlayerUpdate = function(data){

    let commands = data.split(',');
    let update = {};
    update.x = parseInt(commands[0], 10);
    update.y = parseInt(commands[1], 10);
 

    update.angle = parseFloat(commands[2]); //decimal places fixed by sender
    update.pID = parseInt(commands[3], 10);

    //spriteIndex of player's two weapons for animation
    update.lspriteIndex = parseInt(commands[4], 10);
    update.rspriteIndex = parseInt(commands[5], 10);

    //stats. todo. this should be on a separate slower update loop
    update.health = parseInt(commands[6], 10);
  
    //if(debug) console.log('client ParsePlayerUpdate: pID: ' + update.pID + ' angle: ' + update.angle);

    return update;
  }
  
  //FIRE: parse individual fire portion of regular server update(as ws message)
  game_core.prototype.client_parseServerFireUpdate = function(data){

    //if(debug) console.log('parseServer Fire Update: data: ' + data);
    if(debug) console.assert(this.players);

    let commands = data.split(',');
    let update = {};
    
    update.wType = parseInt(commands[0], 10);//first identify fire type
    //common params
    update.fID = parseInt(commands[1], 10);
    update.dmg = parseInt(commands[2], 10);
    update.x = parseInt(commands[3], 10);
    update.y = parseInt(commands[4], 10);
    update.range = parseInt(commands[5], 10);
    update.angle= parseFloat(commands[6]);

    switch(update.wType){
      case(Game.enums.WType.dagger):
        update.life = parseInt(commands[7], 10);
        update.left = (commands[8] === 'true');
        update.holdRadius = parseInt(commands[9], 10);
        update.pID = parseInt(commands[10], 10);
        update.player = this.players.get(update.pID);
        update.shape = parseInt(commands[11], 10);
        update.hitOnce = (commands[12] === 'true');
        update.hurtOnce = (commands[13] === 'true');
        update.passable = (commands[14] === 'true');
        break;
      case(Game.enums.WType.katana):
        update.life = parseInt(commands[7], 10);
        update.left = (commands[8] === 'true');
        update.holdRadius = parseInt(commands[9], 10);
        update.pID = parseInt(commands[10], 10);
        update.player = this.players.get(update.pID);
        update.shape = parseInt(commands[11], 10);
        update.hitOnce = (commands[12] === 'true');
        update.hurtOnce = (commands[13] === 'true');
        update.passable = (commands[14] === 'true');
        break;
      case(Game.enums.WType.fist):
        update.speed = parseInt(commands[7], 10);
        update.pID = parseInt(commands[8], 10);
        update.player = this.players.get(update.pID);
        update.shape = parseInt(commands[9], 10);
        update.hitOnce = (commands[10] === 'true');
        update.hurtOnce =(commands[11] === 'true');
        update.traveled = parseInt(commands[12], 10);
        break;
    }
    if(debug) console.assert(update.player);
    //if(debug) {console.log('fire update obj: '); console.log(update);}

    return update;
  }
  game_core.prototype.client_parseServerFireRemoveUpdate = function(fID){//optimize. if not getting too complex just make it inline
    //if(debug) console.log('parseServer RemoveFire: fID: ' + fID);

    return parseInt(fID, 10);
  }
  //create a fire based on parsed server update object
  game_core.prototype.client_createFire = function(instance){
    let fire;

    switch(instance.wType){
      case(Game.enums.WType.dagger):
        fire = new Game.Fires.FClose(instance.dmg, instance.x, instance.y, instance.range, instance.angle, instance.life, instance.left, instance.holdRadius, instance.player, instance.wType, instance.shape, instance.hitOnce, instance.hurtOnce, instance.passable);
        break;
      case(Game.enums.WType.katana):
        fire = new Game.Fires.FClose(instance.dmg, instance.x, instance.y, instance.range, instance.angle, instance.life, instance.left, instance.holdRadius, instance.player, instance.wType, instance.shape, instance.hitOnce, instance.hurtOnce, instance.passable);
        break;
      case(Game.enums.WType.fist):
        fire = new Game.Fires.FShoot(instance.dmg, instance.x, instance.y, instance.range, instance.angle, instance.speed, instance.player, instance.wType, instance.shape, instance.traveled, instance.hitOnce, instance.hurtOnce);
        break;
      default:
        console.error('::ERROR:: client_createFire: no matching wType: wtype: ' + instance.wType);
    
    }

    fire.fID = instance.fID;

    //if(debug) {console.log('client createFire: fire: '); console.log(fire);}

    return fire;
  }

  game_core.prototype.client_onserverupdate_received= function(data){

      //if connection is not ready don't do anything
      if(!this.connectionReady) return;

      //if(debug) console.log('client onserverupdate: ' + data);

      let update = this.client_parseServerUpdate(data);

        //what are these times for ?? (probably prediction etc.)
        //Store the server time (this is offset by the latency in the network, by the time we get it)
      this.server_time = update.t;
        //Update our local offset time from the last server update
      this.client_time = this.server_time - (this.net_offset/1000);
  
        //One approach is to set the position directly as the server tells you.
        //This is a common mistake and causes somewhat playable results on a local LAN, for example,
        //but causes terrible lag when any ping/latency is introduced. The player can not deduce any
        //information to interpolate with so it misses positions, and packet loss destroys this approach
        //even more so. See 'the bouncing ball problem' on Wikipedia.
  
      if(this.naive_approach) {

        //update players including self
        this.currPlayersID = []; 
        for(let i = 0, l = update.players.length; i < l; i++){
          let pID = update.players[i].pID;

          //if(debug) {console.log('player update: pID: ' + pID + ' update: '); console.log(update.players[i]);}

          this.currPlayersID.push(pID);//?? self is also pushed, should this be?
          this.players.get(pID).handleServerUpdate(update.players[i]);
        }

        //add new fires
        let t = Date.now();//put it here for now until proper physics and server update on client
        for(let i = 0, l = update.fires.length; i < l; i++){
          let instance = update.fires[i];
          //for now only have bullets
          let fire = this.client_createFire(instance);

          //if(debug) console.log('new fire: fID: ' + fire.fID);

          this.fires.set(fire.fID, fire);//fid as index
        }

        //remove fires with their fid
        for(let i = 0, l = update.firesRemoved.length; i < l; i++){
          let fire = this.fires.get(update.firesRemoved[i]);

          //if(debug) console.log('remove fire: fID: ' + update.firesRemoved[i]);

          if(fire) fire.terminate = true;//check because it might already be removed by client side update
        }

        this.camera.update(this.map.cellSizeg, this.map.gridWg);//update camera coords right after self update. otherwise coors don't synchronize and jitter happens

        //update everything graphics related together here before prediction to prevent jitter. todo. move updates to physics_update(or somewhere else ?? ) once have prediction 
          //update fires
        this.fires.forEach((fire) => {
          //map not involved on client side yet

          //?? check for going out of view too?
          //delete dead objects. -1 is life code for self termination
          if(fire.terminate) {
            //if(debug) {console.log('fire deleted: fire: '); console.log(fire);}
            this.fires.delete(fire.fID);
            //if(debug) console.log(this.fires);
            return;
          }
          fire.update(t);
        });
  
      } else {
        //todo only after basic game is up.
        /*
          //Cache the data from the server,
          //and then play the timeline
          //back to the player with a small delay (net_offset), allowing
          //interpolation between the points.
        this.server_updates.push(data);
  
          //we limit the buffer in seconds worth of updates
          //60fps*buffer seconds = number of samples
        if(this.server_updates.length >= ( 60*this.buffer_size )) {
          this.server_updates.splice(0,1);
        }
  
          //We can see when the last tick we know of happened.
          //If client_time gets behind this due to latency, a snap occurs
          //to the last tick. Unavoidable, and a reallly bad connection here.
          //If that happens it might be best to drop the game after a period of time.
        this.oldest_tick = this.server_updates[0].t;
  
          //Handle the latest positions from the server
          //and make sure to correct our local predictions, making the server have final say.
        this.client_process_net_prediction_correction();
        */
      } //non naive
  
  }; //game_core.client_onserverupdate_received
  
  game_core.prototype.client_update_local_position = function(){
  /* todo. not predicting for now
   if(this.client_predict) {
  
        //Work out the time we have since we updated the state
      var t = (this.local_time - this.players.self.state_time) / this._pdt;
  
        //Then store the states for clarity,
      var old_state = this.players.self.old_state.pos;
      var current_state = this.players.self.cur_state.pos;
  
        //Make sure the visual position matches the states we have stored
      //this.players.self.pos = this.v_add( old_state, this.v_mul_scalar( this.v_sub(current_state,old_state), t )  );
      this.players.self.pos = current_state;
      
        //We handle collision on client if predicting.
      this.map.checkCollides( this.players.self );
  
    }  //if(this.client_predict)
  */
  }; //game_core.prototype.client_update_local_position
  
  game_core.prototype.client_update_physics = function() {

    //?? where to update camera once we have prediction?

  }; //game_core.client_update_physics
  
  game_core.prototype.client_update = function() {

    //todo. scale 
    const upperGround = this.self.upperGround;
    const ctx = this.ctx;
    const xView = this.camera.xView;
    const yView = this.camera.yView;
    const width = this.camera.viewWidth;
    const height = this.camera.viewHeight;
    const scale = this.camera.scale;
    const subGridX = this.camera.subGridX;
    const subGridY = this.camera.subGridY;
    const subGridXMax = this.camera.subGridXMax;
    const subGridYMax = this.camera.subGridYMax;

      //Clear the screen area
    ctx.clearRect(0, 0, width, height);
    
    this.map.drawBackground(ctx, xView, yView, width, height, scale, upperGround, subGridX, subGridY, subGridXMax, subGridYMax);
  
      //Capture inputs from the player
    this.client_handle_input();
    
    //todo only after basic game is up
      //Network player just gets drawn normally, with interpolation from
      //the server updates, smoothing out the positions from the past.
      //Note that if we don't have prediction enabled - this will also
      //update the actual local client position on screen as well.
    if( !this.naive_approach ) {
      //this.client_process_net_updates();
    }

    //draw fires. because server only notifies of relevant fires. no need to use graphic grid here
    this.fires.forEach(fire => {
      fire.draw(ctx, xView, yView, scale);
    })
    //if(debug) console.log('client update: players(other) length: ' + this.currPlayersID.length);
    
    //draw players including self
    for(let i = 0, l = this.currPlayersID.length; i < l; i++){
      this.players.get(this.currPlayersID[i]).draw(ctx, xView, yView, scale);
    }

    //obstacles come last
    this.drawObstacles(ctx, xView, yView, scale, subGridX, subGridY, subGridXMax, subGridYMax);

    //player map, mini map and stats don't care about scale. 
    if(this.showMap) this.drawPlayerMap(ctx, width, height);

    //always draw minimap
    this.drawMiniMap(ctx, width, height);

    //draw stats
    this.drawStats(ctx, width, height);
    
    //todo. not predicting for now
      //When we are doing client side prediction, we smooth out our position
      //across frames using local input states we have stored.
    //this.client_update_local_position(); 
  
      //Work out the fps average debug
    this.client_refresh_fps();
  
  }; //game_core.update_client

  //?? iterating through same gridsg two times to draw zones and obstacles separately. anyway to optimize?
  //only draw ones in graphic grids occupied by the viewport
  game_core.prototype.drawObstacles = function(context, xView, yView, scale, subGridX, subGridY, subGridXMax, subGridYMax){
    
    /**
     * todotodo.
     * groundlevel change
     * destructible obstacle
     */
    /**
     * ??
     * Draw game canvas on itself in response to moving and then draw the new section to optimize?
     * Should obstacles to draw also be dictated by servers? that would cost bandwidth, 
     * but would it increase client performance since on need to iterate graphic grid?
     * Is it a better idea to split each cellg into lists by obj type or just iterate through all and draw right ones? 
     * also since fires and entites to draw are dictated by servers should they just not be in graphic grid on client side?
     * Does index affect performance? how to utilize typed arrays?
     * 
     */
    
    const gList = Game.enums.GList.obstacle;
    const obstacles = this.obstacles;
    const grid = this.self.upperGround ? this.map.gridgUpper : this.map.gridgUnder;
    const drawn = [];

    //iterating occupied logic grid to get relevant obstacles to draw
    for(let i = subGridX; i < subGridXMax; i++){
      for(let j = subGridY; j < subGridYMax; j++){
        //if(debug && grid[i][j][gList].length > 0) console.log(`draw obstacles gridg[i][j] length: ${grid[i][j][gList].length} i: ${i} j: ${j} subgirdX: ${subGridX} subgridy: ${subGridY} subgirdXmax: ${subGridXMax} subgridymax: ${subGridYMax} `);

        //draw upper and under in the same loop
        if(debug && (!grid[i] || !grid[i][j])) console.log(`drawObstacles: grid: i: ${i} j: ${j}`);
        grid[i][j][gList].forEach(obj => {
          if(debug) console.assert(obj.oID !== undefined);
          if(drawn[obj.oID]) return;//if already drawn

          obstacles.get(obj.oID).draw(context, xView, yView, scale);
          drawn[obj.oID] = true;
        });
      }
    }

  }  
  game_core.prototype.drawPlayerMap = function(context, viewWidth, viewHeight){
    //determine size of player map
    let width, x, y;
    if(viewWidth > viewHeight){
      width = viewHeight;
      x = Math.round(viewWidth / 2 - width / 2); 
      y = 0;
    }
    else{
      width = viewWidth;
      x = 0; 
      y = Math.round(viewHeight / 2 - width / 2);
    }

    //if(debug) console.log(`map render uppermap: width: ${this.upperMap.width} height: ${this.upperMap.height}`);
    //draw static background
    context.drawImage(this.upperMap, x, y, width, width);

    const scale = width / this.map.width;
    
    //draw moving markers. 
    //Self
    const x0 = (this.self.x * scale) + x;
    const y0 = (this.self.y * scale) + y;
    this.drawMarker(context, this.self.color, x0, y0);
  }
  //the always present mini map in the corner
  game_core.prototype.drawMiniMap = function(context, viewWidth, viewHeight){
    
    if(!this.upperMap) return;//if playermap is not finished loading

    //todo. accomodate different sizes of canvas, scale
    //determine size and location on screen
    const dWidth = 190;//magic numbers. size of minimap on screen
    const dx = 20;
    const dy = viewHeight - 20 - dWidth;

    //minimap stagedrop
    context.fillStyle = 'black';
    context.fillRect(dx - 3, dy - 3, dWidth + 6, dWidth + 6);
    
    //determine size and location to crop out of player map
    const pMap = this.upperMap;
    const sWidth = Math.round(pMap.width / 6);//magic number. how much of pMap to take.
    const scale = pMap.width / this.map.width;
    const sx = (this.self.x * scale - sWidth / 2);
    const sy = (this.self.y * scale - sWidth / 2);
    context.drawImage(pMap, sx, sy, sWidth, sWidth, dx, dy, dWidth, dWidth);

    //draw self
    const x0 = dx + dWidth / 2;
    const y0 = dy + dWidth / 2;
    this.drawMarker(context, this.self.color, x0, y0);
  }
  game_core.prototype.drawStats = function(ctx, viewWidth, viewHeight){
    
    //if(debug) console.log('drawstats: this.self.pID: ' + this.self.pID + ' health: ' + this.self.health);

    //temporary health display testing
    let x = 50;
    let y = 50;
    let health = this.self.health;
    ctx.font = '36px serif';
    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.fillText(health, x, y);
  }
  //kind of a helper function for drawing on player map. ?? where best to put it
  game_core.prototype.drawMarker = function(context, color, x, y){
    context.fillStyle = color;
    context.strokeStyle = 'black';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, 5, 0, 2 * PI);
    context.fill();
    context.stroke();
    context.closePath();
    context.strokeStyle = 'white';
    context.beginPath();
    context.arc(x, y, 8, 0, 2 * PI);
    context.stroke();
    context.closePath();
  }
  //?? can't we just get time and not sync tick since input have timestamp? does this actually work?
  game_core.prototype.create_timer = function(){
    let handle = setInterval(function(){
      this._dt = new Date().getTime() - this._dte;
      this._dte = new Date().getTime();
      this.local_time += this._dt/1000.0;
    }.bind(this), 4);
    this.intervals.push(handle);
  }
  
  //for physics updates, need precise sync server and client
  game_core.prototype.create_physics_simulation = function() {
    let handle = setInterval(function(){
      //for prediction etc.
      this._pdt = (new Date().getTime() - this._pdte)/1000.0; //now in seconds
      this._pdte = new Date().getTime();
      
      this.update_physics();
    }.bind(this), 15);
    this.intervals.push(handle);
  
  }; //game_core.client_create_physics_simulation
  
  
  game_core.prototype.client_create_ping_timer = function() {
  
      //Set a ping timer to 1 second, to maintain the ping/latency between
      //client and server and calculated roughly how our connection is doing
  
    let handle = setInterval(function(){
  
      this.last_ping_time = new Date().getTime(); //in millisecs
      if(debug) console.assert(this.ws);
      this.ws.send('p/' + this.last_ping_time);
  
    }.bind(this), 1000);
    this.intervals.push(handle);
    
  }; //game_core.client_create_ping_timer
  
  
  game_core.prototype.client_create_configuration = function() {
    this.last_ping_time = 0.001;    //The time we last sent a ping
    //?? net latency is only actually used once at onconnect. not right..
    this.net_latency = 0.001;       //the latency between the client and the server (ping/2)
    //optimize. don't really need it, repeated
    this.net_ping = 0.001;        //The round trip time from here to the server,and back
    this.dt = 0.016;          //The time that the last frame took to run
    
    //debug
    
    //default on to get a simple game up
    this.naive_approach = true;    //Whether or not to use the naive approach
    this.show_server_pos = false;     //Whether or not to show the server position
    this.show_dest_pos = false;     //Whether or not to show the interpolation goal
    this.client_predict = false;     //Whether or not the client is predicting input
    this.input_seq = 0;         //When predicting client inputs, we store the last input as a sequence number
    this.client_smoothing = false;     //Whether or not the client side prediction tries to smooth things out
    this.client_smooth = 25;      //amount of smoothing to apply to client update dest
  
  
  
    this.net_offset = 100;        //100 ms latency between server and client interpolation for other clients
    this.buffer_size = 2;         //The size of the server history to keep for rewinding/interpolating.
    this.target_time = 0.01;      //the time where we want to be in the server timeline
    this.oldest_tick = 0.01;      //the last time tick we have available in the buffer
  
    this.client_time = 0.01;      //Our local 'clock' based on server time - client interpolation(net_offset).
    this.server_time = 0.01;      //The time the server reported it was at, last we heard from it
    
    
    this.fps = 0;             //The current instantaneous fps (1/this.dt)
    this.fps_avg_count = 0;       //The number of samples we have taken for fps_avg
    this.fps_avg = 0;           //The current average fps displayed in the debug UI
    this.fps_avg_acc = 0;         //The accumulation of the last avgcount fps samples
    
  
  };//game_core.client_create_configuration

  //called when WS connection is ready
  game_core.prototype.client_onconnected = function(e) {

    if(debug) console.log(' :: CONNECTED');
    
    let clientConfig = this.clientConfig;
    if(debug) console.assert(clientConfig);

    //send clientconfig to server to add player to game
    this.ws.send('j/' + JSON.stringify(clientConfig));
      
    //if(debug) console.log(' :: Player Config: name: ' + clientConfig.name + ' color: ' + clientConfig.color +' lWeapon: ' + clientConfig.lWeapon + ' rWeapon: ' + clientConfig.rWeapon);

    let playerConfig = this.buildPlayerConfig(clientConfig); //pID is added later when server responds

    //initialize the first player, which is also self
    this.client_addPlayer(playerConfig);
    
  
  }; //client_onconnected
  
  
  game_core.prototype.client_onpong = function(data) {

    //debug. 
    if(debug) console.assert(parseFloat(data) !== NaN);
    this.net_ping = new Date().getTime() - parseFloat( data ); //in millisecs
    this.net_latency = this.net_ping/2;
  
  }; //client_onpong
  
  game_core.prototype.client_onnetmessage = function(messageEvent) {
    //parse messageEvent from server 
    let data = messageEvent.data;
  
    var commands = data.split('/');
    var command = commands[0];
    var subcommand = commands[1];
    var commanddata = commands[2];
  
    switch(command) {
      //two layers necessary ??
      case 's': //server message
  
        switch(subcommand) {
          case 'u' : //Sent each tick of the server simulation. This is our authoritive update
            this.client_onserverupdate_received(commanddata); break;
  
          case 'e' : //end game requested
            this.client_onendgame(commanddata); break;

          case 'p' : //on receiving pong
            this.client_onpong(commanddata); break;

          case 'j' : //new player joined game
            this.client_onPlayerJoin(commanddata); break;

          case 's'://initialization message
            this.client_onSpawn(commanddata); break;

          case 'd'://any player death
            this.client_onDeath(commanddata); break; 

          case 'o'://gameover of any kind
            this.client_onGameOver(commanddata); break;
          
          //?? should player be removed on client side?
          
        } //subcommand
  
      break; //'s'
    } //command
          
  }; //client_onnetmessage

  game_core.prototype.client_parseServerPlayerConfig = function(data){
    let playerConfig = {};
    let update = data.split(';');

    playerConfig.health = parseInt(update[0], 10);
    playerConfig.speed = parseInt(update[1], 10);
    playerConfig.vision = parseInt(update[2], 10);
    playerConfig.pID = parseInt(update[3], 10);
    playerConfig.tID = parseInt(update[4], 10);
    playerConfig.lWeapon = update[5];
    playerConfig.rWeapon = update[6];
    playerConfig.color = update[7];
    playerConfig.name = update[8];

    return playerConfig;
  }

  game_core.prototype.client_parseServerGameOver = function(data){

    let gameOver = {};
    let update = data.split(';');

    gameOver.reason = parseInt(update[0], 10);
    gameOver.id = parseInt(update[1], 10);//winner id if applicable, else undefined

    return gameOver;
  }

  game_core.prototype.client_parseServerPlayerDeath = function(data){


    //if(debug) console.log('server death update: ' + data);
    
    let update = data.split(';')
    let death = {};

    //identify victim and killer
    death.killedID = parseInt(update[0], 10);//pID
    death.killerID = parseInt(update[1], 10);
    death.killedName = this.players.get(death.killedID).name;
    death.killerName = this.players.get(death.killerID).name;

    return death;
  }

  game_core.prototype.client_onPlayerJoin = function(data){
    //optimize. don't need to create new playerconfig object for this.
    let playerConfig = this.client_parseServerPlayerConfig(data);

    this.client_addPlayer(playerConfig);//optimize. is this func unnecessary middleman?
  }
  
  game_core.prototype.client_ondisconnect = function(e) {
    
    if(debug) console.log(' :: DISCONNECTED');

    this.killGame();

    switch(e.type){
      case 'error':
        //if(debug) console.log(" :: Connection Error ");break;
      case 'close':
        //if(debug) console.log(" :: Connection Close ");break;
    }
    this.connectionReady = false;
  
  }; //client_ondisconnect

  //handle gameovers, choose to spectate or quit game.
  game_core.prototype.client_onGameOver = function(data){
    //if(debug) console.log('onGameOver: data: ' + data);

    let update = this.client_parseServerGameOver(data);
    this.suspendGame = true;//still in game and receive updates. just stop sending server inputs. 

    let msg = '';//game over message for client interface 

    //identify type of gameover
    switch(update.reason){
      case Game.enums.GOver.death:
      msg = 'A gruesome death.';
      break;
      case Game.enums.GOver.playerWin:
      if(update.id === this.self.pID) {msg = '~_~';}
      else {
        let winnerName = this.players.get(update.id).name;
        msg = winnerName + ' won, and you did not.';
      }
      break;
      case Game.enums.GOver.teamWin:
      msg = 'Ah.';
      break;
    }

    this.client_gameOverInterface(msg);
  }

  //handle any one player's death
  game_core.prototype.client_onDeath = function(data){//data is player's pID

    let update = this.client_parseServerPlayerDeath(data);

    if(debug) console.log( update.killedName + ' is killed by ' + update.killerName);
    //if(debug) console.log(this.players);

    //?? remove player? technically no need
    //mark the player dead, can also be self. gameover depends on its own server msg
    this.players.get(update.killedID).state = Game.enums.PState.dead;

    //todo. a crude self death display. should still receive server update and let server decides
    if(update.killedID === this.self.pID){
      this.self.health = 0;
    }

  }

  game_core.prototype.client_onSpawn = function(data){

    let update = data.split(';');
    let serverResponse = {
      pID: parseInt(update[0], 10),
      tID: parseInt(update[1], 10),
      spawn: {
        x: parseInt(update[2], 10),
        y: parseInt(update[3], 10)
      }
    }

    this.self.pID = serverResponse.pID;//now self has pID
    this.self.tID = serverResponse.tID;
    this.players.set(this.self.pID, this.self);//now add self to regular players list
    this.connectionReady = true;//connection is only ready when we have the pID

    if(debug) console.assert(this.self.pID !== undefined);
    
    //spawn self
    this.self.spawn(serverResponse.spawn.x, serverResponse.spawn.y);
    
    //camera follow self 
    this.camera.follow(this.self);

        //Start a physics loop, this is separate to the rendering
        //as this happens at a fixed frequency
    this.create_physics_simulation();

    //with ws connection now We start pinging the server to determine latency
    this.client_create_ping_timer();

		//Finally, start the loop
		this.update( new Date().getTime() );
  }

  game_core.prototype.client_connect_to_server = function(url) {
      
      if(debug) console.log(' :: WS server url: ' + url);

        //Store a local reference to our connection to the server
      this.ws = new WebSocket(url);

        //Sent when we are disconnected (network, server down, etc)
      this.ws.onclose = this.client_ondisconnect.bind(this);
        //Handle when we connect to the server, showing state and storing id's.
      this.ws.onopen = this.client_onconnected.bind(this);
        //On error we just show that we are not connected for now. Can print the data.
      this.ws.onerror = this.client_ondisconnect.bind(this);
        //On message from the server, we parse the commands and send it to the handlers
      this.ws.onmessage = this.client_onnetmessage.bind(this);

  
  }; //game_core.client_connect_to_server
  
  //debug
  game_core.prototype.client_refresh_fps = function() {
  
      //We store the fps for 10 frames, by adding it to this accumulator
    this.fps = 1/this.dt;
    this.fps_avg_acc += this.fps;
    this.fps_avg_count++;
  
      //When we reach 10 frames we work out the average fps
    if(this.fps_avg_count >= 10) {
  
      this.fps_avg = this.fps_avg_acc/10;
      this.fps_avg_count = 1;
      this.fps_avg_acc = this.fps;
  
    } //reached 10 frames
  
  }; //game_core.client_refresh_fps
  
  