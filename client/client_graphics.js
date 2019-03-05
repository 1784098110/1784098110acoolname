(function(){

	function Camera(canvas){

		this.canvas = canvas;

		if(debug) console.log(`camera construct: canvas size: ${this.canvas.width} ${this.canvas.height}`);

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
		this.grid;//graphic
		this.cellsize;//graphic
		this.gridW;//graphic
		this.mapWidth;
		this.subGridX;
		this.subGridY;
		this.subGridXMax;
		this.subGridYMax;

		this.lineWidth = 2;
		this.lineColor = 0x000000;
		this.lineOpacity = 0.3;

		this.backgroundColor = 0xfffff9;//decided based on client options
		this.visualCellSize = 200;//optimize. unnecessary distinction? just make it cellSize?
		this.playerMapWidth = 1000; //?? todo. how to determine playermap size?
		this.playerMap;

		if(debug) console.assert(this.canvas instanceof HTMLElement);

		//manually create pixi application
		this.renderer = new PIXI.CanvasRenderer({view: this.canvas});
		this.stage = new PIXI.Container();
		
		//this.app = new PIXI.Application({view: this.canvas});
		this.renderer.autoResize = true;
		this.renderer.resize(window.innerWidth, window.innerHeight);
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
	Camera.prototype.setMapInfo = function (grid, cellSizeg, gridWg, mapWidth){//todo. awkward. try to not let camera have map. but updateing zones/obstacles children need graphic grid ??
		this.grid = grid;
		this.cellSize = cellSizeg;
		this.gridW = gridWg;
		this.mapWidth = mapWidth;

		this.createVisualGrid();//todo. put it here for now. should be called whenever view changes dimension
	}

	Camera.prototype.createPlayerMap = function(zones, obstacles){
		if(debug) console.assert(zones && obstacles);

		const cellSize = this.visualCellSize;

		const playerMap = document.createElement('canvas');
		const ctx = playerMap.getContext('2d');

		const playerMapWidth = this.playerMapWidth;
		const playerMapScale = playerMapWidth / this.mapWidth;
		playerMap.height = playerMapWidth;
		playerMap.width = playerMapWidth;
		const playerMapCellSize = cellSize * playerMapScale;

		//ctx.save();
		ctx.fillStyle = helpers.decToHexPound(this.backgroundColor);
		ctx.fillRect(0, 0, playerMapWidth, playerMapWidth);
		//ctx.restore();
    
    zones.forEach(zone => {
      this.drawMini(zone, ctx, playerMapScale);
    });

    //draw lines on top of zones
    ctx.save();
    ctx.strokeStyle = helpers.decToHexPound(this.lineColor);
    ctx.globalAlpha = this.lineOpacity;
    ctx.lineWidth = this.lineWidth / 2;
    ctx.beginPath();
		for (let x = 0; x < playerMapWidth; x += playerMapCellSize) {
      ctx.moveTo(x, 0);
			ctx.lineTo(x, playerMapWidth);
    }
    for (let y = 0; y < playerMapWidth; y += playerMapCellSize) {
      ctx.moveTo(0, y);
			ctx.lineTo(playerMapWidth, y);
    }
    ctx.stroke();
    ctx.closePath();
    ctx.restore();

    obstacles.forEach(obj => {
      //if(debug) console.log(`render obstacles: obstacles length: ${obstacles.size} x: ${obj.x} y: ${obj.y}`);
      this.drawMini(obj, ctx, playerMapScale);
    });
		
    this.playerMap = playerMap; 

		if(debug) console.assert(playerMap);
    //if(debug) console.log(`createPlayerMap end: cellsize: ${cellSize} pmapW: ${playerMapWidth} pmapScale: ${playerMapScale} zones count: ${zones.size} obs count: ${obstacles.size} backColor: ${this.backgroundColor}`);

	}
	Camera.prototype.drawPlayerMap = function(self, context, viewWidth, viewHeight){
		if(debug) console.assert(self && context && viewWidth && viewHeight);
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
		context.drawImage(this.playerMap, x, y, width, width);

		const scale = width / this.mapWidth;
		
		//draw moving markers. 
		//Self
		const x0 = Math.round(self.x * scale) + x;
		const y0 = Math.round(self.y * scale) + y;
		if(debug) console.assert(self.color && x0 && y0);
		this.drawMarker(context, self.color, x0, y0);

		//if(debug) console.log(`drawPlayerMap: x: ${x} y: ${y} w: ${width} pmapW: ${this.playerMap.width}`);
	}
	//the always present mini map in the corner
	Camera.prototype.drawMiniMap = function(self, context, viewWidth, viewHeight){
		if(debug) console.assert(self && context && viewWidth && viewHeight);
		
		if(!this.playerMap) return;//if playermap is not finished loading

		//?? todo. accomodate different sizes of canvas, scale
		//determine size and location on screen
		const dWidth = 190;//magic numbers. size of minimap on screen
		const dx = 20;
		const dy = viewHeight - 20 - dWidth;

		//minimap stagedrop
		context.fillStyle = '#000000';
		context.fillRect(dx - 3, dy - 3, dWidth + 6, dWidth + 6);
		
		//determine size and location to crop out of player map
		const pMap = this.playerMap;
		const sWidth = Math.round(pMap.width / 6);//magic number. how much of pMap to take.
		const scale = pMap.width / this.mapWidth;
		const sx = (self.x * scale - sWidth / 2);
		const sy = (self.y * scale - sWidth / 2);
		context.drawImage(pMap, sx, sy, sWidth, sWidth, dx, dy, dWidth, dWidth);

		//draw self
		const x0 = dx + dWidth / 2;
		const y0 = dy + dWidth / 2;
		if(debug) console.assert(self.color);
		this.drawMarker(context, self.color, x0, y0);
	}
	//kind of a helper function for drawing on player map. ?? where best to put it
	Camera.prototype.drawMarker = function(context, color, x, y){
		context.fillStyle = helpers.decToHexPound(color);
		context.strokeStyle = '#000000';
		context.lineWidth = 2;
		context.beginPath();
		context.arc(x, y, 5, 0, 2 * PI);
		context.fill();
		context.stroke();
		context.closePath();
		context.strokeStyle = '#ffffff';
		context.beginPath();
		context.arc(x, y, 8, 0, 2 * PI);
		context.stroke();
		context.closePath();
	}
	Camera.prototype.drawMini = function(obj, ctx, scale){
		if(debug) console.assert(obj.shape !== undefined || obj.oType !== undefined);

		//testing. change obstacles to single objects
		if(obj.oType !== undefined){
			//if(debug) console.log(`drawMini: obstacle passed in: otype: ${obj.oType}`);
			obj = obj.parts.entries().next().value[1];
			//if(debug) console.log(obj);
			if(debug) console.assert(obj.color);
		}

		const x = Math.round(obj.x * scale);
		const y = Math.round(obj.y * scale);
		ctx.save();
		ctx.fillStyle = helpers.decToHexPound(obj.color);
		switch(obj.shape){

			case(Game.enums.Shape.rectangle):
			ctx.translate(x, y);
			ctx.rotate(obj.angle);
			const width = Math.round(obj.width * scale);
			const height = Math.round(obj.height * scale);
			ctx.fillRect(-Math.round(width / 2), -Math.round(width / 2), width, height);
			break;

			case(Game.enums.Shape.circle):
			ctx.beginPath();
			ctx.arc(x, y, Math.round(obj.radius * scale), 0, 2 * PI);
			ctx.fill();
			ctx.closePath();
			break;

			case(Game.enums.Shape.point):
			ctx.beginPath();
			ctx.arc(x, y, Math.round(obj.radius * scale), 0, 2 * PI);
			ctx.fill();
			ctx.closePath();
			break;
			//no need for line
			default:
			if(debug) console.log(`drawMini: no matching shape: ${obj.shape}`);
		}
		ctx.restore();
	}
	//first called right after mapinfo then whenever viewport dimension changes
	Camera.prototype.createVisualGrid = function(){

		const gridStage = this.stage.children[Game.enums.CIndex.grid];
		gridStage.children.length = 0;
		//create separate stages for horizontal and vertical lines
		const horGridStage = new PIXI.Container();
		const verGridStage = new PIXI.Container();
		gridStage.addChild(horGridStage);
		gridStage.addChild(verGridStage);

		const wCount = Math.ceil(this.wView / this.visualCellSize) + 1;
		const hCount = Math.ceil(this.hView / this.visualCellSize) + 1;
		const thickness = this.lineWidth;
		const color = this.lineColor;
		const opacity = this.lineOpacity;

		//if(debug) console.log(`createVisualGrid: wCount: ${wCount} hCount: ${hCount}`);

		for(let i = 0; i < wCount; i++){
			const line = new PIXI.Graphics();
			line.lineStyle(thickness, color, opacity);
			line.moveTo(0, 0);
			line.lineTo(0, this.hView);
			line.position.set(i * this.visualCellSize, 0);
			verGridStage.addChild(line);
		}
		for(let i = 0; i < hCount; i++){
			const line = new PIXI.Graphics();
			line.lineStyle(thickness, color, opacity);
			line.moveTo(0, 0);
			line.lineTo(this.wView, 0);
			line.position.set(0, i * this.visualCellSize);
			horGridStage.addChild(line);
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
			//if(debug) console.log(`createSprite: no matching shape`);
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
	Camera.prototype.createSpriteObject = function(obj){
		//todo. right now only differentiate shape, need to be based on type too
		let sprite;
		switch(obj.shape){
			case(Game.enums.Shape.rectangle):
			sprite = this.createSpriteRec(obj.color, obj.width, obj.height);
			break;

			case(Game.enums.Shape.circle):
			sprite = this.createSpriteCirc(obj.color, obj.radius);
			break;

			default:
			if(debug) console.log(`createSpriteObject: no matching shape: ${obj.shape}`);
		}

		if(debug) console.assert(obj.angle !== undefined);
		//if(debug) console.log(`camere createSpriteObject: id: ${obj.oID} type: ${obj.opType} color: ${obj.color} shape: ${obj.shape} radius: ${obj.radius}`);

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
		//if(debug) console.log(`createspriteCirc: color: ${color} radius: ${radius}`);

		const sprite = new PIXI.Graphics();
		sprite.beginFill(color);
		sprite.drawCircle(0, 0, radius);
		sprite.endFill();

		if(debug) console.assert(sprite);

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
		this.dx = Math.round(this.xView - oldXView);
		this.dy = Math.round(this.yView - oldYView);

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
		const horGridStage = gridStage.children[Game.enums.CIndex.horGrid];
		const verGridStage = gridStage.children[Game.enums.CIndex.verGrid];

		horGridStage.position.set(0, horGridStage.y - this.dy);
		verGridStage.position.set(verGridStage.x - this.dx, 0);
		if(verGridStage.x > this.visualCellSize) verGridStage.x -= this.visualCellSize;
		if(verGridStage.x < -this.visualCellSize) verGridStage.x += this.visualCellSize;
		if(horGridStage.y > this.visualCellSize) horGridStage.y -= this.visualCellSize;
		if(horGridStage.y < -this.visualCellSize) horGridStage.y += this.visualCellSize;

		//update zones and land
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
						//if(debug) console.log(`drawLand zone: Id: ${obj.zID} x: ${obj.x} Type: ${obj.zType}`);					

	          //set position
	          obj.sprite.position.set(obj.x - this.xView, obj.y - this.yView);

	          //add sprite to children list
	          zoneStage.addChild(obj.sprite);
	          obj.rID = rID;
	        });

	        grid[i][j][Game.enums.GList.obstacle].forEach(obj => {
						if(debug) console.assert(obj.oID !== undefined);
						if(obj.rID === rID) return;//if already drawn
						//if(debug) console.log(`drawLand obstacle: oId: ${obj.oID} x: ${obj.x} y: ${obj.y} obj.oType: ${obj.oType} obj.parts.length: ${obj.parts.size}`);

						if(debug && !obj.sprite) console.log(`drawland: obstacle part no sprite: oid: ${obj.oID} type: ${obj.opType} color: ${obj.color} shape: ${obj.shape} radius: ${obj.radius}`);

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