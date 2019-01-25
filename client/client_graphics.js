(function(){

	function Camera(canvas, map, instance){

		this.canvas = canvas;
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;

		// viewport dimensions, the size as seen
		this.width = canvas.width;
		this.height = canvas.height;

		// position of camera (left-top coordinate). assigned when following
		this.xView;
		this.yView;
		this.wView = this.width;
		this.hView = this.height;
		// distance from followed object to view border before camera starts move
		this.xDeadZone = Math.round(this.width/2);
		this.yDeadZone = Math.round(this.height/2);

		//bounds of viewport on graphic grid 
		this.subGridX;
		this.subGridY;
		this.subGridXMax;
		this.subGridYMax;

		//decided based on client options
		this.backgroundColor = 0xfffff9;

		this.app = new PIXI.Application({view: this.canvas});
		this.app.renderer.autoResize = true;
		this.app.renderer.backgroundColor = this.backgroundColor;

		this.followed;
		this.map = map;//for later integration into client core
		
		this.app.stage.addChild(new PIXI.Container());//zones
		this.app.stage.addChild(new PIXI.Container());//lines
		this.app.stage.addChild(new PIXI.Container());//players, fires, obstacles
	}

	// gameObject needs to have "x" and "y" properties (as world(or room) position)
	Camera.prototype.follow = function (player) {
		this.followed = player;
		this.xView = this.followed.x - this.xDeadZone;
		this.yView = this.followed.y - this.yDeadZone;
	}

	//update position on map based on followed and gGrid occupation
	Camera.prototype.update = function (cellSize, gridW) {//graphic grid cellsize and width
		// keep following the player (or other desired object)
		
		const wView = this.width;
		const hView = this.height;

		//update camera position on map
		this.xView = this.followed.x - this.xDeadZone;
		this.yView = this.followed.y - this.yDeadZone;

		if(debug) console.assert(!(this.xView % 1) && !(this.yView % 1));
		
		//update the grid coors of the bounds of the buffer graphics to be drawn
		
		const xView = this.xView;
		const yView = this.yView;

		//if(debug && !(xView && yView && wView && hView)) console.log(`camera update: xView: ${xView} yView: ${yView} wView: ${wView} hView: ${hView} `)

		const xViewEnd = xView + wView;
		const yViewEnd = yView + hView;
		//have some graphics buffer
		const subGridX = ~~(xView / cellSize);
		const subGridY = ~~(yView / cellSize);
		const subGridXMax = ~~((xViewEnd) / cellSize);//todo. should scale
		const subGridYMax = ~~((yViewEnd) / cellSize);
		//don't get out of bound

		const oldSubGridX = this.subGridX;
		const oldSubGridXMax = this.subGridXMax;

		this.subGridX = (subGridX < 0) ? 0 : subGridX;
		this.subGridY = (subGridY < 0) ? 0 : subGridY;
		this.subGridXMax = (subGridXMax >= gridW) ? gridW - 1 : subGridXMax;
		this.subGridYMax = (subGridYMax >= gridW) ? gridW - 1 : subGridYMax;

		//if grid doesn't change don't update graphic children
		if(oldSubGridX === this.subGridX && oldSubGridXMax === this.subGridXMax) return;

		const stage = this.app.stage;
		const zonesStage = stage.children[Game.enums.CIndex.zones];

		//first clear children
		zonesStage.children.length = 0;

		//draw relevant zones
		const gList = Game.enums.GList.zone;
    const grid = this.gridgUpper;
    const rID = Game.rIDCounter++;
    //iterating occupied logic grid to get relevant obstacles to draw
    for(let i = subGridX; i <= subGridXMax; i++){
      for(let j = subGridY; j <= subGridYMax; j++){
        //if(debug && grid[i][j][gList].length > 0) console.log(`draw obstacles gridg[i][j] length: ${grid[i][j][gList].length} i: ${i} j: ${j} subgirdX: ${subGridX} subgridy: ${subGridY} subgirdXmax: ${subGridXMax} subgridymax: ${subGridYMax} `);
        if(debug && (!grid[i] || !grid[i][j])) console.log(`drawObstacles: grid: i: ${i} j: ${j}`);

        grid[i][j][gList].forEach(obj => {
          if(debug) console.assert(obj.zID !== undefined);
          if(obj.rID === rID) return;//if already drawn
          //add sprite to children list
          zonesStage.addChild(obj.sprite);
          obj.rID = rID;
        });
      }
    }
	}
	Camera.prototype.addSpritePlayer = function(player){//todotodo
		let container;

		const lWeapon = new PIXI.Sprite(Game.Textures[`${player.lWeapon.wType}`]);
		const rWeapon = new PIXI.Sprite(Game.Textures[`${player.rWeapon.wType}`]);
		const skill = new PIXI.Sprite(Game.Textures[`${player.skill.wType}`]);

		container.rotation = player.angle;
		cotainer.owner = player;

		player.sprite = container;

		return container;

	}
	Camera.prototype.addSpriteZone = function(obj){
		//todo. based on type
		let sprite;
		switch(obj.shape){
			case(Game.enums.Shape.Rectangle):
			sprite = this.addSpriteRec(obj.color, obj.width, obj.height);
			break;

			case(Game.enums.Shape.Circle):
			sprite = this.addSpriteCirc(obj.color, obj.radius);
			break;

			default:
			if(debug) console.log(`createSprite: no matching shape`);
		}

		if(debug) console.assert(obj.angle !== undefined);
		//set angle of sprite for once since obstacles don't rotate for now
		sprite.rotation = obj.angle;
		sprite.owner = obj;

		return sprite;//todotodo. assign in or out of sprite creation function
	}
	//sprite creation for all kinds of obj/combinations
	Camera.prototype.addSpriteObstacle = function(obj){
		//todo. right now only differentiate shape, need to be based on type too
		let sprite;
		switch(obj.shape){
			case(Game.enums.Shape.Rectangle):
			sprite = this.addSpriteRec(obj.color, obj.width, obj.height);
			break;

			case(Game.enums.Shape.Circle):
			sprite = this.addSpriteCirc(obj.color, obj.radius);
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
	Camera.prototype.addSpriteRec = function(color, width, height){
		const sprite = new PIXI.Graphics();
		sprite.beginFill(obj.color);
		const w2 = obj.width / 2;
		const h2 = obj.height / 2;
		sprite.drawRect(-w2, -h2, w2, h2);
		sprite.endFill();
		return sprite;
	}
	Camera.prototype.addSpriteCirc = function(color, radius){
		const sprite = new PIXI.Graphics();
		sprite.beginFill(obj.color);
		sprite.drawCircle(0, 0, obj.radius);
		sprite.endFill();
		return sprite;
	}

	Camera.prototype.drawBackground = function(){

		const stage = this.app.stage;
		const zonesStage = stage.children[Game.enums.CIndex.zones];

		//draw relevant zones
		const gList = Game.enums.GList.zone;
    const grid = this.gridgUpper;
    const rID = Game.rIDCounter++;
    
    //iterating occupied logic grid to get relevant obstacles to draw
    zonesStage.children.forEach(sprite => {
    	sprite.position.set(sprite.owner.x - this.xView, sprite.owner.y - this.yView);
    });

    //draw lines
    const graphicCellSize = this.cellSize * this.graphicToLogic;
    const offsetX = -xView % graphicCellSize;
    const offsetY = -yView % graphicCellSize;
    context.save();
    context.strokeStyle = upperGround ? this.upperLineColor : this.underLineColor;
    context.globalAlpha = this.actualLineOpacity;
    context.lineWidth = this.actualLineWidth;
    context.beginPath();
    for (let x = offsetX; x < wView; x += graphicCellSize) {
      context.moveTo(x, 0);
      context.lineTo(x, hView);
    }
    for (let y = offsetY; y < hView; y += graphicCellSize) {
      context.moveTo(0, y);
      context.lineTo(wView, y);
    }
    context.stroke();
    context.closePath();
    context.restore();

    //draw area outside world boundary
    context.fillStyle = upperGround ? this.upperOutColor : this.underOutColor;
    if(xView < 0){
      context.fillRect(0, 0, Math.abs(xView), hView);
    }
    else if(xView + wView > this.width){
      const wOut = xView + wView - this.width;
      context.fillRect(wView - wOut, 0, wOut, hView);
    }
    if(yView < 0){
      context.fillRect(0, 0, wView, Math.abs(yView));
    }
    else if(yView + hView > this.height){
      const hOut = yView + hView - this.height;
      context.fillRect(0, hView - hOut, wView, hOut);
    }
  }



	Game.Graphics = Graphics;
	
})()