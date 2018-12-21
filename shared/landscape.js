
//Land
(function(){
  /**
   * feed a seed to constructor?
   * todo. remember to add an unpassable margin so when player gets to edge 
   * of the world he doesn't just see white space outside. 
   * Obstacles on map cannot be destroyed for now.
   * Should the obstacles be separate objects with individual draw? 
   * Or are their graphisc prefixed on map with just some stats recorded
   * somewhere to let game know there's an obstacle???
   * */ 
  function Land(width, height, cellSize) {//testing. better way to inform it's server
		this.width = width; //world not grid size
    this.height = height;

    //grid size is the same for upper and lower levels
    this.cellSize = cellSize;
    this.gridW = (this.width / this.cellSize);
    if(debug) console.assert(this.gridW % 1 === 0);//should fit just right
  
    this.graphicToLogic = 10;//how many logic grid make up for one graphic grid
    this.cellSizeg = this.cellSize * this.graphicToLogic;
    this.gridWg = this.gridW / this.graphicToLogic;
    if(debug) console.assert(this.gridWg % 1 === 0);//should fit tight

    //?? should groundlevels be independent of each other?
    this.gridUpper = [];//all objects
    this.gridUnder = [];
    this.zoneGridUpper = [];//all zones
    this.zoneGridUnder = [];
    this.gridgUpper = [];//for all graphics
    this.gridgUnder = [];

    this.objects = new Map();
    this.zones = new Map();//zones need to be identified. ?? do they really?

    //all zones and objects have ids
    this.zidCounter = 0;
    this.jidCounter = 0;

    //graphics
    //todo. these should be decided based on map type
    this.upperBackColor = 'rgb(160, 160, 160)';
    this.upperOutColor = 'rgb(140, 140, 140)'
    this.upperLineColor = 'white';
    this.underBackColor = 'rgb(30, 30, 30)';
    this.underOutColor = 'black';
    this.underLineColor = 'white';
    this.actualLineOpacity = 0.2;
    this.actualLineWidth = 2;
    
    //actual size of player map. ?? should it be fixed or based on viewport size? bigger or smaller is better?
    this.playerMapWidth = 1000;
    
    const graphicRatio = this.graphicToLogic;
    let ig, jg, graphicGrid;
    //create 3d array for collssions and fill grids
    for(let i = 0, w = this.gridW; i < w; i++){
      graphicGrid = false;
      this.gridUpper[i] = [];
      this.gridUnder[i] = [];
      this.zoneGridUpper[i] = [];
      this.zoneGridUnder[i] = [];
      if(i % graphicRatio === 0){//fill graphic grid too. graphic grid has larger cells
        ig = i / graphicRatio;
        graphicGrid = true;
        this.gridgUpper[ig] = [];
        this.gridgUnder[ig] = [];
      }
      for(let j = 0; j < w; j++){//always a square map so j limit == i limit
        //split each grid cell into lists by object/zone type to reduce iterations
        this.gridUpper[i][j] = [];
        this.gridUnder[i][j] = [];
        this.zoneGridUpper[i][j] = [];
        this.zoneGridUnder[i][j] = [];
        if(j % graphicRatio === 0 && graphicGrid){
          jg = j / graphicRatio;
          this.gridgUpper[ig][jg] = [[], [], [], [], []];
          this.gridgUnder[ig][jg] = [[], [], [], [], []];
        }
      }
    }
	}

  Land.prototype.createZID = function(){//all zones
    //server and client zones are created in same sequence, also needed for graphics
    return this.zidCounter++; 
  
  }
  Land.prototype.createJID = function(){//all objects
    //server and client zones are created in same sequence, also needed for graphics
    return this.jidCounter++; 
  
  }

  Land.prototype.addTerrian = function(obj){
    //todo.add all kinds of terrians before any object/zone. so there's no collide check

    //todo. Some terrians might be incompatible, might need collide check after all
    obj.zones.forEach(zone => {
      this.addZone(zone);
    });
    obj.generator = undefined;

  }
  //zones are permanent
  Land.prototype.addZone = function(obj){
    //zones can be rotated rectangles

    if(debug) console.assert(obj.upperGround !== undefined);

    //add glist here once for all since zones won't be readded
    if(debug) console.assert(obj.gList === Game.enums.GList.zone);
    const gList = obj.gList

    let grid, gridg;//logic grid has zone and objects separated. but combined in graphic grid
    [grid, gridg] = (obj.upperGround === true) ? [this.zoneGridUpper, this.gridgUpper] : [this.zoneGridUnder, this.gridgUnder];

    obj.zID = this.createZID();//?? but zones are split into two different lists. 
    this.zones.set(obj.zID, obj);

    //if(debug && obj.zType === Game.enums.ZType.hiding) console.log(`addzone: zone: zType: ${obj.zType} zID: ${obj.zID} color: ${obj.color}`);

    let x = (obj.x);
    let y = (obj.y);
    let x1, y1, x2, y2;

    //determine zone size and location based on shape
    if(obj.shape === Game.enums.Shape.rectangle && obj.angle !== 0){//if it's a tilted rec make it fit a upright rec
    //optimize. finding min and max coor can be better etc.

      //find coors of two adjacent corners and get coors of other 2 by flipping these two
      let w = obj.width;
      let h = obj.height;
      let angle = obj.angle;
      let phi = Math.atan2(h, w);
      let theta1 = phi + angle;
      let theta2 = angle - phi;
      let l = 0.5 * Math.sqrt(h * h + w * w);
      let ya = Math.sin(theta1) * l + y;
      let xa = Math.cos(theta1) * l + x;
      let yb = Math.sin(theta2) * l + y;
      let xb = Math.cos(theta2) * l + x;
      let yc = -ya + y * 2;//y * 2 because ya is relative to world origin. 
      let xc = -xa + x * 2;
      let yd = -yb + y * 2;
      let xd = -xb + x * 2;

      //coors of the two far corners of the enclosing upright rec and conver to grid coor
      x1 = Math.floor(Math.min(xa ,xb, xc, xd) / this.cellSize);
      y1 = Math.floor(Math.min(ya ,yb, yc, yd) / this.cellSize);
      x2 = Math.floor(Math.max(xa ,xb, xc, xd) / this.cellSize);
      y2 = Math.floor(Math.max(ya ,yb, yc, yd) / this.cellSize);


      //if(debug) console.log(`addZone: x1: ${x1} y1: ${y1} x2: ${x2} y2: ${y2}`);

    }else{
      let wh = (obj.width / 2) || obj.radius;
      let hh = (obj.height / 2) || obj.radius;

      //which cell does the edges of the object occupy
      x1 = Math.floor((x - wh) / this.cellSize);
      y1 = Math.floor((y - hh) / this.cellSize);
      x2 = Math.floor((x + wh) / this.cellSize);
      y2 = Math.floor((y + hh) / this.cellSize);
    }

    //if(debug) console.log(' wMap AddObject: w: ' + w + ' h: ' + h);
    //if(debug && obj.point) console.log('map addobject: obj.x: ' + obj.x + ' obj.y: ' + obj.y);
    //if(debug && obj.shape === Game.enums.Shape.line) console.log('map addobject: line: obj.x: ' + obj.x + ' obj.y: ' + obj.y + ' x: ' + x + ' y: ' + y + ' w: ' + w + ' h: ' + h + ' angle: ' + obj.angle.toFixed(3));
    if(debug) console.assert(y2 !== undefined);

    //fill the cells between the ones occupied by object's edges
    const gridH = this.gridW
    for (let i = (x1 > 0 ? x1 : 0), i2 = (x2 < this.gridW) ? x2 : (this.gridW - 1); i <= i2; i++){
      for (let j = (y1 > 0 ? y1 : 0), j2 = (y2 < gridH) ? y2 : (gridH - 1); j <= j2; j++){
        if(debug && !(grid[i] && grid[i][j])) console.log(':: ERROR: map addzone: !grid[i]: obj.x: ' + obj.x + ' obj.y: ' + obj.y + ' i: ' + i + ' j: ' + j + ' obj.zID: ' + obj.zID);
        if(debug) console.assert(grid[i][j]);

        grid[i][j].push(obj);
        obj.cells.push(i * gridH + j);
      }
    }

    //fill graphic grid. used by both server and client
    const graphicRatio = this.graphicToLogic;
    const x1g = Math.floor(x1 / graphicRatio);
    const y1g = Math.floor(y1 / graphicRatio);
    const x2g = Math.floor(x2 / graphicRatio);
    const y2g = Math.floor(y2 / graphicRatio);
    const gridHg = this.gridWg;

    for (let i = (x1g > 0 ? x1g : 0), i2 = (x2g < gridHg) ? x2g : (gridHg - 1); i <= i2; i++){
      for (let j = (y1g > 0 ? y1g : 0), j2 = (y2g < gridHg) ? y2g : (gridHg - 1); j <= j2; j++){
        if(debug && !(gridg[i] && gridg[i][j])) console.log(':: ERROR: map addobj graphic: !grid[i]: obj.x: ' + obj.x + ' obj.y: ' + obj.y + ' i: ' + i + ' j: ' + j + ' grid length: ' + gridg.length + ' obj.zID: ' + obj.zID);
        if(debug) console.assert(gridg[i][j]);
        if(debug) console.assert(gList === 0);

        gridg[i][j][gList].push(obj);
        obj.cellsg.push(i * gridHg + j);
      }
    }
  }
  Land.prototype.removeZone = function(obj){

    const gList = obj.gList;
    let grid, gridg;
    [grid, gridg] = (obj.upperGround === true) ? [this.zoneGridUpper, this.gridgUpper] : [this.zoneGridUnder, this.gridgUnder];
    const cells = obj.cells;
    const cellsg = obj.cellsg;
    const gridH = this.gridW;
    const gridHg = this.gridWg;
    let x, y;

    for (let i = 0, l = cells.length; i < l; i++){
      x = Math.floor(cells[i] / gridH);
      y = cells[i] % gridH;
      grid[x][y].splice(grid[x][y].indexOf(obj), 1);
    }
    obj.cells = [];

    //also remove on graphic grid. used by both server and client
    for (let i = 0, l = cellsg.length; i < l; i++){
      x = Math.floor(cellsg[i] / gridHg);
      y = cellsg[i] % gridHg;
      gridg[x][y][gList].splice(gridg[x][y][gList].indexOf(obj), 1);
    }
    obj.cellsg = [];
  }
  //general object handling
  Land.prototype.addObject = function(obj){

    if(debug) console.assert(obj.upperGround !== undefined);

    const gList =  obj.gList;
    if(debug) console.assert(gList !== undefined);
    let grid, gridg;
    [grid, gridg] = (obj.upperGround === true) ? [this.gridUpper, this.gridgUpper] : [this.gridUnder, this.gridgUnder];

    //should fires not get universal id and enter objects map because there are so many of them ?? 
    if(obj.fID === undefined){
      obj.jID = this.createJID();
      this.objects.set(obj.jID, obj);
    } 

    //if(debug && !obj.upperGround) console.log('map addobject: obj upperground: ' + obj.upperGround);

    const x = (obj.x);
    const y = (obj.y);
    //grid coors of the bounds of obj
    let x1, y1, x2, y2;

    //determine object size and location based on shape
    if(obj.shape === Game.enums.Shape.line){//if it's a line make it fill a rec

      x1 = x;
      y1 = y;

      //get the coors of the two far corners of the rec formed by line    
      [x1, x2] = (obj.x2 >= x) ? [Math.floor(x / this.cellSize), Math.floor(obj.x2 / this.cellSize)] : [Math.floor(obj.x2 / this.cellSize), Math.floor(x / this.cellSize)];
      [y1, y2] = (obj.y2 >= y) ? [Math.floor(y / this.cellSize), Math.floor(obj.y2 / this.cellSize)] : [Math.floor(obj.y2 / this.cellSize), Math.floor(y / this.cellSize)];

      //lines needs extra confirmation since they can keep a origin and rotate.
      obj.cellX2 = x2;
      obj.cellY2 = y2;

      //flat lines need extra buffer space otherwise too thin to detect
      if(obj.angle === 0 || obj.angle === PI){//horizontal line
        if((y / this.cellSize) < (this.cellSize / 2) && y1 !== 0) y1 --;
        else if ((y / this.cellSize) > (this.cellSize / 2) && y1 < this.gridW-1) y1 ++;
      }
      if(obj.angle === (PI / 2) || obj.angle === -(PI / 2)){//vertical line
        if((x / this.cellSize) < (this.cellSize / 2) && x1 !== 0) x1 --;
        else if ((x / this.cellSize) > (this.cellSize / 2) && x1 < this.gridW-1) x1 ++;
      }

    }else{
      let wh = (obj.width / 2) || obj.radius;
      let hh = (obj.height / 2) || obj.radius;

      //which cell does the edges of the object occupy
      x1 = Math.floor((x - wh) / this.cellSize);
      y1 = Math.floor((y - hh) / this.cellSize);
      x2 = Math.floor((x + wh) / this.cellSize);
      y2 = Math.floor((y + hh) / this.cellSize);
    }
    
    //for optimization. if it's the same as last time then no need to update cells
    obj._cellX = x1;
    obj._cellY = y1;


    //if(debug) console.log(' wMap AddObject: w: ' + w + ' h: ' + h);
    //if(debug && obj.oID !== undefined) console.log('map addobject: obj.x: ' + obj.x + ' obj.y: ' + obj.y + ` w: ${obj.width} h: ${obj.height} angle: ${obj.angle}`);
    //if(debug && obj.shape === Game.enums.Shape.line) console.log('map addobject: line: obj.x: ' + obj.x + ' obj.y: ' + obj.y + ' x: ' + x + ' y: ' + y + ' w: ' + w + ' h: ' + h + ' angle: ' + obj.angle.toFixed(3));
    if(debug) console.assert(y2 !== undefined);

    //fill the cells between the ones occupied by object's edges
    const gridH = this.gridW;
    for (let i = (x1 > 0 ? x1 : 0), i2 = (x2 < gridH) ? x2 : (gridH - 1); i <= i2; i++){
      for (let j = (y1 > 0 ? y1 : 0), j2 = (y2 < gridH) ? y2 : (gridH - 1); j <= j2; j++){
        if(debug && !(grid[i] && grid[i][j])) console.log(':: ERROR: map addobj: !grid[i]: obj.x: ' + obj.x + ' obj.y: ' + obj.y + ' w: ' + w + ' h: ' + h + ' i: ' + i + ' j: ' + j + ' obj.jID: ' + obj.jID);
        if(debug) console.assert(grid[i][j]);

        grid[i][j].push(obj);
        obj.cells.push(i * gridH + j);
      }
    }

    //fill graphic grid. used by both server and client
    const graphicRatio = this.graphicToLogic;
    const x1g = Math.floor(x1 / graphicRatio);
    const y1g = Math.floor(y1 / graphicRatio);
    const x2g = Math.floor(x2 / graphicRatio);
    const y2g = Math.floor(y2 / graphicRatio);
    const gridHg = this.gridWg;
    for (let i = (x1g > 0 ? x1g : 0), i2 = (x2g < gridHg) ? x2g : (gridHg - 1); i <= i2; i++){
      for (let j = (y1g > 0 ? y1g : 0), j2 = (y2g < gridHg) ? y2g : (gridHg - 1); j <= j2; j++){
        if(debug && !(gridg[i] && gridg[i][j])) console.log(':: ERROR: map addobj graphic: !grid[i]: obj.x: ' + obj.x + ' obj.y: ' + obj.y + ' w: ' + w + ' h: ' + h + ' i: ' + i + ' j: ' + j + ' obj.jID: ' + obj.jID);
        if(debug) console.assert(gridg[i][j][gList] !== undefined);

        gridg[i][j][gList].push(obj);
        obj.cellsg.push(i * gridHg + j);
      }
    }

    //if(debug) console.log('map addObject: shape: ' + obj.shape + ' cells.length: ' + obj.cells.length + ' cells: ' + obj.cells)
  }
  Land.prototype.removeObject = function(obj){

    const gList =  obj.gList;
    let grid, gridg;
    [grid, gridg] = (obj.upperGround === true) ? [this.gridUpper, this.gridgUpper] : [this.gridUnder, this.gridgUnder];
    const cells = obj.cells;
    const cellsg = obj.cellsg;
    const gridH = this.gridW;
    const gridHg = this.gridWg;
    let x, y;

    for (let i = 0, l = cells.length; i < l; i++){
      x = Math.floor(cells[i] / gridH);
      y = cells[i] % gridH;
      grid[x][y].splice(grid[x][y].indexOf(obj), 1);
    }
    obj.cells = [];

    //also remove on graphic grid. used by both server and client
    for (let i = 0, l = cellsg.length; i < l; i++){
      x = Math.floor(cellsg[i] / gridHg);
      y = cellsg[i] % gridHg;
      gridg[x][y][gList].splice(gridg[x][y][gList].indexOf(obj), 1);
    }
    obj.cellsg = [];
  }
  Land.prototype.updateObject = function(obj){
    //check if object is in same grid else update
    if(obj.shape === Game.enums.Shape.line){   
      if(([obj._cellX, obj._cellX2] === [Math.floor(obj.x / this.cellSize), Math.floor(obj.x2 / this.cellSize)]) || ([obj._cellX, obj._cellX2] === [Math.floor(obj.x2 / this.cellSize), Math.floor(obj.x / this.cellSize)]) && 
      ([obj._cellY, obj._cellY2] === [Math.floor(obj.y / this.cellSize), Math.floor(obj.y2 / this.cellSize)]) || ([obj._cellY, obj._cellY2] === [Math.floor(obj.y2 / this.cellSize), Math.floor(obj.y / this.cellSize)])) return;

    }
    else{
      let wh = (obj.width === undefined) ? obj.radius : obj.width / 2;
      let hh = (obj.height === undefined) ? obj.radius : obj.height / 2;
      if(Math.floor((obj.x - wh) / this.cellSize) === obj._cellX &&  Math.floor((obj.y - hh) / this.cellSize) === obj._cellY) {
        return;
      }
    }

    this.removeObject(obj);
    this.addObject(obj);
  }
  Land.prototype.handleZones = function(obj){//only characters should be passed in 

    obj.zones.clear();//?? better way to turn off zone flags to know when obj get out of zone?

    let grid = (obj.upperGround === true) ? this.zoneGridUpper : this.zoneGridUnder;

    //obj's grid coor
    let x = Math.floor(obj.x / this.cellSize);
    let y = Math.floor(obj.y / this.cellSize);

    //potential occupying zones
    let zones = grid[x][y];
    let lastCheck = [];

    for(let i = 0, l = zones.length; i < l; i++){
      let zone = zones[i];

      if(lastCheck[zone.zType]) continue;//no need to check the same type of zone twice

      if(obj.checkZone(zone)){
        lastCheck[zone.zType] = true;

        //if(debug) console.log( `in zone: self x: ${obj.x} y: ${obj.y} zone x: ${zones[i].x} y: ${zones[i].y} w: ${zones[i].width} h: ${zones[i].height} zone length: ${zones.length}`);
        obj.handleZone(zone);
      } 
    }
  }
  Land.prototype.handleCollides = function(obj){
    //if(debug) if(!obj.health) console.log('map handlecollides: obj cells: ' + obj.cells);
    //first check for world boundaries
    if(obj.xMin !== undefined) obj.handleBoundary();

    const grid = (obj.upperGround === true) ? this.gridUpper : this.gridUnder;
    const lastCheck = [];

    //check for collision with all objects in ocupied cells
    const cells = obj.cells;
    const gridH = this.gridW;
    let inhabs;
    for(let i = 0, length = cells.length; i < length; i++){
      inhabs = grid[Math.floor(cells[i]/gridH)][cells[i]%gridH];

      for(let j = 0, length = inhabs.length; j < length; j++){
        const inhab = inhabs[j];

        if(inhab.fID !== undefined) continue;//fires can not yet be the object of collide. they are subjects
        
        //no need to check twice the same obj.
        if(lastCheck[inhab.jID]) continue;
        lastCheck[inhab.jID] = true;

        if(inhab.jID === obj.jID) continue;//self don't count, don't worry about fire because they can't be the object here
        if(!inhab.passable && !(inhab.name && obj.name)) {//players pass each other
          //if(debug && obj.name) console.log('other upperGround: ' + inhabs[j].upperGround);
          //if(debug) console.assert(inhabs[j].upperGround === obj.upperGround);
          obj.handleCollide(inhab);//lastly handle if obj is not passable
        }
      }
    }
  }
  //return true if obj collide with any zone. todo. should differentiate ztypes
  Land.prototype.checkZones = function(obj){
    /*todo. ?? instead of randomly assign pos and check zones. 
    get an algorithm that plans out pos beforehand? or let objs adjust pos upon collision?*/
    
    const grid = (obj.upperGround === true) ? this.zoneGridUpper : this.zoneGridUnder;
    const lastCheck = [];//?? better way to prevent duplicate checking.

    //check for collision with all zones in ocupied cells
    const cells = obj.cells;
    const gridH = this.gridW;
    let inhabs;
    for(let i = 0, length = cells.length; i < length; i++){
      inhabs = grid[Math.floor(cells[i]/gridH)][cells[i]%gridH];
      
      for(let j  = 0, l = inhabs.length; j < l; j++){
        const inhab = inhabs[j];

        //no need to check twice the same zone
        if(lastCheck[inhab.zID]) continue;
        lastCheck[inhab.zID] = true;

        //rotated rec and other shapes are treated separately
        if(inhab.shape === Game.enums.Shape.rectangle && (inhab.angle % (PI / 2) > 0.1)){
          
          if(obj.shape === Game.enums.Shape.circle){
            
            //gives tilted rec some buffer area and use circle center to estimate collision
            if(helpers.recRotateCollidePoint(inhab.x, inhab.y, inhab.height + 100, inhab.width + 100, inhab.angle, obj.x, obj.y)){
              //if(debug) console.log(`checkZones: collide: inhab: x: ${inhab.x} y: ${inhab.y} h: ${inhab.height} w: ${inhab.width} angle: ${inhab.angle.toFixed(3)} j: ${j} obj: x: ${obj.x} y: ${obj.y}`);
              return true;
            } 

            //if(debug) console.log(`checkZones: no collide: inhab: x: ${inhab.x} y: ${inhab.y} h: ${inhab.height} w: ${inhab.width} angle: ${inhab.angle.toFixed(3)} j: ${j} obj: x: ${obj.x} y: ${obj.y}`);
          } 
          //if not circle then as long as in the same grid as zone return true
          else return true;
        }
        else if(obj.checkCollide(inhab)) return true;
      }
      
    }

    return false;

  }
  //simply returns if there's a collision, including world bound. used in obstacle generation
  Land.prototype.checkCollides = function(obj){//?? repeating from handlecollides. 
    
    if(obj.checkBoundary()) return true; 

    const grid = (obj.upperGround === true) ? this.gridUpper : this.gridUnder;
    const lastCheck = [];

    //check for collision with all objects in ocupied cells
    const cells = obj.cells;
    const gridH = this.gridW;
    let inhabs;
    for(let i = 0, length = cells.length; i < length; i++){
      inhabs = grid[Math.floor(cells[i]/gridH)][cells[i]%gridH];

      for(let j = 0, length = inhabs.length; j<length; j++){
        const inhab = inhabs[j];

        //no need to check twice the same obj. fires should not exist when this function is called
        if(debug) console.assert(inhab.jID !== undefined);
        if(lastCheck[inhab.jID]) continue;
        lastCheck[inhab.jID] = true;

        if(!inhab.passable && inhab.jID !== obj.jID){
          if(obj.checkCollide(inhab)) return true;
        } 
      }
    }

    return false;
  }
  //only checks obj center
  Land.prototype.checkWorldBoundary = function(obj){
    //todo. world boundary is different underground. ?? or should underground just have huge black blocks?
    return (obj.x >= 0 && obj.x < this.width && obj.y >= 0 && obj.y < this.height );
  }

  /**
   * Client only methods
   */
  //generate and save backgrounds/player maps as canvases to be drawn on to main canvas
	Land.prototype.render = function (obstacles) {//player map and obstacles belong to core, have to pass in

    const width = this.width;
    const cellSize = this.cellSize;
    const graphicCellSize = cellSize * this.graphicToLogic;

    //player map, generated by map but belongs to core
    const upperMap = document.createElement('canvas');//to be returned to core
    const ctxMini = upperMap.getContext('2d');

    //?? how to best handle scaling? what's actual size of player map? fixed or based on window size?
    const miniWidth = this.playerMapWidth;
    const miniScale = miniWidth / width;
    ctxMini.canvas.height = miniWidth;//square map that fits right into viewport
    ctxMini.canvas.width = miniWidth;
    const miniCellSize = (graphicCellSize * miniScale);
    //if(debug) console.log(`map render miniscale: ${miniScale} miniWidth: ${miniWidth}`);
    
    //?? should minibackground be an image from server to make it crisper? it's small anyway.
    //draw player background
    ctxMini.save();
    ctxMini.fillStyle = this.upperBackColor;
    ctxMini.fillRect(0, 0, miniWidth, miniWidth);
    
    //only upper zones
    this.zones.forEach(zone => {
      if(!zone.upperGround) return;
      zone.draw(ctxMini, 0, 0, miniScale);
    });

    //draw lines on top of zones
    ctxMini.save();
    ctxMini.strokeStyle = this.upperLineColor;
    ctxMini.globalAlpha = this.miniLineOpacity;
    ctxMini.lineWidth = this.miniLineWidth;
    ctxMini.beginPath();
		for (let x = 0; x < miniWidth; x += miniCellSize) {
      ctxMini.moveTo(x, 0);
			ctxMini.lineTo(x, miniWidth);
    }
    for (let y = 0; y < miniWidth; y += miniCellSize) {
      ctxMini.moveTo(0, y);
			ctxMini.lineTo(miniWidth, y);
    }
    ctxMini.stroke();
    ctxMini.closePath();
    ctxMini.restore();

    //obstacles are passed in, drawn as objects onto actual background each frame but permanent on player map
    obstacles.forEach(obj => {
      if(!obj.upperGround) return;//only upper ones
      //if(debug) console.log(`render obstacles: obstacles length: ${obstacles.size} x: ${obj.x} y: ${obj.y}`);
      obj.draw(ctxMini, 0, 0, miniScale);
    });

    return upperMap; //player map belongs to core
  }
	// draw the map background adjusted to camera
	Land.prototype.drawBackground = function (context, xView, yView, wView, hView, scale, upperGround, subGridX, subGridY, subGridXMax, subGridYMax) {
    
    //first paint back color
    context.fillStyle = upperGround ? this.upperBackColor : this.underBackColor;
    context.fillRect(0, 0, wView, hView);
    
    //draw relevant zones
    const gList = Game.enums.GList.zone;
    const grid = upperGround ? this.gridgUpper : this.gridgUnder;
    const drawn = [];

    //iterating occupied logic grid to get relevant obstacles to draw
    for(let i = subGridX; i < subGridXMax; i++){
      for(let j = subGridY; j < subGridYMax; j++){
        //if(debug && grid[i][j][gList].length > 0) console.log(`draw obstacles gridg[i][j] length: ${grid[i][j][gList].length} i: ${i} j: ${j} subgirdX: ${subGridX} subgridy: ${subGridY} subgirdXmax: ${subGridXMax} subgridymax: ${subGridYMax} `);

        //draw upper and under in the same loop
        if(debug && (!grid[i] || !grid[i][j])) console.log(`drawObstacles: grid: i: ${i} j: ${j}`);
        grid[i][j][gList].forEach(obj => {
          if(debug) console.assert(obj.zID !== undefined);
          if(drawn[obj.zID]) return;//if already drawn

          obj.draw(context, xView, yView, scale);
          drawn[obj.zID] = true;
        });
      }
    }

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

	Game.Land = Land;

})();
//Obstacle
(function(){
  function Obstacle(radius, width, height, x, y, angle, oID, oType, upperGround){//count is number of this obstacles on the map

    //if(debug) console.log('Obstacle construct: upperground: ' + upperGround);

    this.radius = radius;
    this.width = width;
    this.height = height;
    this.oType = oType;
    this.oID = oID;
    this.upperGround = upperGround;//for later fitting into the right portion of map

    this.parts = new Map();//physical components of this obstacle
    this.zones = [];//zones that have special effect when entered
    
    this.angle = angle;
    this.x = x;//certain pre agreed anchor coor
    this.y = y;

    this.healthPart;//if defined the entire obstacle changes size with a part's health
    //parts that change size need a minimum size when health is zero
    //this.baseSizeRatio = 0.5;
    //fixed minimum size for all objects
    this.baseWidth = 60;
    this.baseRadius = 30;

    //assemble different obstacles from different parts
    switch(this.oType){
      case(Game.enums.OType.tree):
      this.tree();
      break;
      
      case(Game.enums.OType.rock):
      this.rock();
      break;

      case(Game.enums.OType.house):
      this.house();
      break;

      case(Game.enums.OType.entrance):
      this.entrance();
      break;

      case(Game.enums.OType.bush):
      this.bush();
      break;

      case(Game.enums.OType.box):
      this.box();
      break;

      default:
      if(debug) console.log(' :: ERROR: obstacle construct no mathcing OType');
    
    }
    
    //if obstacle's size changes with health, set healthpart as the measuring stick of base size
    if(this.healthPart){
      const part = this.healthPart;
      const health = this.healthPart.health;
      if(part.shape === Game.enums.Shape.rectangle){
        //keep ratios to change obstacles size upon damage
        part.baseWidth = this.baseWidth;
        part.baseHeight = Math.round(part.baseWidth / part.width * part.height);
        part.widthToHealth = (part.width - part.baseWidth) / health;
        part.heightToHealth = (part.height - part.baseHeight) / health;
      }
      else if(part.shape === Game.enums.Shape.circle){
        //keep ratios to change obstacles size upon damage
        part.baseRadius = this.baseRadius;
        part.radiusToHealth = (part.radius - part.baseRadius) / health;
      }
    }
    //add bounds to all parts
    this.parts.forEach(part => {
      //oid is externally assigned
      part.oID = this.oID;
      part.xMin = this.xMin;
      part.xMax = this.xMax;
      part.yMin = this.yMin;
      part.yMax = this.yMax;
      part.upperGround = this.upperGround;
      part.angle = this.angle;//optimize. circle already pass in angle at constructions, just pass in angle at other shapes' construct too
      if(part.gList === undefined) part.gList = Game.enums.GList.obstacle;//some parts have specially assigned glists

      //if obstacle's size changes with health of a certain part
      if(this.healthPart && (part.opType !== this.healthPart.opType)){
        const health = this.healthPart.health;
        if(part.shape === Game.enums.Shape.rectangle){
          //keep ratios to change obstacles size upon damage
          part.baseWidth = Math.round(part.width / (this.healthPart.width || this.healthPart.radius * 2) * (this.healthPart.baseWidth || this.healthPart.baseRadius * 2));
          part.baseHeight = Math.round(part.baseWidth / part.width * part.height);
          part.widthToHealth = (part.width - part.baseWidth) / health;
          part.heightToHealth = (part.height - part.baseHeight) / health;
        }
        else if(part.shape === Game.enums.Shape.circle){
          //keep ratios to change obstacles size upon damage
          part.baseRadius = Math.round(part.radius / (this.healthPart.radius || this.healthPart.width / 2) * (this.healthPart.baseRadius || this.healthPart.baseWidth / 2));
          part.radiusToHealth = (part.radius - part.baseRadius) / health;
        }
      }

      //parts are made for angle === 0. adjust them to actual angle
      //first flip height and width if necessary
      if((part.width !== undefined) && (part.width !== part.height)){//a circle or square has no resizing
        //if(debug) console.log('obstacles construct adjust parts angle not square: angle: ' + this.angle);
        if((Math.abs(this.angle - PI / 2) < 0.1) || (Math.abs(this.angle - 3 * PI / 2) < 0.1)){
          //if(debug) console.log(`obstacles construct adjust angled parts: x: ${part.x} y: ${part.y} w: ${part.width} h: ${part.height} angle: ${part.angle}`);
          [part.width, part.height] = [part.height, part.width];  
          if(this.healthPart) [part.widthToHealth, part.heightToHealth, part.baseWidth, part.baseHeight] = [part.heightToHealth, part.widthToHealth, part.baseHeight, part.baseWidth]
        } 
      }
      if(part.dx === undefined) return; //if part has no coor offset this is all the adjustment required
      
      let dx = 0;
      let dy = 0;
      if(Math.abs(this.angle - PI / 2) < 0.1) [dx, dy] = [-part.dy, part.dx];
      else if(Math.abs(this.angle - 3 * PI / 2) < 0.1) [dx, dy] = [part.dy, -part.dx];
      else if(Math.abs(this.angle - PI) < 0.1) [dx, dy] = [-part.dx, -part.dy];
      else if(this.angle === 0) [dx, dy] = [part.dx, part.dy];
      //else if(debug) console.log(' :: ERROR: obstacle reoriente: no matching angle: ' + this.angle);
      part.x = this.x + dx;
      part.y = this.y + dy;
    });
    //do the same to zones except zones don't need bounds since no collide
    this.zones.forEach(part => {
      //oid is externally assigned
      part.oID = this.oID;
      part.upperGround = this.upperGround;
      part.angle = this.angle;
      part.gList = Game.enums.GList.zone;

      //if obstacle's size changes with health of a certain part
      if(this.healthPart && (part.opType !== this.healthPart.opType)){
        const health = this.healthPart.health;
        if(part.shape === Game.enums.Shape.rectangle){
          //keep ratios to change obstacles size upon damage
          part.baseWidth = Math.round(part.width / (this.healthPart.width || this.healthPart.radius * 2) * (this.healthPart.baseWidth || this.healthPart.baseRadius * 2));
          part.baseHeight = Math.round(part.baseWidth / part.width * part.height);
          part.widthToHealth = (part.width - part.baseWidth) / health;
          part.heightToHealth = (part.height - part.baseHeight) / health;
        }
        else if(part.shape === Game.enums.Shape.circle){
          //keep ratios to change obstacles size upon damage
          part.baseRadius = Math.round(part.radius / (this.healthPart.radius || this.healthPart.width / 2) * (this.healthPart.baseRadius || this.healthPart.baseWidth / 2));
          part.radiusToHealth = (part.radius - part.baseRadius) / health;
        }
      }

      //parts are made for angle === 0. adjust them to actual angle
      //first flip height and width if necessary
      if((part.width !== undefined) && (part.width !== part.height)){//a circle or square has no resizing
        //if(debug) console.log('obstacles construct adjust parts angle not square: angle: ' + this.angle);
        if((Math.abs(this.angle - PI / 2) < 0.1) || (Math.abs(this.angle - 3 * PI / 2) < 0.1)){
          //if(debug) console.log(`obstacles construct adjust angled parts: x: ${part.x} y: ${part.y} w: ${part.width} h: ${part.height} angle: ${part.angle}`);
          [part.width, part.height] = [part.height, part.width];  

        } 
      }
      if(part.dx === undefined) return; //if part has no coor offset this is all the adjustment required
      
      let dx = 0;
      let dy = 0;
      if(Math.abs(this.angle - PI / 2) < 0.1) [dx, dy] = [-part.dy, part.dx];
      else if(Math.abs(this.angle - 3 * PI / 2) < 0.1) [dx, dy] = [part.dy, -part.dx];
      else if(Math.abs(this.angle - PI) < 0.1) [dx, dy] = [-part.dx, -part.dy];
      else if(this.angle === 0) [dx, dy] = [part.dx, part.dy];
      //else if(debug) console.log(' :: ERROR: obstacle reoriente: no matching angle: ' + this.angle);
      part.x = this.x + dx;
      part.y = this.y + dy;
    });
  }
  Obstacle.prototype.draw = function(context, xView, yView, scale, toggle){
    //todo. when drawing on player map use special mini sprites for different obstacles as a whole 

    if(!toggle){//normal graphics
      this.parts.forEach(part => {
        part.draw(context, xView, yView, scale);
      });
      return;
    }
    //else depends on oType
    switch(this.oType){
      case(Game.enums.OType.bush):
      //if(debug) console.log(`obstacle draw: bush toggled: oID: ${this.oID}`);
      let part = this.parts.get(Game.enums.OPType.bush);
      part.transparency = 0.5;//when bush toggles it becomes semi transparent
      part.draw(context, xView, yView, scale);
      return;

      default:
      if(debug) console.log(` :: ERROR :: obstacle draw: toggle: no matching oType`);
    }

    
  }
  //called when a part of obstacle changes stats return true if obstacle is dead
  Obstacle.prototype.update = function(part){

    //if part is not dead obstacle is not dead
    if(part.health > 0){
      //if part is health part obstacle changes size
      if(part === this.healthPart){
        const health = part.health;
        
        this.parts.forEach(obj => {
          if(obj.shape === Game.enums.Shape.circle){
            obj.radius = Math.round(health * obj.radiusToHealth) + obj.baseRadius;
            //if(debug) console.log(`obstacle update part: radius: ${obj.radius} optype: ${obj.opType} baseradius: ${obj.baseRadius} radiustohealth: ${obj.radiusToHealth}`);
          }
          else if(obj.shape === Game.enums.Shape.rectangle){
            obj.width = Math.round(health * obj.widthToHealth) + obj.baseWidth;
            obj.height = Math.round(health * obj.heightToHealth) + obj.baseHeight;
          }
        });
      }
      return false;
    }
    //else see if part's death affect obstacle based on optype
    if(debug) console.assert(part.opType !== undefined);
    switch(part.opType){
      case(Game.enums.OPType.house12):
      return false;

      default: 
      return true;
    }
  }

  Obstacle.prototype.tree = function(){

    //radius of trunk
    let radius = this.radius;
    
    //assemble a tree
    let trunk = new Game.Circle(radius, this.x, this.y, this.angle, false, 0.1);
    trunk.color = 'brown';
    trunk.opType = Game.enums.OPType.treeTrunk;
    trunk.gList = Game.enums.GList.treeCrown;//because obstacle's parts are drawn together, put them in same glist

    let crown = new Game.Circle(radius * 4, this.x, this.y, this.angle, true, undefined);
    crown.color = 'rgba(102, 204, 0, 0.5)';
    crown.opType = Game.enums.OPType.treeCrown;
    crown.gList = Game.enums.GList.treeCrown;

    //todo. colors should be sprites. but individual sprites or aggregate sprite? what about house with its furnitures? those need individual sprites

    this.parts.set(trunk.opType, trunk);
    this.parts.set(crown.opType, crown);

    this.healthPart = trunk;
  }
  Obstacle.prototype.rock = function(){

    let radius = this.radius;

    let rock = new Game.Circle(radius, this.x, this.y, this.angle, false, 0.3);
    rock.color = 'pink';
    rock.opType = Game.enums.OPType.rock;

    this.parts.set(rock.opType, rock);

    this.healthPart = rock;

    //if(debug) console.log(`rock construct: radius: ${radius} health: ${this.healthPart.health}`);
  }
  Obstacle.prototype.house = function(){

    let width = Math.round(this.width * 4 / 5);
    let height = Math.round(this.height * 2 / 3);
    let wh = Math.round(width / 2);
    let hh = Math.round(height / 2);

    let dx;
    let dy;
    //todo. x and y also need to change to accomodate pre-set space. but house should be a complex anyway
    let part1 = new Game.Rectangle(width, height, this.x, this.y, false, 0.3);
    part1.color = 'green';
    part1.opType = Game.enums.OPType.house11;

    dx = wh;
    dy = hh;
    let part2 = new Game.Rectangle(wh, hh, this.x + dx, this.y + dy, false, 0.2);
    part2.color = 'orange';
    part2.dx = dx;
    part2.dy = dy;
    part2.opType = Game.enums.OPType.house12;

    dx = -wh;
    dy = hh;
    let part3 = new Game.Rectangle(wh - 10, hh - 10, this.x + dx, this.y + dy, true, undefined);
    part3.color = 'brown';
    part3.dx = dx;
    part3.dy = dy;
    part3.opType = Game.enums.OPType.house13;

    this.parts.set(part1.opType, part1);
    this.parts.set(part2.opType, part2);
    this.parts.set(part3.opType, part3);
    
  }
  Obstacle.prototype.entrance = function(){
    //testing
    let width = this.width;
    let height = this.height;
    
    let zone = new Game.Rectangle(width, height, this.x, this.y, true, undefined);
    zone.angle = this.angle + PI / 3;
    zone.color = 'yellow';
    zone.zType = Game.enums.ZType.entrance;

    this.zones.push(zone);
  }
  Obstacle.prototype.bush = function(){
    const radius = this.radius;
  
    const zone = new Game.Circle(radius, this.x, this.y, this.angle, true, undefined);
    zone.color = 'rgba(255,0,0, 0)';//hiding zone is invisible
    zone.zType = Game.enums.ZType.hiding;

    this.zones.push(zone);
    
    //hiding places are indestructible
    const bush = new Game.Circle(radius, this.x, this.y, this.angle, true, undefined);
    bush.color = 'rgba(0,102,110, 1)';
    bush.opType = Game.enums.OPType.bush;

    this.parts.set(bush.opType, bush);
    this.healthPart = bush;    
  
  }
  Obstacle.prototype.box = function(){

    const box = new Game.Rectangle(this.width, this.height, this.x, this.y, false, -1);
    box.color = 'rgb(110, 30, 0)';
    box.opType = Game.enums.OPType.box;

    this.parts.set(box.opType, box);
    this.healthPart = box;

  }


  Game.Obstacle = Obstacle;
})();

//Complex
(function(){

  function Complex(x, y, angle, cType, upperGround, oidCreator){

    this.x = x;
    this.y = y;
    this.angle = angle;
    this.upperGround = upperGround;
    this.oidCreator = oidCreator;//for the obstacles in complex, binded to gamecore

    this.zones = [];
    this.obstacles = [];
    this.parts = [];//objects that are not independent obstacles

    //ctype specific params
    this.bushFenceWidth = 200;
    this.bushFenceWidthCount = 3;

    switch(cType){
      case(Game.enums.CType.bushFence):
      this.bushFence();
      break;

      default:
      if(debug) console.log(`complex construct: no matching cType: ${cType}`);
    }

    this.oidCreator = null;
  }

  Complex.prototype.bushFence = function(){

    const radius = Math.round(this.bushFenceWidth / this.bushFenceWidthCount / 2);

    this.obstacles.push(new Game.Obstacle(radius, undefined, undefined, this.x - ((this.bushFenceWidthCount - 1) * radius), this.y - ((this.bushFenceWidthCount - 1) * radius), 0, this.oidCreator(), Game.enums.OType.bush, this.upperGround));
    this.obstacles.push(new Game.Obstacle(radius, undefined, undefined, this.x - ((this.bushFenceWidthCount - 3) * radius), this.y - ((this.bushFenceWidthCount - 1) * radius), 0, this.oidCreator(), Game.enums.OType.bush, this.upperGround));
    this.obstacles.push(new Game.Obstacle(radius, undefined, undefined, this.x - ((this.bushFenceWidthCount - 5) * radius), this.y - ((this.bushFenceWidthCount - 1) * radius), 0, this.oidCreator(), Game.enums.OType.bush, this.upperGround));
  }

  Game.Complex = Complex;
})();

//Terrian
(function(){

  function Terrian(xMin, yMin, xMax, yMax, tType, generator, upperGround){
    
    //boundary of this terrian. usually just the entire map
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = yMin;
    this.yMax = yMax;
    this.tType = tType;
    this.upperGround = upperGround;//for later fitting into the right portion of map

    this.zones = [];//terrians only have zones. 

    //?? should generator be saved? the order of calling matters, safer to pass
    this.generator = generator;//pseudorandom num for convenience. should be nullified by map once location is set

    //terrian specific parameters put toether for maintainability
    this.riverWidthMin = 200;
    this.riverBranchCount = 0;
    this.riverBranchLimit = 8;
    this.riverAngleRange = PI / 10;
    this.riverBranchAngleRange = PI / 4;
    this.riverBranchProbability = 0.05;

    switch(this.tType){//different terrians are differently generated
      case(Game.enums.TType.river):
      this.river();
      break;
      
      default:
      if(debug) console.log(` ::ERROR : Terrian construct: no matching ttype`);
    }

  }

  /** ??. todo. for branching. multiple terrian rivers or one river that branches? 
    * both would have to check for intersecting water. 
    * one river has to separately handle branch intersection buffering.
    * but intersecting water check would be so slow though.
    * 
  */
  Terrian.prototype.river = function(){

    //random assign a point of crossing of the river. 
    //But crossing need to be close to middle, so adjust the bound for crossing
    let xPad = Math.round((this.xMax - this.xMin) / 4);
    let yPad = Math.round((this.yMax - this.yMin) / 4);
    let xMin = this.xMin + xPad;
    let xMax = this.xMax - xPad;
    let yMin = this.yMin + yPad;
    let yMax = this.yMax - yPad;

    //fixed size of one river tile. ?? dynamic?
    let h = 400;
    let w = 800;

    //if adjustind result in min > max then reverse
    if(xMin >= xMax) [xMin, xMax] = [this.xMin, this.xMax];
    if(yMin >= yMax) [yMin, yMax] = [this.yMin, this.yMax];

    //point of crossing
    let x = Math.round(this.generator.random() * (xMax - xMin)) + xMin;
    let y = Math.round(this.generator.random() * (yMax - yMin)) + yMin;
    let angle = this.generator.random() * (PI);

    let tile = new Game.Rectangle(w, h, x, y, true, undefined);//river tile centered on crossing point
    tile.angle = angle;
    this.zones.push(tile);

    //recursively grow the river from tile0's two ends until reaching bound/sea
    this.addRiverTile(w, h, x, y, angle);
    this.addRiverTile(w, h, x, y, angle + PI);

    this.zones.forEach(zone => {
      zone.upperGround = this.upperGround;
      zone.color = 'aqua';//testing
      zone.zType = Game.enums.ZType.water;
      zone.gList = Game.enums.GList.zone;

    });

  }
  //todo. ??. optimize. Maximum call stack is sometimes reached with too many branches.
  Terrian.prototype.addRiverTile = function(w, h, x, y, angle){//decide what to do with next river tile

    //l and phi are distance and abs angle from center to corner
    const l = 0.5 * Math.sqrt(h * h + w * w);
    const phi = Math.atan2(h, w);

    //first get a far look ahead coor for estimating position
    const e = h * 4;//look ahead distance
    const xe = (Math.cos(angle) * e) + x;
    const ye = (Math.sin(angle) * e) + y;

    //if far look ahead is out of bound
    if(xe < this.xMin || xe > this.xMax || ye < this.yMin || ye > this.yMax){
      
      //?? not necessecary?. 
      //it's most likely time to end if look ahead landing pos is far enough out of bound
      //if((xe - this.xMin < -(e - w / 2)) || (xe - this.xMax > (e - w / 2)) || (ye - this.yMin < -(e - w / 2)) || (ye - this.yMax > (e - w / 2)))
      
      const theta1 = angle + phi;
      const theta2 = angle - phi;
      const xf1 = (Math.cos(theta1) * l) + x;//coors of two front corners
      const yf1 = (Math.sin(theta1) * l) + y;
      const xf2 = (Math.cos(theta2) * l) + x;
      const yf2 = (Math.sin(theta2) * l) + y;
      //if tile is indeed out of bound
      if( (xf1 <= this.xMin && xf2 <= this.xMin) || (yf1 <= this.yMin && yf2 <= this.yMin) || (xf1 >= this.xMax && xf2 >= this.xMax) || (yf1 >= this.yMax && yf2 >= this.yMax) ) return;
      //if tile is close but not out of bound then merge branch
      else return this.branchRiverTile(w, h, l, phi, x, y, angle, true);;
    } 
    //if(debug)console.log(`terrian addrivertile: xe: ${xe} ye: ${ye} xmin: ${this.xMin} xmax: ${this.xMax} ymin: ${this.yMin} ymax: ${this.yMax} `);
    //else lookahead is in bound then normal progression
    const branch = (h > this.riverWidthMin) && (this.generator.random() < this.riverBranchProbability);//chance of branching, and no branching if river's already too thin
    if(branch && this.riverBranchCount < this.riverBranchLimit) return this.branchRiverTile(w, h, l, phi, x, y, angle, false);
    else{//else continue normally
      const upTurn = Math.floor(this.generator.random() * 2);//randomly assign new upTurn
      return this.normalRiverTile(w, h, l, phi, x, y, angle, upTurn);
    }
  }
  Terrian.prototype.normalRiverTile = function(w, h, l, phi, x, y, angle, upTurn){
    //whxylphi are of the tile this tile is growing from. angle is direction to grow. upTurn decides which corner to anchor on

    //get coor of anchor corner
    const theta = (upTurn) ? angle + phi : angle - phi;
    const ya = (Math.sin(theta) * l) + y;
    const xa = (Math.cos(theta) * l) + x;

    //new tile's angle. ensure zigzag effect
    const aMin = upTurn ? angle - this.riverAngleRange : angle;
    const angle1 = this.generator.random() * this.riverAngleRange + aMin;

    //get new tile's coor
    const reverseAngle = upTurn ? (angle1 - phi) : (angle1 + phi);
    const y1 = (ya + Math.sin(reverseAngle) * l);
    const x1 = (xa + Math.cos(reverseAngle) * l);

    const tile = new Game.Rectangle(w, h, x1, y1, true, undefined);
    tile.angle = angle1;
    this.zones.push(tile);

    ///look ahead to decide to merge, end or continue and do so;
    return this.addRiverTile(w, h, x1, y1, angle1);
  }
  Terrian.prototype.branchRiverTile = function(w, h, l, phi, x, y, angle, mBranch){//mBranch means if this is merge branch or normal branch(angle difference)

    this.riverBranchCount++;//to have a limit on nubmer of branches

    //get coor of two front anchor corners
    const theta1 = angle + phi;
    const theta2 = angle - phi;
    const xf1 = (Math.cos(theta1) * l) + x;//1 = upturn
    const yf1 = (Math.sin(theta1) * l) + y;
    const xf2 = (Math.cos(theta2) * l) + x;//2 = downturn
    const yf2 = (Math.sin(theta2) * l) + y;

    //new tiles' angles depending on merge branch or normal branch
    let aMin1, aMin2, angle1, angle2;
    if(mBranch){//merge branch have small angles
      [aMin1, aMin2] = [angle - this.riverAngleRange, angle];
      angle1 = this.generator.random() * this.riverAngleRange + aMin1;
      angle2 = this.generator.random() * this.riverAngleRange + aMin2;
    }
    else{//normal branch has a big deviation
      [aMin1, aMin2] = [angle - this.riverBranchAngleRange, angle + this.riverBranchAngleRange];
      angle1 = this.generator.random() * this.riverBranchAngleRange + aMin1;
      angle2 = this.generator.random() * this.riverBranchAngleRange + aMin2;
    }

    //get new tile's coor
    const reverseAngle1 = (angle1 - phi);
    const y1 = (yf1 + Math.sin(reverseAngle1) * l);
    const x1 = (xf1 + Math.cos(reverseAngle1) * l);

    const reverseAngle2 = (angle2 + phi);
    const y2 = (yf2 + Math.sin(reverseAngle2) * l);
    const x2 = (xf2 + Math.cos(reverseAngle2) * l);

    //add tiles
    const tile1 = new Game.Rectangle(w, h, x1, y1, true, undefined);
    tile1.angle = angle1;
    this.zones.push(tile1);
    this.addRiverTile(w, h, x1, y1, angle1);

    //if normal branching the branch is narrower and intersection has "buffer"
    if(!mBranch){
      h = (this.generator.random() * h / 3 + h / 2);

      //todo. intersection buffer
    } 

    const tile2 = new Game.Rectangle(w, h, x2, y2, true, undefined);
    tile2.angle = angle2;
    this.zones.push(tile2);
    this.addRiverTile(w, h, x2, y2, angle2);
  }
    
    


  Game.Terrian = Terrian;
})();