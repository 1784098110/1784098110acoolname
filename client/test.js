
const Game = {Sprites:{}};
const canvas = document.getElementById('gameCanvas');

//Create a Pixi Application
let app = new PIXI.Application({ 
		view: canvas,                    
		antialias: true, 
		transparent: false, 
		resolution: 1
	}
);
app.renderer.autoResize = true;
app.renderer.resize(window.innerWidth, window.innerHeight);
app.renderer.backgroundColor = 0x000000;
console.log(`app view size: ${app.view.width} ${app.view.height}`);

//load an image and run the `setup` function when it's done
PIXI.loader
	.add('cat', "sprites/broadsword.png")
	.add('dog', "sprites/dagger.png")
	.load(setup);

//This `setup` function will run when the image has loaded
function setup(loader, resources) {

	console.assert(loader === PIXI.loader);
	//store cat texture reference into global 
	Game.cat = PIXI.loader.resources["cat"].texture;

	const texture = new PIXI.Texture(Game.cat, new PIXI.Rectangle(0, 0, 330, 100));
	const texture2= new PIXI.Texture(texture, new PIXI.Rectangle(0, 0, 110, 100));

	const cat = new PIXI.Sprite(PIXI.loader.resources["cat"].texture);
	const dog = new PIXI.Sprite(PIXI.loader.resources["dog"].texture);
	const cat1 = new PIXI.Sprite(texture);
	const cat2 = new PIXI.Sprite(texture2);

	const rec = new PIXI.Graphics();
	rec.beginFill(0xFF0000);
	rec.lineStyle(5, 0x66ccFF, 0.5);
	rec.drawRect(0, 0, 100, 50);
	rec.endFill();

	const container = new PIXI.Container();
	container.addChild(rec, cat, cat1, cat2);
	
	rec.position.set(300, 300);
	cat.position.set(300, 300);
	cat1.position.set(100, 100);
	cat2.position.set(150, 150);

	//app.stage.addChild(container);
	container.position.set(app.stage.width / 2, app.stage.height / 2);
	container.scale.set(0.5, 0.5);
	container.pivot.set(container.width / 2, container.height / 2);
	container.rotation = Math.PI / 2;


	const container1 = new PIXI.Container();
	const body = new PIXI.Graphics();
	body.beginFill(0x66CCFF);
	body.drawCircle(0, 0, 25);
	body.endFill();
	const lWeapon = new PIXI.Sprite.from('sprites/longstick.png');
	const rWeapon = new PIXI.Sprite.from('sprites/medstick.png');

	container1.addChild(lWeapon, rWeapon, body);
	lWeapon.anchor.set(0.5, 0);
	rWeapon.anchor.set(0.5, 0);
	lWeapon.scale.set(0.2);
	rWeapon.scale.set(0.2);
	lWeapon.position.set(20, 0);
	rWeapon.position.set(-20, 0);

	app.stage.addChild(container1);
	container1.pivot.set(body.x, body.y);
	//container1.rotation = Math.PI / 3;
	container1.position.set(500, 200);

	Game.Sprites.rec = rec;
	Game.Sprites.cat = cat;
	Game.Sprites.cat1 = cat1;
	Game.Sprites.cat2 = cat2;
}

//on window resize
window.addEventListener('resize', e => {
		console.log(`resize: appview width: ${app.renderer.view.width} clientwidth: ${app.renderer.view.clientWidth} window innerwidth: ${window.innerWidth}`);
		app.renderer.resize(window.innerWidth, window.innerHeight);
		console.assert(app.renderer.view.width === app.view.width);
}, false);

//conclusion: cannot access loaded texture from loader resources array once reset. but texture is there, it's in texturecache, and if its address is stored in variable before loader reset it can be normally accessed; loader reset only clear the reference addresses stored in resources. texturecache has everything.
window.addEventListener("keyup", function (e) {
		switch (e.keyCode) {
				case 65: // A
						{
						const cat = Game.Sprites.rec;
						
						//cat.scale.set(0.3, 0.3);
						cat.rotation += Math.PI / 2;
						}
						break;

				case 87: // W
				//change cat sprite texture
						app.stage.children[1].texture = (PIXI.loader.resources['dog'].texture);
						console.log(`cat sprite changed texture`);
						break;

				case 68: // D
				//log
						console.log(`stage children, texturecache, and loader resources:`);
						console.log(app.stage.children);
						console.log(PIXI.utils.TextureCache);
						console.log(PIXI.loader.resources);
						console.assert(Game.cat === PIXI.utils.TextureCache['cat']);
						console.log(`app view size: ${app.renderer.view.width} ${app.renderer.view.height} renderer: ${app.view.width} ${app.view.height} autoResize: ${app.renderer.autoResize}`);
						break;

				case 83: // S
				{
						//change pivot
						const cat = Game.Sprites.rec;
						const x = cat.width / 2;
						if(cat.pivot.x === x){
							cat.pivot.set(0, 0);
						}
						else cat.pivot.set(x, cat.height / 2);
					}
						break;
				case 77: // M
				{
						//change anchor
						const cat = Game.Sprites.cat;
						const x = 0.5;
						if(cat.anchor.x === x){
							cat.anchor.set(0, 0);
						}
						else cat.anchor.set(x, x);
				}
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