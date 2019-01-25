//Camera, handles graphics
(function () {
	//optimize. x and y view can be calculated with player and canvas stats
	function Camera(canvas, canvasWidth, canvasHeight) {
		
		this.followed;//assigned with follow method

		this.canvas = canvas;
		this.canvas.width = canvasWidth;
		this.canvas.height = canvasHeight;

		//client's actual window size. can change  ?? need separate from width and height?
		this.wView = canvasWidth;
		this.hView = canvasHeight;
		this.scale;//scale of graphics to actual size

		// viewport dimensions, on world map not the same as view size
		this.width = this.wView;
		this.height = this.hView;
		
		// distance from followed object to view border before camera starts move
		this.xDeadZone = Math.round(this.width/2);
		this.yDeadZone = Math.round(this.height/2);

		// position of camera (left-top coordinate). assigned when following
		this.xView;
		this.yView;

		//bounds of viewport on graphic grid 
		this.subGridX;
		this.subGridY;
		this.subGridXMax;
		this.subGridYMax;

		//pixijs application
		this.app = new pixiApplication({view: this.canvas});
		this.app.renderer.autoResize = true;
	}

	// gameObject needs to have "x" and "y" properties (as world(or room) position)
	Camera.prototype.follow = function (player, xDeadZone, yDeadZone) {
		this.followed = player;
		this.xDeadZone = xDeadZone || this.xDeadZone;
		this.yDeadZone = yDeadZone || this.yDeadZone;
		this.xView = this.followed.x - this.xDeadZone;
		this.yView = this.followed.y - this.yDeadZone;
	}
	/*todo. not used right now. all graphics should not be based on viewport size directly. should scale.
	Camera.prototype.setViewport = function(width, height) {
		this.width = width;
		this.height = height;
		this.scale = 1;//todo. when clien viewport size changes
	}*/
	Camera.prototype.update = function (cellSize, gridW) {//graphic grid cellsize and width
		// keep following the player (or other desired object)
		
		const wView = this.width;
		const hView = this.height;
		/*
		if (this.followed) {
			var xView = 0,
					yView = 0;
			if (this.followed.x - this.xView + this.xDeadZone > this.width)
				xView = this.followed.x - (this.width - this.xDeadZone);
			else if (this.followed.x - this.xDeadZone < this.xView)
				xView = this.followed.x - this.xDeadZone;

			if (this.followed.y - this.yView + this.yDeadZone > this.height)
				yView = this.followed.y - (this.height - this.yDeadZone);
			else if (this.followed.y - this.yDeadZone < this.yView)
				yView = this.followed.y - this.yDeadZone;
		}*/

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
		const subGridX = ~~(xView / cellSize) - 1;
		const subGridY = ~~(yView / cellSize) - 1;
		const subGridXMax = Math.ceil((xViewEnd) / cellSize) + 1;//todo. should scale
		const subGridYMax = Math.ceil((yViewEnd) / cellSize) + 1;
		//don't get out of bound
		this.subGridX = (subGridX < 0) ? 0 : subGridX;
		this.subGridY = (subGridY < 0) ? 0 : subGridY;
		this.subGridXMax = (subGridXMax > gridW) ? gridW : subGridXMax;
		this.subGridYMax = (subGridYMax > gridW) ? gridW : subGridYMax;
	}

	// add "class" Camera to our Game object
	Game.Camera = Camera;

})();