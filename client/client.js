'use strict';


window.debug = true;

//Global Aliases
window.pixiTextureCache = PIXI.utils.TextureCache;
window.pixiLoader = PIXI.loader;
window.pixiResources = PIXI.loader.resources;
window.pixiSprite = PIXI.Sprite;



//?? closure necessary?
(function(){
	
	//A window global for our game root variable.
let game = {};

let config = document.getElementById('form');
config.addEventListener('submit', handleConfigs);//when play is pressed

//to help screen transformation from home to game
function gameWindow(){
	let game = document.getElementById('space');

	game.classList.add('inGame');

}

//to help screen transformation from game to home
function homeWindow(){
	let game = document.getElementById('space');

	game.classList.remove('inGame', 'gameOver');

}

//called when player press 'play'
function handleConfigs(e){

	e.preventDefault(); //we need to manually send the config to handle ajax respons

	let config = document.querySelector('#config form');
	if(debug) console.assert(config);

	game.clientConfig = {//sent to server only when client is actually in the game
		name: config.elements['name'].value,
		color: config.elements['color'].value,
		lWeapon: config.elements['lWeapon'].value,
		rWeapon: config.elements['rWeapon'].value,
		skill: config.elements['skill'].value,
		viewW: window.innerWidth,//repeating. optimize. or should each client has a fixed view size regardless of actual window size?
		viewH: window.innerHeight
	};

	let gameConfig = {//simple request for gameroom url to sent to server
		mode: 'battleRoyale'//todo. should be selected by clients
	};

	(async () => {
		const rawResponse = await fetch('/', {
		  method: 'POST',
		  headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		  },
		  body: JSON.stringify(gameConfig)
		});
		const content = await rawResponse.json();
		const viewPort = document.getElementById('gameCanvas');
		//if(debug) console.log(`handleconfigs: gameCanvas width: ${viewPort.clientWidth} height: ${viewPort.clientHeight}`);
		game.client_initGame(content, viewPort.clientWidth, viewPort.clientHeight);
		

		gameWindow();//transform window to game mode

		//if(debug)console.log(rawResponse);
		//if(debug) console.log('response received');
		//if(debug) console.log(content);
	})();

	//deselect play button when playing otherwise can be pressed again with space bar etc.
	let playButtons = document.querySelectorAll('.homeButtons');
	for(let i = 0, l = playButtons.length; i < l; i++){
		playButtons[i].blur();
	}
	//if(debug) console.log('Handleconfigs deselecting home buttons: length: ' + playButtons.length);


}//handleConfigs

//?? best way to handle sprite fetching?
function fetchSprites() {

	let spriteNames = ['dagger', 'broadsword'];

	/*todo right now is fetching one by one, fetch by pack?? fetch as one image?
	for(let i = 0, l = spritesNames.length; i<l; i++){
		let imageName = spriteNames[i];

		Game.sprites[Game.enums.WType[imageName]] =  document.createElement('img');

		// construct the URL path to the image file from the product.image property
		let url = 'sprites/' + imageName + '.png';
		// Use fetch to fetch the image, and convert the resulting response to a blob
		// Again, if any errors occur we report them in the console.
		fetch(url).then(function(response) {
		if(response.ok) {
			response.blob().then(function(blob) {
			// Convert the blob to an object URL — this is basically an temporary internal URL
			// that points to an object stored inside the browser
			let objectURL = URL.createObjectURL(blob);
			
			Game.sprites[Game.enums.WType[imageName]].src = objectURL;
			});
		} else {
			console.log('Network request for "' + product.name + '" image failed with response ' + response.status + ': ' + response.statusText);
		}
		});
	}*/	

	//load sprites and store in global object
	sprites = spriteNames.map(spriteName => {
		return {name: spriteName, url: `sprites/${spriteName}.png`};
	});

	pixiLoader.add(sprites).load((loader, resources) => {
		spriteNames.forEach(spriteName => {
			Game.Textures[spriteName] = resources[spriteName].texture;
		});

		if(debug) console.log(`pixiloader finished loading. game textures length: ${Game.Textures.size}`);
	});
	/*
	spriteNames.forEach(spriteName => {
		const path = `sprites/${spriteName}.png`;

		// Use fetch to fetch the image, and convert the resulting response to a blob
		// Again, if any errors occur we report them in the console.
		fetch(path).then(response => {
			if(response.ok) {
				response.blob().then(blob => {
					// Convert the blob to an object URL — this is basically an temporary internal URL
					// that points to an object stored inside the browser
					const objectURL = URL.createObjectURL(blob);
					
					//when we got the image we load it to texture and make a sprite out of it
					pixiLoader.add(spriteName, objectURL, () => {
						Game.sprites[Game.enums.WType[spriteName]] = new pixiSprite(pixiResources[spriteName].texture);
					});
				});
			} else {
				console.log('Network request for "' + product.name + '" image failed with response ' + response.status + ': ' + response.statusText);
			}
		});		
	});*/
	
}

//detect tool changes
function listenToolChange(){
	let form = document.getElementById('form');

	form.elements['lWeapon'].addEventListener('change', updateCombatStatsDisplay);
	form.elements['rWeapon'].addEventListener('change', updateCombatStatsDisplay);
}
//update combat stats display when tool config changes
function updateCombatStatsDisplay(e){
	let form = document.getElementById('form');

	//default values
	let speed = 300; //todo. magic number
	let shield = 0;
	let vision = 1;

	let lWType = Game.enums.WType[form.elements['lWeapon'].value];
	let rWType = Game.enums.WType[form.elements['rWeapon'].value];

	const lWeapon = helpers.getCombatStats(lWType);
    const rWeapon = helpers.getCombatStats(rWType);

    //speed change
    speed -= lWeapon.weight;
	speed -= rWeapon.weight;
	document.querySelector('#combatStats #speed').innerHTML = speed;

    //shield change
    shield += lWeapon.shield;
	shield += rWeapon.shield;
	document.querySelector('#combatStats #shield').innerHTML = shield.toFixed(2);
	
	//if(debug) console.log('updateCombatStatsDisplay: lWeaponType: ' + lWeaponType + ' rWeaponType: ' + rWeaponType + ' speed: ' + speed + ' shield: ' + shield + ' vision: ' + vision );
}

//to be called by gamecore to handle gameOver interface. 'this' is bind to client.js
function gameOverInterface(msg){

	//if(debug) console.log('game over. ' + msg);

	document.getElementById('space').classList.add('gameOver');
	document.querySelector('#gameOver #message').innerHTML = msg;

}

	//When loading, we store references to our drawing canvases, and initiate a game instance.
window.onload = function(){
	
		//Create our game client instance without actual game and player info
	//const start = Date.now();
	game = new game_core(false, undefined, gameOverInterface.bind(this)); //it's not global, a let in the closure

	//if(debug) console.log(`gamecore construct time: ${Date.now() - start}`);

	const gameDiv = document.getElementById('game');

	fetchSprites();//start fetching necessary images
	listenToolChange();//manage dynamic combat stats display
	updateCombatStatsDisplay();//fit combat stats display to options on load(browser might save config thus combat stats might not be default on load)


	if(debug) console.assert(Game !== undefined);

	//game controls
	window.addEventListener("keydown", function (e) {
		switch (e.keyCode) {
			case 65: // A
				game.controls.left = true;
				break;
			case 87: // W
				game.controls.up = true;
				break;
			case 68: // D
				game.controls.right = true;
				break;
			case 83: // S
				game.controls.down = true;
				break;
			case 32: //space
				game.controls.skill = true;
				break;
		}
	}, false);
	window.addEventListener("keyup", function (e) {
		switch (e.keyCode) {
			case 65: // A
				game.controls.left = false;
				break;
			case 87: // W
				game.controls.up = false;
				break;
			case 68: // D
				game.controls.right = false;
				break;
			case 83: // S
				game.controls.down = false;
				break;
			case 77: // M
				game.showMap = !game.showMap;
				break;
			case 86: // V
				game.showMiniMap = !game.showMiniMap;
				break;
			case 32: //space
				game.controls.skill = false;
				break;
			case 27: //Esc
				break;
		}
	}, false);
	gameDiv.addEventListener("mousemove", function (e) {
		game.controls.mouseX = Math.round(e.clientX);
		game.controls.mouseY = Math.round(e.clientY);
	}, false);
	gameDiv.addEventListener("mousedown", function (e) {
		e.preventDefault();
		e.stopPropagation();

		if(e.button === 0)game.controls.lWeapon = true;
		else if(e.button === 2)game.controls.rWeapon = true;
	}, false);
	gameDiv.addEventListener("mouseup", function (e) {
		e.preventDefault();
		e.stopPropagation();
		
		if(e.button === 0)game.controls.lWeapon = false;
		else if(e.button === 2)game.controls.rWeapon = false;	
	}, false);

	//menu buttons
	document.querySelector('#gameOver #backButton').addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();

		game.ws.close();//close connection, which would kill game
		homeWindow();//go to menu screen

		game = new game_core(false, undefined, gameOverInterface.bind(this));//create new game object
	}, false);
	

}; //window.onload


})();

