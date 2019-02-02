(function(){

	function Camera(canvas){

		this.canvas = canvas;
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;

		// viewport dimensions, the size as seen
		this.width = canvas.width;
		this.height = canvas.height;

		// position of camera (left-top coordinate). assigned when following
		this.xView;
		this.yView;
		this.wView = this.width;//todo. size of viewport on world map is irrespective of windows size
		this.hView = this.height;
		this.vision = 1;//scale of viewport on world map. decides how much player sees

		//to assist moving the containers when drawing
		this.dx = 0;
		this.dy = 0;

		// distance from followed object to view border before camera starts move
		this.xDeadZone = Math.round(this.width/2);
		this.yDeadZone = Math.round(this.height/2);

		//bounds of viewport on graphic grid 
		this.grid;
		this.cellsize;
		this.gridW;
		this.subGridX;
		this.subGridY;
		this.subGridXMax;
		this.subGridYMax;

		this.backgroundColor = 0xfffff9;//decided based on client options
		this.visualCellSize = 200;//optimize. unnecessary distinction? just make it cellSize?

		if(debug) console.assert(this.canvas instanceof HTMLElement);
		if(debug) console.log(`canvas size: ${this.canvas.width} ${this.canvas.height}`);

		//manually create pixi application
		this.renderer = new PIXI.CanvasRenderer({view: this.canvas});
		this.stage = new PIXI.Container();
		
		//this.app = new PIXI.Application({view: this.canvas});
		this.renderer.autoResize = true;
		this.renderer.backgroundColor = this.backgroundColor;

		this.followed;
		//this.map = map;//for later integration into client core

		this.stage.addChild(new PIXI.Container());//zone
		this.stage.addChild(new PIXI.Container());//grid
		this.stage.addChild(new PIXI.Container());//fire
		this.stage.addChild(new PIXI.Container());//player
		this.stage.addChild(new PIXI.Container());//obstacle
		this.stage.addChild(new PIXI.Container());//treecrown
	}

	//store graphic related info from map. called on client init
	Camera.prototype.setMapInfo = function (grid, cellSizeg, gridWg){//todo. awkward. try to not let camera have map. but updateing zones/obstacles children need graphic grid ??
		this.grid = grid;
		this.cellSize = cellSizeg;
		this.gridW = gridWg;

		this.createVisualGrid();//todo. put it here for now. should be called whenever view changes dimension
	}
	//first called right after mapinfo then whenever viewport dimension changes
	Camera.prototype.createVisualGrid = function(){

		const gridStage = this.stage.children[Game.enums.CIndex.grid];
		gridStage.children.length = 0;//clear

		const wCount = Math.ceil(this.wView / this.visualCellSize);
		const hCount = Math.ceil(this.hView / this.visualCellSize);
		const thickness = 4;
		const color = 0xfffffa;
		const opacity = 1;

		for(let i = 0; i < wCount; i++){
			const line = new PIXI.Graphics();
			line.lineStyle(thickness, color, opacity);
			line.moveTo(0, 0);
			line.lineTo(0, this.hView);
			line.position.set(i * this.visualCellSize, 0);
			gridStage.addChild(line);
		}
		for(let i = 0; i < hCount; i++){
			const line = new PIXI.Graphics();
			line.lineStyle(thickness, color, opacity);
			line.moveTo(0, 0);
			line.lineTo(this.wView, 0);
			line.position.set(0, i * this.visualCellSize);
			gridStage.addChild(line);
		}
	}

	Camera.prototype.createSpritePlayer = function(player){
		const container = new PIXI.Container();

		const lWeapon = new PIXI.Sprite(Game.Textures[`${player.lWeapon.wType}`]);
		const rWeapon = new PIXI.Sprite(Game.Textures[`${player.rWeapon.wType}`]);
		const skill = new PIXI.Sprite(Game.Textures[`${player.skill.wType}`]);
		const body = this.createSpriteCirc(player.color, player.radius);

		container.addChild(lWeapon, rWeapon, body, skill);
		lWeapon.anchor.set(0.5, 0);
		rWeapon.anchor.set(0.5, 0);
		skill.anchor.set(0.5, 0.5);
		lWeapon.position.set(player.lWeapon.holdRadius, 0);
		rWeapon.position.set(player.rWeapon.holdRadius, 0);
		skill.position.set(player.skill.holdRadius, 0);

		container.pivot.set(body.x, body.y);
		container.rotation = player.angle;
		container.owner = player;

		return container;

	}
	Camera.prototype.createSpriteFire = function(obj){
		//todo. based on type
		let sprite;
		switch(obj.wType){
			case(Game.enums.WType.katana):
			sprite = this.createSpriteCirc(obj.color, obj.radius);
			break;

			case(Game.enums.Shape.dagger):
			sprite = this.createSpriteCirc(obj.color, obj.length);
			break;

			default:
			if(debug) console.log(`createSprite: no matching shape`);
			if(debug) console.assert(obj.color && obj.radius);
			sprite = this.createSpriteCirc(obj.color, obj.radius);
		}

		if(debug) console.assert(obj.angle !== undefined);
		//set angle of sprite for once since obstacles don't rotate for now
		sprite.rotation = obj.angle;
		sprite.owner = obj;

		return sprite;
	}
	Camera.prototype.createSpriteZone = function(obj){
		//todo. based on type
		let sprite;
		switch(obj.shape){
			case(Game.enums.Shape.rectangle):
			sprite = this.createSpriteRec(obj.color, obj.width, obj.height);
			break;

			case(Game.enums.Shape.circle):
			sprite = this.createSpriteCirc(obj.color, obj.radius);
			break;

			default:
			if(debug) console.log(`createSprite: no matching shape`);
		}

		if(debug) console.assert(obj.angle !== undefined);
		//set angle of sprite for once since obstacles don't rotate for now
		sprite.rotation = obj.angle;
		sprite.owner = obj;

		return sprite;
	}
	//sprite creation for all kinds of obj/combinations
	Camera.prototype.createSpriteObstacle = function(obj){
		//todo. right now only differentiate shape, need to be based on type too
		let sprite;
		switch(obj.shape){
			case(Game.enums.Shape.Rectangle):
			sprite = this.createSpriteRec(0xff0000, obj.width, obj.height);
			break;

			case(Game.enums.Shape.Circle):
			sprite = this.createSpriteCirc(0x00ff00, obj.radius);
			break;

			default:
			if(debug) console.log(`createSprite: no matching shape: ${obj.shape}`);
		}

		if(debug) console.assert(obj.angle !== undefined);
		if(debug) console.log(`camere createSpriteObstacle: id: ${obj.oID} type: ${obj.oType}`);

		//set angle of sprite for once since obstacles don't rotate for now
		sprite.rotation = obj.angle;
		sprite.owner = obj;

		return sprite;
	}
	Camera.prototype.createSpriteRec = function(color, width, height){
		const sprite = new PIXI.Graphics();
		sprite.beginFill(color);
		const w2 = width / 2;
		const h2 = height / 2;
		sprite.drawRect(-w2, -h2, w2, h2);
		sprite.endFill();

		return sprite;
	}
	Camera.prototype.createSpriteCirc = function(color, radius){
		const sprite = new PIXI.Graphics();
		sprite.beginFill(color);
		sprite.drawCircle(0, 0, radius);
		sprite.endFill();

		return sprite;
	}

	//unncessary methods since fires and players are together?
	//passed in objects already have sprites
	Camera.prototype.addPlayer = function(player){
		this.stage.children[Game.enums.CIndex.player].addChild(player.sprite);
	}
	Camera.prototype.clearPlayers = function(){
		this.stage.children[Game.enums.CIndex.player].children.length = 0;
	}
	Camera.prototype.addFire = function(fire){
		this.stage.children[Game.enums.CIndex.fire].addChild(fire.sprite);
	}
	Camera.prototype.removeFireAt = function(i){
		this.stage.children[Game.enums.CIndex.fire].removeChildAt(i);
	}
	Camera.prototype.getFires = function(){
		return this.stage.children[Game.enums.CIndex.fire].children;
	}

		// gameObject needs to have "x" and "y" properties (as world(or room) position)
	Camera.prototype.follow = function (player) {
		this.followed = player;
		this.xView = this.followed.x - this.xDeadZone;
		this.yView = this.followed.y - this.yDeadZone;
	}

	//update position on map based on followed and gGrid occupation
	Camera.prototype.update = function () {//graphic grid cellsize and width
		// keep following the player (or other desired object)

		//update camera position on map
		const oldXView = this.xView;
		const oldYView = this.yView;
		this.xView = this.followed.x - this.xDeadZone;
		this.yView = this.followed.y - this.yDeadZone;
		this.dx = this.xView - oldXView;
		this.dy = this.yView - oldYView;

	}

	//update all game related graphic
	Camera.prototype.drawGame = function(){

		this.drawLand();
    
		this.stage.children[Game.enums.CIndex.fire].children.forEach(sprite => {
			sprite.position.set(sprite.owner.x - this.xView, sprite.owner.y - this.yView);
			sprite.rotation = sprite.owner.angle;
		});

		this.stage.children[Game.enums.CIndex.player].children.forEach(sprite => {
			sprite.position.set(sprite.owner.x - this.xView, sprite.owner.y - this.yView);
			sprite.rotation = sprite.owner.angle;
		});

		this.renderer.render(this.stage);
	}

	//decide if just move the zones/obstacles container or refresh all children
	Camera.prototype.drawLand = function(){
		
		if(debug) console.assert(this.xView !== undefined); 
		if(debug) console.assert(!(this.xView % 1) && !(this.yView % 1));
		
		//update the grid coors of the bounds of the buffer graphics to be drawn
		//if(debug && !(xView && yView && wView && hView)) console.log(`camera update: xView: ${xView} yView: ${yView} wView: ${wView} hView: ${hView} `)

		const xViewEnd = this.xView + this.wView;
		const yViewEnd = this.yView + this.hView;
		//have some graphics buffer
		const subGridX = ~~(this.xView / this.cellSize);
		const subGridY = ~~(this.yView / this.cellSize);
		const subGridXMax = ~~((xViewEnd) / this.cellSize);//todo. should scale
		const subGridYMax = ~~((yViewEnd) / this.cellSize);
		//don't get out of bound

		const oldSubGridX = this.subGridX;
		const oldSubGridXMax = this.subGridXMax;

		this.subGridX = (subGridX < 0) ? 0 : subGridX;
		this.subGridY = (subGridY < 0) ? 0 : subGridY;
		this.subGridXMax = (subGridXMax >= this.gridW) ? this.gridW - 1 : subGridXMax;
		this.subGridYMax = (subGridYMax >= this.gridW) ? this.gridW - 1 : subGridYMax;

		//update visual Grid, reset pos if needed
		const gridStage = this.stage.children[Game.enums.CIndex.grid];
		gridStage.position.set(gridStage.x - this.dx, gridStage.y - this.dy);
		if(gridStage.x > this.visualCellSize) gridStage.x -= this.visualCellSize;
		if(gridStage.x < -this.visualCellSize) gridStage.x += this.visualCellSize;
		if(gridStage.y > this.visualCellSize) gridStage.y -= this.visualCellSize;
		if(gridStage.y < -this.visualCellSize) gridStage.y += this.visualCellSize;


		const zoneStage = this.stage.children[Game.enums.CIndex.zone];
		const obstacleStage = this.stage.children[Game.enums.CIndex.obstacle];

		//if grid doesn't change don't update graphic children, just move containers
		if(oldSubGridX === this.subGridX && oldSubGridXMax === this.subGridXMax){
			zoneStage.position.set(zoneStage.x - this.dx, zoneStage.y - this.dy);
			obstacleStage.position.set(obstacleStage.x - this.dx, obstacleStage.y - this.dy);
		}
		else{
			//first clear children
			zoneStage.children.length = 0;
			obstacleStage.children.length = 0;
			zoneStage.position.set(0, 0);
			obstacleStage.position.set(0, 0);

			//draw relevant zones
	    const grid = this.grid;
	    const rID = Game.rIDCounter++;
	    //iterating occupied logic grid to get relevant zones and obstacles to add to stage
	    for(let i = this.subGridX; i <= this.subGridXMax; i++){
	      for(let j = this.subGridY; j <= this.subGridYMax; j++){
	        //if(debug && grid[i][j][gList].length > 0) console.log(`draw obstacles gridg[i][j] length: ${grid[i][j][gList].length} i: ${i} j: ${j} subgirdX: ${subGridX} subgridy: ${subGridY} subgirdXmax: ${subGridXMax} subgridymax: ${subGridYMax} `);
	        if(debug && (!grid[i] || !grid[i][j])) console.log(`drawObstacles broke: grid: i: ${i} j: ${j} map grid size: w: ${grid.length} h: ${grid[0].length} map size: ${this.map.width} ${this.map.height} griWg: ${this.gridW} cellSizeg: ${this.cellSize} subgridx: ${this.subGridX} subgridy: ${this.subGridY} subgridxmax: ${this.subGridXMax} subgridymax: ${this.subGridYMax}`);

	        grid[i][j][Game.enums.GList.zone].forEach(obj => {
	          if(debug) console.assert(obj.zID !== undefined);
						if(obj.rID === rID) return;//if already drawn
						if(debug) console.log(`drawLand zone: Id: ${obj.zID} x: ${obj.x} Type: ${obj.zType}`);					

	          //set position
	          obj.sprite.position.set(obj.x - this.xView, obj.y - this.yView);

	          //add sprite to children list
	          zoneStage.addChild(obj.sprite);
	          obj.rID = rID;
	        });

	        grid[i][j][Game.enums.GList.obstacle].forEach(obj => {
						if(debug) console.assert(obj.oID !== undefined);
						obj = obj.obstacle;
						if(obj.rID === rID) return;//if already drawn
						if(debug) console.log(`drawLand obstacle: oId: ${obj.oID} x: ${obj.x} y: ${obj.y} obj.oType: ${obj.oType} obj.parts.length: ${obj.parts.size}`);

	          //set position
	          obj.sprite.position.set(obj.x - this.xView, obj.y - this.yView);

						obstacleStage.addChild(obj.sprite);
						obj.rID = rID;
	        });
	      }
	    }
	  }
  }



	Game.Camera = Camera;
	
})()