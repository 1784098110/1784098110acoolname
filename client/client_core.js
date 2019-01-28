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
		var game_core = function(gameInstance, gameOverInterface){

			if(debug) console.log(' {{ :: New Gamecore :: }}');

			//undefined on clientSide and later assigned by initGame
			this.instance = gameInstance;
			
			//include both upper and under ground
			this.players = new Map();//including dead spectates etc.
			this.fires = new Map();   //fire objects(bullets, active melee weapons etc.)
			this.obstacles = new Map();

			this.oidCounter = 0; //ostacles id apply to both server and client

			//A local timer in seconds for precision on server and client
			//?? necessary?
			this.local_time = 0.016; 
				
			//for regular update
			this.dt;
			this.lastframetime;
			this.updateid; //for requestanimationframe tracking
			
			//store intervals to be cleared when unneeded for memory management
			this.intervals = [];
	
			//client only. keep a reference in order to execute killGame
			//?? better way to execute killGame through gamecore?
			this.client_gameOverInterface = gameOverInterface; 

			//necessary for players on clientside because client has all players' stats but only some's actions
			this.currentPlayers = [];
			this.clientConfig; //store temporarily to be sent when ws is connected

			this.self; //special pointer for self. But self is also in regular players array
			
			//graphics related
			this.showMap = false;
			this.showMiniMap = true;
			this.upperMap;//to be created by map
			this.gtoggledObstacles = new Set();//list of obstacles that toggle graphics due to players zones occupation

			//fetch viewport canvas and Adjust its size
			this.canvas = document.getElementById('gameCanvas');
			this.canvas.width = document.body.clientWidth;//delete. 
			this.canvas.height = document.body.clientHeight;
			this.ctx = this.canvas.getContext('2d');

			//camera will be set to follow self upon init
			this.camera = new Game.Camera(this.canvas, document.body.clientWidth, document.body.clientHeight);

			//to be fetched periodically by input handler and sent to server
			this.controls = {
				mouseX: 0, //relative to canvas not world
				mouseY: 0,
				up: false,
				down: false,
				left: false,
				right: false,
				lWeapon: false,
				rWeapon: false,
				skill: false
			};

			this.ws;
			//for making sure no message is sent to server before connection is ready
			this.connectionReady = false;
			this.suspendGame = false;//when player died but still in game room. optimize. necessary?

				 //A list of recent server updates we interpolate across
				 //This is the buffer that is the driving factor for our networking
			this.server_updates = [];

		
	
		}; //game_core.constructor
	
	/*
		Helper functions for the game code
	*/
		// (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
	Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };


	
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
    this.map.camera = this.camera;//testing
    this.camera.setMapInfo(this.map.cellSizeg, this.map.gridWg);
		
		this.generateMap(this.instance.mapSeed);
		//if(debug) console.log(`map generate time: ${Date.now() - start0}`);
		this.upperMap = this.map.render(this.obstacles); //generate background graphics
		
		//if(debug) console.log(`initGame changedObjs length: ${serverResponse.objects.length}`)
		//if(debug) console.log(serverResponse.objects);
		//update the changed obstacles
		serverResponse.objects.forEach(changedObj => {
			const obj = this.map.objects.get(changedObj.jID);

			//if(debug) console.log(`initGame changedObj: jID: ${changedObj.jID} health: ${changedObj.health}`);
			//if(debug) console.log(`initGame obj: jID: ${obj.jID} oID: ${obj.oID}`);
			if(debug) console.assert(obj && obj.oID !== undefined && obj.health !== undefined)

			obj.health = changedObj.health;
			//obj.updateStats(); right now update stats only update health so no need to call on client
			//if it's part of obstacle update obstacle
			if(obj.oID !== undefined){
				const obstacle = this.obstacles.get(obj.oID);
				if(!obstacle) return;//obstacle might already be removed
				if(obstacle.update(obj)){//obstacle update return true if obstacle also dies
					this.removeObstacle(obstacle);
					//if(debug) console.log(`Obstacle ${obj.oID} died`);
				}
				else if(obj.health <= 0){//if part's death does not cause obstacle death
					obstacle.parts.delete(obj.opType);
					this.map.removeObject(obj);
				}
			}
			else if(obj.health <= 0){//if not part of obstacle but dead
				this.map.removeObject(obj);
			}
			
		});
		
		//init other players
		for(let i = 0, l = serverResponse.players.length; i < l; i++){
			if(debug && serverResponse.players[i].pID === undefined){ console.log(`init: other player pId undefined: playerconfig: `); console.log(serverResponse.players[i]);}
			this.client_addPlayer(serverResponse.players[i]);
		}
	}

	game_core.prototype.createOID = function(){
		//becase obstacles are generated on server and client in the same sequence, return the same id
		return this.oidCounter++;
	}

	game_core.prototype.compressPlayerConfig = function(playerConfig){
		let msg = 's/j/'; //player join message header
		//optimize format
		msg += playerConfig.health + ';';
		msg += playerConfig.speed + ';';
		msg += playerConfig.vision + ';';
		msg += playerConfig.pID + ';';
		msg += playerConfig.tID + ';';
		msg += playerConfig.lWeapon + ';';
		msg += playerConfig.rWeapon + ';';
		msg += playerConfig.skill + ';';
		msg += playerConfig.color + ';';
		msg += playerConfig.name;

		return msg;
	}


		//create playerconfig out of json sent from client
	game_core.prototype.buildPlayerConfig = function(clientConfig){

		let playerConfig = {

			pID: undefined, //is undefined if this is client core
			tID: pID, //todo. no team play for now
			health: 100, //todo. these stats should change depending on clientConfig(carrying weight, buffs)
			speed: 300,
			vision: 1,
			lWeapon: clientConfig.lWeapon, //todo. make sure chosen weapon is not unavailable
			rWeapon: clientConfig.rWeapon,
			skill: clientConfig.skill,
			color: clientConfig.color,
			name: clientConfig.name || 'A Poor Boy',
			viewW: clientConfig.viewW,
			viewH: clientConfig.viewH

		};

		return playerConfig;

	}

	game_core.prototype.client_addPlayer = function(playerConfig){
		//create new player based on config from client
		const player = new Game.Player(playerConfig.health, playerConfig.speed, playerConfig.vision, playerConfig.pID, playerConfig.tID, Game.enums.WType[playerConfig.lWeapon], Game.enums.WType[playerConfig.rWeapon], Game.enums.WType[playerConfig.skill], playerConfig.color, playerConfig.name, playerConfig.viewW, playerConfig.viewH, this);
		player.state = Game.enums.PState.active;
		//if(debug && player.pID === undefined) {console.log(`add undefined pID: playerconfig: `); console.log(playerConfig);}

    //add graphic
    this.camera.createSpritePlayer(player);

		//self is also in regular players list, but before spawn message self has no pid
		if(this.self === undefined && player.pID === undefined) {
			this.self = player;
			//if(debug) console.log(`addplayer: add self: pID: ${player.pID}`);
		}else{
			this.players.set(player.pID, player);
			if(debug) console.log(' :: Player Join: pID: ' + player.pID);
		}
	}
		//Main update loop
	game_core.prototype.update = function(t) {//optimize. no need for update when seperate client/server

		//if(debug) console.log('core update');
		
			//Work out the delta time
			//optimize keep each object's shape the same for v8 
			//so don't declare outside constructor like this
			//change this.dt to let dt?
		
		this.dt = (this.lastframetime) ? ( (t - this.lastframetime)/1000.0).fixed() : 0.016;
	
			//Store the last frame time
		this.lastframetime = t;
	
			//Update the game specifics.
		this.client_update();
	
			//schedule the next update
		this.updateid = window.requestAnimationFrame( this.update.bind(this));
	
	}; //game_core.update
	

	game_core.prototype.update_physics = function() {//todo. delete. optimize. not used for now
	
			this.client_update_physics();
		
	
	}; //game_core.prototype.update_physics

	/**
	 * Concerning landscape
	 * 
	 * which happens in same sequence on server and client
	 */

	//generate map based on a seed. create all the obstacles etc. but not AI. 
	game_core.prototype.generateMap = function (seed){

		const generator = new MersenneTwister(seed);//pseudorandom number
		const width = this.map.width;
		const height = this.map.height;
		if(debug) console.assert(width && height);

		//terrian goes first and does not check for collision
		this.addTerrian(new Game.Terrian(0, 0, width, height, Game.enums.TType.river, generator, true));

		//complexes, get big ones first
		//argument: count, minSize, maxSize, xMin, xMax, yMin, yMax, cType 
		let complexTemplatesUpper = [//upper ground
			[1, 200, width - 200, 200, height - 200, Game.enums.CType.bushFence]
		];
		complexTemplatesUpper.forEach((template) => {
			let count = template[0];
			template.splice(0, 1);//take out count when passing in to obstacle constructor
			for(let i = 0; i < count; i ++){
				this.addComplex(undefined, ...template, true, generator, 0);//find a place for it on map and then create
			} 
		});

		//list of obstacles to generate and how many to generate. order in list determine drawing order
		//argument: count, minSize, maxSize, xMin, xMax, yMin, yMax, oType 
		let templatesUpper = [//upper ground
			[0, 80, 80, 440, 440, 360, 360, Game.enums.OType.entrance],//testing. specified location for convenience
			[10, 60, 120, 200, width - 200, 200, height - 200, Game.enums.OType.rock],
			[10, 60, 150, 200, width - 200, 200, height - 200, Game.enums.OType.box],
			[10, 30, 80, 100, width - 100, 100, height - 100, Game.enums.OType.bush],
			[0, 30, 80, 100, width - 100, 100, height - 100, Game.enums.OType.entrance],
			[0, 50, 200, 100, width - 100, 100, height - 100, Game.enums.OType.house],
			[20, 30, 80, 100, width - 100, 100, height - 100, Game.enums.OType.tree],
		];

		let tooManyCollideCounterUpper = 0;
		//let tooManyCollideCounterUnder = 0;
		templatesUpper.forEach((template) => {
			let count = template[0];
			template.splice(0, 1);//take out count when passing in to obstacle constructor
			for(let i = 0; i < count; i ++){
				tooManyCollideCounterUpper += this.addObstacle(undefined, ...template, true, generator, 0);//find a place for it on map then create obstacle
			} 
		});

		if(debug) console.log(`generateMap: instances of too many failed fittings: ${tooManyCollideCounterUpper} obstacles count: ${this.obstacles.size}`);
	}
	//add one complex(specific arrangements of obstacles) based on passed in template and pseudorandom num generator, also make sure no collides
	game_core.prototype.addComplex = function(angle, xMin, xMax, yMin, yMax, cType, upperGround, generator, count){

		//count how many times have tried to fit one obstacle. 
		if(count === undefined) count = 0;
		let collide = false;

		//generate new coor within bound
		const x = Math.round(generator.random() * (xMax - xMin)) + xMin;
		const y = Math.round(generator.random() * (yMax - yMin)) + yMin;

		//only get new angle on first attempt
		if(angle === undefined){
			//decide on angle then flip width and height if necessary
			angle = Math.floor(generator.random() * 4) * (PI / 2);
		}

		//use a rectangle or circle to estimate space allocation
		//decide estimate size based on Ctype. 
		let placeHolder, radius, width, height;
		switch(cType){
			case(Game.enums.CType.bushFence):
			width = 200;
			height = 200;
			break;

			default:
			if(debug) console.log(` ::ERROR:: addcomplex no matching cType: ${cType}`);
		}
		
		if(debug) console.assert(angle !== undefined);

		//plug in placeholder to map to see collision
		if(radius !== undefined) placeHolder = new Game.Circle(radius, x, y, angle, false, undefined);
		else if(width !== undefined) placeHolder = new Game.Rectangle(width, height, x, y, false, undefined);
		placeHolder.upperGround = upperGround;
		placeHolder.gList = Game.enums.GList.obstacle;
		this.map.addObject(placeHolder);
		if(this.map.checkCollides(placeHolder) || this.map.checkZones(placeHolder)) collide = true;
		this.map.removeObject(placeHolder);

		if(collide){//start over if doesn't fit
			if(++count > 5){//magic number
				//if(debug) console.log('addcomplex: too many failed fittings');
				return 1;//abandon complex after too many failed fittings
			} 
			return this.addComplex(angle, xMin, xMax, yMin, yMax, cType, upperGround, generator, count);
		}

		//else if fitted
		const complex = new Game.Complex(x, y, angle, cType, upperGround, this.createOID.bind(this));

		//add all obstacles, parts and zones ??. parts and obstacles repetitive? 
		complex.zones.forEach(zone => {
			this.map.addZone(zone);
		});
		complex.parts.forEach((part) => {
			this.map.addObject(part);
		});
		complex.obstacles.forEach(obj => {
			//add all parts and zones and add to list
			obj.parts.forEach((part) => {
				this.map.addObject(part);
			});
			obj.zones.forEach(zone => {
				this.map.addZone(zone);
			});
			this.obstacles.set(obj.oID, obj);
		});

		//if(debug && obj.oType === Game.enums.OType.bush) console.log(`addobstacle: oType: ${obj.oType} zones length: ${obj.zones.length}`);
		//if(debug) console.log(`addobstacle: oid: ${obj.oID} cellsg length: ${cellsgCount} x: ${obj.x} y: ${obj.y}`);
		
		return 0;
	}

  game_core.prototype.addTerrian = function(terrian){
    //todo. Some terrians might be incompatible, might need collide check after all
    terrian.zones.forEach(zone => {
      this.map.addZone(zone);
    });
    terrian.generator = undefined;
  }

  //todo. systematize functions. add functions do not create
	//add one obstacle object based on passed in template and pseudorandom num generator, also make sure no collides
	game_core.prototype.addObstacle = function(angle, minSize, maxSize, xMin, xMax, yMin, yMax, oType, upperGround, generator, count){

		//count how many times have tried to fit one obstacle. 
		if(count === undefined) count = 0;

		//generate new coor within bound
		const x = Math.round(generator.random() * (xMax - xMin)) + xMin;
		const y = Math.round(generator.random() * (yMax - yMin)) + yMin;

		//only get new angle on first attempt
		if(angle === undefined){
			//decide on angle then flip width and height if necessary
			angle = Math.floor(generator.random() * 4) * (PI / 2);
		}

		const circlePlaceHolder = [Game.enums.OType.tree, Game.enums.OType.rock, Game.enums.OType.bush];
		const rectanglePlaceHolder = [Game.enums.OType.house, Game.enums.OType.entrance, Game.enums.OType.box];

		//use a rectangle or circle to estimate space allocation
		let placeHolder;
		if(circlePlaceHolder.includes(oType)){
			const radius = Math.round(generator.random() * (maxSize - minSize)) + minSize;
			placeHolder = new Game.Circle(radius, x, y, angle, false, undefined);
		}
		else if(rectanglePlaceHolder.includes(oType)){
			const width = Math.round(generator.random() * (maxSize - minSize)) + minSize;
			const height = Math.round(generator.random() * (maxSize - minSize)) + minSize;
			placeHolder = new Game.Rectangle(width, height, x, y, false, undefined);
		}
		else if(debug) console.log(` ::ERROR:: addobstacle no matching oType: ${oType}`);
	
		//plug in map to see if no collide
		let collide = false;
		placeHolder.upperGround = upperGround;
		placeHolder.gList = Game.enums.GList.obstacle;
		this.map.addObject(placeHolder);
		if(this.map.checkCollides(placeHolder) || this.map.checkZones(placeHolder)) collide = true;
		this.map.removeObject(placeHolder);

		if(collide){//start over if doesn't fit
			if(++count > 5){//magic number
				//if(debug) console.log('addobstacle: too many failed fittings');
				return 1;//abandon after too many failed fittings
			} 
			return this.addObstacle(angle, minSize, maxSize, xMin, xMax, yMin, yMax, oType, upperGround, generator, count);
		}

		//else if fitted
		const oID = this.createOID();
		const obj = new Game.Obstacle(placeHolder.radius, placeHolder.width, placeHolder.height, x, y, angle, oID, oType, upperGround);
		
    //add sprite
    obj.sprite = this.createSpriteObstacle(obj);

		//add all parts and zones and add to list
		obj.parts.forEach((part) => {
			//if(debug) console.log('map addobstacle: part upperGround: ' + part.upperGround);
			this.map.addObject(part);
		});
		obj.zones.forEach(zone => {
			this.map.addZone(zone);
		});
		this.obstacles.set(oID, obj);

		//if(debug && obj.oType === Game.enums.OType.bush) console.log(`addobstacle: oType: ${obj.oType} zones length: ${obj.zones.length}`);
		//if(debug) console.log(`addobstacle: oid: ${obj.oID} cellsg length: ${cellsgCount} x: ${obj.x} y: ${obj.y}`);
		
		return 0;
	}
	game_core.prototype.removeObstacle = function(obj){
		
		//remove all parts and zones
		obj.parts.forEach(part => {
			this.map.removeObject(part);
		});

		obj.zones.forEach(zone => {
			this.map.removeZone(zone);
		});

		//remove obstacle from list
		this.obstacles.delete(obj.oID);
	}

	/*
	
	 Client side functions
	
		These functions below are specific to the client side only,
		and usually start with client_* to make things clearer.
	
	*/
	
	//called during client update
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
			lWeapon: this.controls.lWeapon,
			rWeapon: this.controls.rWeapon,
			skill: this.controls.skill
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
			//example packet: "i/34,500,001010(up down left right lWeapon rWeapon);169.232(local_time);7(seq)""
		var server_packet = 'i/';
			server_packet += input.mouseX; //relative to world not canvas
			server_packet += ',' + input.mouseY;
			server_packet += ',' + (input.up ? 1 : 0);
			server_packet += ',' + (input.down ? 1 : 0);
			server_packet += ',' + (input.left ? 1 : 0);
			server_packet += ',' + (input.right ? 1 : 0);
			server_packet += ',' + (input.lWeapon ? 1 : 0);
			server_packet += ',' + (input.rWeapon ? 1 : 0);
			server_packet += ',' + (input.skill ? 1 : 0);
			server_packet += ';' + this.local_time.toFixed(3);
			server_packet += ';' + this.input_seq;

		//if(debug) console.log('client handleinput: message: ' + server_packet + ' xView: ' + this.camera.xView + ' yView: ' + this.camera.yView);
		//todo. ?? graphics suddenly jumped, but connection seemed to be there and says this line tries to use no longer usable object. connection interference?
		this.ws.send(  server_packet  );
	
	}; //game_core.client_handle_input

	//client side zone processing to determine graphics
	game_core.prototype.client_handleZones = function(){

		this.gtoggledObstacles.clear();//refresh obstacles to toggle graphics

		this.currentPlayers.forEach((player) => {
			//called directly after server update. should all be active players
			//if(debug && !(player.state === Game.enums.PState.active)) console.log(`client_handlezones: player state: ${player.state} pId: ${player.pID}`);
			
			this.map.handleZones(player);

			//change obstacles' graphics based on self zones
			if(player.pID !== this.self.pID) return;
			player.zones.forEach((zID, zType) => {
				//certain types of zones when occupied by self change graphics
				if(zType === Game.enums.ZType.hiding){
					if(debug) console.assert(this.map.zones.get(zID).oID !== undefined);

					//optimize. ?? neater way to handle toggled graphics of obstacles?
					this.gtoggledObstacles.add(this.map.zones.get(zID).oID);
				}
			});

		});
	}
	
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
		update.removedFires = commands[4].split(';').slice(0, -1);
		update.updatedObjects = commands[5].split(';').slice(0, -1);

		//if(debug) console.log('server update players: ' + update.players);

		update.players = update.players.map(this.client_parseServerPlayerUpdate.bind(this));
		update.fires = update.fires.map(this.client_parseServerFireUpdate.bind(this));
		update.removedFires = update.removedFires.map(this.client_parseServerFireRemoveUpdate.bind(this));
		update.updatedObjects = update.updatedObjects.map(this.client_parseServerObjectUpdate.bind(this));

		return update;
	}

	//PLAYER: parse individual player portion of regular server update(as ws message)
	game_core.prototype.client_parseServerPlayerUpdate = function(data){
		
		let parts = data.split('+');

		let commands = parts[0].split(',');
		let update = {};
		update.x = parseInt(commands[0], 10);
		update.y = parseInt(commands[1], 10);
 

		update.angle = parseFloat(commands[2]); //decimal places fixed by sender
		update.pID = parseInt(commands[3], 10);

		//spriteIndex of player's two weapons for animation
		update.lWeaponSpriteIndex = parseInt(commands[4], 10);
		update.rWeaponSpriteIndex = parseInt(commands[5], 10);
		update.skillSpriteIndex = parseInt(commands[6], 10);
		//stats. todo. this should be on a separate slower update loop
		update.health = parseInt(commands[7], 10);

		//added tokens 
		update.addedTokens = [];
		const addedTokens = parts[1].split(',');
		for(let i = 0, l = addedTokens.length - 1; i < l; i++){
			update.addedTokens.push(parseInt(addedTokens[i], 10));
		}

		//removed tokens 
		update.removedTokens = [];
		const removedTokens = parts[2].split(',');
		for(let i = 0, l = removedTokens.length - 1; i < l; i++){
			update.removedTokens.push(parseInt(removedTokens[i], 10));
		}

		//if(debug) console.log('client ParsePlayerUpdate: pID: ' + update.pID + ' angle: ' + update.angle);
		if(debug && addedTokens.length > 1) console.log(data);

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
		update.x = parseInt(commands[2], 10);
		update.y = parseInt(commands[3], 10);
		update.angle= parseFloat(commands[4]);
		update.player = this.players.get(parseInt(commands[5], 10));
		update.mx = parseInt(commands[6], 10);
		update.my = parseInt(commands[7], 10);
		update.traveled = parseInt(commands[8], 10);
		update.holdRadius = parseInt(commands[9], 10);

		if(debug) console.assert(update.player);
		//if(debug) {console.log('fire update obj: '); console.log(update);}

		return update;
	}
	game_core.prototype.client_parseServerFireRemoveUpdate = function(fID){//optimize. if not getting too complex just make it inline
		//if(debug) console.log('parseServer RemoveFire: fID: ' + fID);

		return parseInt(fID, 10);
	}
	//optimize. simple methods can be eliminated
	game_core.prototype.client_parseServerObjectUpdate = function(data){//optimize. if not getting too complex just make it inline
		//if(debug) console.log('parseServer RemoveFire: fID: ' + fID);

		let commands = data.split(',');
		let update = {
			jID: parseInt(commands[0], 10),
			health: parseInt(commands[1], 10)
		};

		return update;
	}
	//create a fire based on parsed server update object
	game_core.prototype.client_addFire = function(instance){
		let fire;

		fire = new Game.Fire(instance.x, instance.y, instance.angle, instance.player, instance.wType, instance.mx, instance.my, instance.traveled, instance.holdRadius);

		fire.fID = instance.fID;

		//if(debug) console.log(instance);
		//if(debug) {console.log('client createFire: fire: '); console.log(fire);}

		this.fires.set(fire.fID, fire);
	}

	game_core.prototype.client_onserverupdate_received = function(data){
			//update everything graphics related together here before prediction to prevent jitter. todo. move updates to physics_update(or somewhere else ?? ) once have prediction 
				
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

			//update objects
			for(let i = 0, l = update.updatedObjects.length; i < l; i++){
				const instance = update.updatedObjects[i];
				const obj = this.map.objects.get(instance.jID);
				if(!obj) return;//object might not exist anymore

				obj.health = instance.health;
				//obj.updateStats(); right now update stats only update health so no need to call on client
				//if(debug) console.log(`server obj update: health: ${obj.health}`);

				//if it's part of obstacle update obstacle
				if(obj.oID !== undefined){
					const obstacle = this.obstacles.get(obj.oID);
					if(!obstacle) continue;//obstacle might already be removed
					if(obstacle.update(obj)){//obstacle update return true if obstacle also dies
						this.removeObstacle(obstacle);
						//if(debug) console.log(`server object update: remove obstacle: oID: ${obj.oID}`);
					}
					else if(obj.health <= 0) {
						obstacle.parts.delete(obj.opType);
						this.map.removeObject(obj);
					}
				}
				else if(obj.health <= 0){//if not part of obstacle but dead
					//if(debug) console.log(`server object update: obj dead but not part of obstacle: jID: ${obj.jID}`);
					this.map.removeObject(obj);
				}    
			}

			//update players including self
			this.currentPlayers = []; 
			for(let i = 0, l = update.players.length; i < l; i++){
				const player = this.players.get(update.players[i].pID);

				//if(debug) {console.log('player update: pID: ' + pID + ' update: '); console.log(update.players[i]);}
				if(debug && !player) console.log(` ::ERROR:: server update received: player is undefined: pID: ${update.players[i].pID}`);
				this.currentPlayers.push(player);
				player.handleServerUpdate(update.players[i]);
			}

			//update graphic changes due to zones here
			this.client_handleZones();

			//add new fires
			let t = Date.now();//put it here for now until proper physics and server update on client
			for(let i = 0, l = update.fires.length; i < l; i++){
				let instance = update.fires[i];
				//for now only have bullets
				this.client_addFire(instance);

				//if(debug) console.log('new fire: fID: ' + fire.fID);
			}

			//remove fires with their fid
			for(let i = 0, l = update.removedFires.length; i < l; i++){
				let fire = this.fires.get(update.removedFires[i]);

				//if(debug) console.log('remove fire: fID: ' + update.firesRemoved[i]);

				if(fire) fire.terminate = true;//check because it might already be removed by client side update
			}
			
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

			this.camera.update();//update camera coords right after self update. otherwise coors don't synchronize and jitter happens

	
	
	}; //game_core.client_onserverupdate_received
	
	game_core.prototype.client_update = function() {

		//todo. scale?
		const upperGround = this.self.upperGround;
		const ctx = this.ctx;
		const xView = this.camera.xView;
		const yView = this.camera.yView;
		const width = this.camera.width;
		const height = this.camera.height;
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
		//if(debug) console.log('client update: players(other) length: ' + this.currentPlayers.length);
		
		//draw players including self
		for(let i = 0, l = this.currentPlayers.length; i < l; i++){
			const player = this.currentPlayers[i];

			player.draw(ctx, xView, yView, scale);
			
		}

		//obstacles come last
		this.drawObstacles(ctx, xView, yView, scale, subGridX, subGridY, subGridXMax, subGridYMax);

		//always draw minimap
		if(this.showMiniMap) this.drawMiniMap(ctx, width, height);

		//player map, mini map and stats don't care about scale. 
		if(this.showMap) this.drawPlayerMap(ctx, width, height);

		//draw stats
		this.drawStats(ctx, width, height);
		
		//todo. not predicting for nfow
			//When we are doing client side prediction, we smooth out our position
			//across frames using local input states we have stored.
		//this.client_update_local_position(); 
	
	}//game_core.update_client
	//?? iterating through same gridsg two times to draw zones and obstacles separately. anyway to optimize?
	//only draw ones in graphic grids occupied by the viewport
	game_core.prototype.drawObstacles = function(context, xView, yView, scale, subGridX, subGridY, subGridXMax, subGridYMax){
		
		/**
		 * todotodo.
		 * 
		 * incorporate sprite creation to adding stuff
		 */
		/**
		 * ??
		 * Draw trunk and crown on same level still too unnatural? draw obstacle parts separatedly is only way to solve
		 * Instead of skill and weapons' spriteindex, just pass all the sprite indexes about player? (to cover special effect etc)
		 *  or add special graphic ids about player ITSELF in addition to tool's indexes.
		 * Player randomly flashed to close to upper edge after destroying a box ?! or did i hallucinate
		 * Best way to identify obstacles for different graphics?
		 * Cleaner way to mark this for visibility identification? 
		 *  if two hidings overlap(artificial smoke etc) then how does this work? 
		 *  each ztype only get one zID slot;
		 * Why do fires rate(bullets) tend to synchronize over time
		 * Should obstacles to draw also be dictated by servers? that would cost bandwidth, 
		 *  but would it increase client performance since no need to iterate graphic grid?
		 * Since fires and entites to draw are dictated by servers should they just not be in graphic grid on client side?
		 * Does big index affect performance? how to utilize typed arrays?
		 * Rectangles can overlap with rocks. due to rotation? but in real game won't have rotation right
		 */
		/*
		const obstacles = this.obstacles;
		const grid = this.self.upperGround ? this.map.gridgUpper : this.map.gridgUnder;
		const rID = Game.rIDCounter++;

		//iterating occupied graphic grid to get relevant obstacles to draw
		for(let g = Game.enums.GList.obstacle; g <= Game.enums.GList.treeCrown; g++){
			for(let i = subGridX; i < subGridXMax; i++){
				for(let j = subGridY; j < subGridYMax; j++){

					if(debug && (!grid[i] || !grid[i][j])) console.log(`drawObstacles broke: grid: i: ${i} j: ${j}`);
					grid[i][j][g].forEach(obj => {
						if(debug) console.assert(obj.oID !== undefined);
						if(obj.rID === rID) return;//if already drawn

						//some obstacles have different graphics under certain situations
						let toggle = false;//optimize. don't need to store it
						if(this.gtoggledObstacles.has(obj.oID)) toggle = true;

						obstacles.get(obj.oID).draw(context, xView, yView, scale, toggle);
						obj.rID = rID;
					});
				}
			}
		}*/

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
		playerConfig.skill = update[7];
		playerConfig.color = update[8];
		playerConfig.name = update[9];

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

		if(debug && typeof this.client_gameOverInterface !== 'function') console.log(`gameOverInterface is not a function: type: ${typeof this.client_gameOverInterface}`);
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

		this.self.pID = serverResponse.pID;//now self has pID, add self to regular players list
		this.self.tID = serverResponse.tID;
		this.players.set(this.self.pID, this.self);
		this.connectionReady = true;//connection is only ready when we have the pID

		if(debug) console.assert(this.self.pID !== undefined);
		
		//spawn self
		this.self.spawn(serverResponse.spawn.x, serverResponse.spawn.y);
		
		//camera follow self 
		this.camera.follow(this.self);

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
