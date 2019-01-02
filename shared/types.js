'use strict';

//todo. make sure there's no memory leak!

/**
 * comment dictionary:
 * ?? means question;
 * todo means todo;
 * optimize means potential target of optimization;
 * debug means for debug only, can be muted later;
 * testing means for temporary testing, remember to delete;
 * change means code has to change (dependency changed etc)
 * delete means remember to delete after cleaning dependents
 * coupled means the code must change together with another code
 * suckme means to suck me
 */

window.Game = {Fires:{}, sprites:{}, enums:{}, Weapons: {}};

/*todo. how to handle code sharing for these js files? (below is game_core example)
//server side we set the 'game_core' class to a global type, so that it can use it anywhere.
if( 'undefined' != typeof global ) {
  module.exports = global.game_core = game_core;
}
*/

window.PI = 3.14159;

//enums
Game.enums = {
  //General
  Shape: Object.freeze({'custom': 0, 'rectangle':1, 'circle':2, 'line':3, 'point':4}),
  PState: Object.freeze({'dead':0, 'active':1, 'spectate':2, 'protect':3}),
  GOver: Object.freeze({'death': 0, 'teamWin': 1, 'teamLose': 2, 'playerWin': 3, 'playerLost':4}),
  GList: Object.freeze({'zone': 0, 'fire': 1, 'entity': 2, 'obstacle': 3, 'treeCrown': 4}),//optimize. ?? reduce number of glists?
  
  //Tool
  WType: Object.freeze({'fist':0, 'katana':1, 'dagger':2, 'machineGun':3, 'sniper':4, 'launcher':5, 'mine':6, 'fireball': 7, 'teleport': 8, 'heal': 9, 'invincible': 10, 'stealth': 11, 'relocate': 12, 'snipeShot': 13}),
  EType: Object.freeze({'invincible': 0, 'bleed': 1, 'heal': 2, 'entrance': 3, 'stealth': 4, 'box': 5}),
  Token: Object.freeze({'invincible': 0, 'stealth': 1, 'hide': 2}),

  //Land
  OType: Object.freeze({'tree': 0, 'rock': 1, 'house': 2, 'entrance': 3, 'bush': 4, 'box': 5}),
  OPType: Object.freeze({'treeTrunk': 0, 'treeCrown': 1, 'rock': 2, 'house11': 3, 'house12': 4, 'house13': 5, 'bush': 6, 'box': 7}),
  CType: Object.freeze({'bushFence': 0, 'rock': 1, 'house': 2, 'entrance': 3, 'bush': 4}),
  TType: Object.freeze({'river': 0, 'dessert': 1, 'swamp': 2, 'beach': 3}),
  ZType: Object.freeze({'plain': 0, 'water': 1, 'dessert': 2, 'snow': 3, 'entrance': 4, 'hiding': 5}),

};

//Gobject
(function(){
  function Gobject(x, y, shape, angle, passable, shield, health){
    
    //todo this.id = id; //only assign on server side

    //coordinate relative to world not canvas
    this.x = x;
    this.y = y;
    this.shape = shape;
    this.angle = angle || 0;
    this.passable = (passable === undefined) ? false : passable; 

    //undestructible objects have health and shield undefined
    if(health !== undefined){
      this.health = (shield === undefined) ? undefined : health; 
      this.maxHealth = health;//health is by default based on size and set by shapes
      this.shield = shield;
      this.dmgs = []; //damage received to be processed each iteration
    }
    
    //object specific boundary if applicable.
    this.xMin;
    this.xMax;
    this.yMin;
    this.yMax;

    //keep track of cell on map to optimize map update
    this._cellX;
    this._cellY;
    this._cellX2;//these two are only used by lines since they can rotate.
    this._cellY2;
    this.cells = [];//cells occupied on map
    this.cellsg = [];//cells occupied on graphic grid
    this.gList;//which list in each gridg cell to occupy to optimize grid iteration

    this.color = 'rgb(153, 0, 0)';//default color is maroon
    
    this.upperGround;//externally assigned
    /** 
     * obstacle part or zones only
     * this.opType;
     * this.sprite;
     * this.dx;
     * this.dy;
     * this.oID;
     * this.baseRadius;
     * this.radiusToHealth;
     * this.baseWidth;
     * this.widthToHealth;
     * this.baseHeight;
     * this.heightToHealth
     */

    /**
     * objects only:
     * this.jID;
     */

    /**
     * zones only
     * this.zID;
     * this.zType;
     */
    
  }

  //todo. for angle and distance movement should instead use destination point so as to avoid deviation due to rounding over time
  Gobject.prototype.move = function(angle, d, round){//both params are decimal, whole decides if to round to int or not
    //?? optimize. floor is causing rounding issues, but coor has to be rounded when drawn anyway. what to do?
    let dx = (Math.cos(angle) * d);
    let dy = (Math.sin(angle) * d);

    if(round){
      dx = Math.round(dx);
      dy = Math.round(dy);
    }

    //if(debug) console.log('object move: angle: ' + angle + ' d: ' + d + ' dx: ' + dx + ' dy: ' + dy);

    this.vAdd(dx, dy);
  }
  Gobject.prototype.faceDirection = function(x, y){
    //?? optimize?
    let angle = (Math.atan2(y - this.y, x - this.x));//?? is this causing waving and rounded fire angle?
    this.angle = angle;
  }
  Gobject.prototype.setBounds = function(xMin, yMin, xMax, yMax){
    //set movement limit on map
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = yMin;
    this.yMax = yMax;
  }
  //update stats like health based on dmgs received
  Gobject.prototype.updateStats = function(){
    if(debug) console.assert(this.name === undefined);
    //if(debug && this.oID !== undefined) console.log('Gobject JID: ' + this.jID + ' updateStats: health before update: ' + this.health);

    //process each dmg
    for(let i = 0, l = this.dmgs.length; i < l; i++){
      let dmgObj = this.dmgs[i];

      //deduct dmg from health ?? add shield for ordinary objects?
      let dmg = Math.round(dmgObj.dmg * (1 - this.shield));
      this.health -= dmg;
    }
    this.dmgs = [];
    //if(debug && this.oID !== undefined) console.log('Gobject jID: ' + this.jID + ' updateStats: health after update: ' + this.health);
  }

  Gobject.prototype.vAdd = function (x, y){
    this.x += x;
    this.y += y;
  }
  Gobject.prototype.checkBoundary = function(){

    if(this.xMin === undefined) return false;

    //testing. checkboundary would always return true for specified obj location and size. manually return false
    if(this.xMax === this.xMin || this.yMin === this.yMax) return false;

    //can't handle lines
    let width = this.width/2 || this.radius;
    let height = this.height/2 || this.radius;
		if (this.x - width < this.xMin) {
			return true;
		}
		if (this.y - height < this.yMin) {
			return true;
		}
		if (this.x + width > this.xMax) {
			return true;
		}
		if (this.y + height > this.yMax) {
			return true;
    }
    
    return false;
  }
  Gobject.prototype.handleBoundary = function (){//?? couple. repeating check boundary

    //if(debug) console.log('object handleboundary: xMax: ' + this.xMax);
    if(debug) console.assert(this.xMin !== undefined);

    //keep obj in obj specific boundary
    let width = this.width/2 || this.radius;
    let height = this.height/2 || this.radius;
		if (this.x - width < this.xMin) {
			this.x = width + this.xMin;
		}
		if (this.y - height < this.yMin) {
			this.y = height + this.yMin;
		}
		if (this.x + width > this.xMax) {
			this.x = this.xMax - width;
		}
		if (this.y + height > this.yMax) {
			this.y = this.yMax - height;
		}
  }


  Game.Gobject = Gobject;
})();

//Point
(function(){
  function Point(x, y){
    Game.Gobject.call(this, x, y, Game.enums.Shape.point, true, undefined, undefined);

    //Testing. 
    //purely for graphical purposes
    this.color = 'red';
    this.radius = 10;
  }

  Point.prototype = Object.create(Game.Gobject.prototype);
  Point.prototype.constructor = Point;

  //point is drawn as a small circle
  Point.prototype.draw = function(context, xView, yView){
    //simply drawing circle does not require turning
    context.fillStyle = this.color;
    context.beginPath();
		// convert player world's position to canvas position			
    context.arc(this.x-xView, this.y - yView, this.radius, 0, 2 * PI);
    context.fill();
    context.closePath();
  }

  Game.Point = Point;
})();

//Line
(function(){
  function Line(x, y, x2, y2, length, angle, passable){//x and y are one end of line. ?? do lines and points need shield param?
    Game.Gobject.call(this, x, y, Game.enums.Shape.line, angle, (passable === undefined) ? true : passable, undefined, undefined);
    
    //x2 and y2 or length and angle can be omitted but not both
    this.length = (length === undefined) ? Math.sqrt((x2 - x) * (x2 - x) + (y2 - y) * (y2 - y)) : length;
    if(angle === undefined) this.angle = Math.atan2(y2 - y, x2 - x);

    //coor of the other end
    this.x2 = (x2 === undefined) ? Math.round(x + Math.cos(angle) * length) : x2;
    this.y2 = (y2 === undefined) ? Math.round(y + Math.sin(angle) * length) : y2;

    //if(debug) console.log('line constructor: angle: ' + this.angle + ' x: ' + this.x + ' y: ' + this.y + ' x2: ' + this.x2 + ' y2: ' + this.y2);

    this.color = 'orange';//testing
  }

  Line.prototype = Object.create(Game.Gobject.prototype);
  Line.prototype.constructor = Line;

  Line.prototype.draw = function (context, xView, yView) {

    context.save();
    context.translate(this.x - xView, this.y - yView);
    context.rotate(this.angle);
    context.strokeStyle = this.color;
    context.beginPath();
    context.moveTo(0,0);
    context.lineTo(this.length, 0);
    context.stroke();
    context.restore();
    
  }   



  Game.Line = Line;
})();

//Rectangle
(function(){
  function Rectangle(width, height, x, y, passable, shield){//x and y are coor of center
    Game.Gobject.call(this, x, y, Game.enums.Shape.rectangle, 0, passable, shield, width * 2);//angle is always 0
    this.width = width;
    this.height = height;
  }

  Rectangle.prototype = Object.create(Game.Gobject.prototype);
  Rectangle.prototype.constructor = Rectangle;

  Rectangle.prototype.draw = function (context, xView, yView, scale) {//todo. handle scaling of window
    if(!scale) scale = 1;

    //if(debug && this.oID !== undefined) console.log('Rectangle.draw: x: ' + this.x + ' y: ' + this.y + ' w: ' + this.width + ' h: ' + this.height + ' angle: ' + this.angle + ' color: ' + this.color);
    if(debug) console.assert(this.color);
    
    context.fillStyle = this.color;

    if(this.jID !== undefined){//if it's an object it's not rotated
      const x = Math.round((this.x - xView) * scale);
      const y = Math.round((this.y - yView) * scale);
      const width = Math.round(this.width * scale);
      const height = Math.round(this.height * scale);

      context.fillRect((x - Math.round(width / 2)), (y - Math.round(height / 2)), width, height);   
      return;
    }
    
    //if rotated. separate variables because rotated can't round, for visual pleasantry. ?? should all of these not round?
    const x = ((this.x - xView) * scale);
    const y = ((this.y - yView) * scale);
    const width = (this.width * scale);
    const height = (this.height * scale);

    context.save();
    context.translate(x, y);
    context.rotate(this.angle);
    context.fillRect(-(width / 2), -(height / 2), width, height);
    context.restore();
  }

  //coupling. optimize. repeating with handlecollide. for handling can call checking first then pass again to handle to prevent repeat
  Rectangle.prototype.checkCollide = function(other){
    let othShape = other.shape;

    //if(debug) console.log('rectangle checkCollide: other shape: ' + othShape);
    switch(othShape){
      case Game.enums.Shape.rectangle://other is guaranteed to not be tilted rec
      return helpers.recCollideRec(this.x, this.y, this.height, this.width, other.x, other.y, other.height, other.width);
      break;

      case Game.enums.Shape.circle:
      return (helpers.recCollideCirc(this.x, this.y, this.height, this.width, other.x, other.y, other.radius));
      break;

      default: 
      if(debug) console.error('rec checkCollide: no shape match: othshape: ' + othShape );
    }   

    return false;
  }
  Rectangle.prototype.handleCollide = function(other){//other is guaranteed to not be self
    let othShape = other.shape;

    //if(debug) console.log('rectangle handleCollide: other shape: ' + othShape);
    switch(othShape){
      case Game.enums.Shape.rectangle:
        if(helpers.recCollideRec(this.x, this.y, this.height, this.width, 
          other.x, other.y, other.height, other.width)){
            return this.handleRecCollide(other);
          }
        break;
      case Game.enums.Shape.circle:
        if(helpers.recCollideCirc(this.x, this.y, this.height, this.width, 
          other.x, other.y, other.radius)){
            return this.handleCircCollide(other);
          }
        break;  
      default: 
        if(debug) console.error('rec handleCollide: no shape match');
    }   
  }
  //OPTIMIZE: handleRecCollide and circCollide can be combined 
  Rectangle.prototype.handleRecCollide = function(other){

    //if(debug) console.log('rec handleRecCollide');

    let dx = (this.width/2 + other.width/2 - Math.abs(other.x - this.x));
    let dy = (this.height/2 + other.height/2 - Math.abs(other.y - this.y));

    if(dy < dx){
      if(other.y < this.y){
        dy = dy;
      }
      else{
        dy = 0-dy;
      }
    }
    else{
      if(other.x < this.x){
        dx = dx;
      }
      else{
        dx = 0-dx;
      }
    }
    this.vAdd(dx, dy);
  }
  //change self coor to prevent overlap
  Rectangle.prototype.handleCircCollide = function(other){

    //if(debug) console.log('rec handleCircCollide');

    let dx = (this.width/2 + other.radius - Math.abs(other.x - this.x));
    let dy = (this.height/2 + other.radius - Math.abs(other.y - this.y));

    if(dy < dx){
      if(other.y < this.y){
        dy = dy;
      }
      else{
        dy = 0-dy;
      }
    }
    else{
      if(other.x < this.x){
        dx = dx;
      }
      else{
        dx = 0-dx;
      }
    }
    this.vAdd(dx, dy);
  }

  Game.Rectangle = Rectangle;
})();

//Circle
(function(){
  function Circle(r, x, y, angle, passable, shield){
    Game.Gobject.call(this, x, y, Game.enums.Shape.circle, angle, passable, shield, r * r / 20);//magic number. otherwise too much health
    this.radius = r;
  }
  Circle.prototype = Object.create(Game.Gobject.prototype);
  Circle.prototype.constructor = Circle;

  Circle.prototype.draw = function (context, xView, yView, scale) {

    if(!scale) scale = 1;

    const x = Math.round((this.x - xView) * scale);
    const y = Math.round((this.y - yView) * scale);
    const radius = Math.round(this.radius * scale);

    context.fillStyle = this.color;
    context.beginPath();
		// convert player world's position to canvas position			
    context.arc(x, y, radius, 0, 2 * PI);
    context.fill();
    context.closePath();

    //if(debug) console.log(`circle draw: x: ${x} y: ${y}`);
  }
  Circle.prototype.checkCollide = function(other){//other is always unpassable
    let othShape = other.shape;

    //if(debug) console.log('circle checkCollide: other shape: ' + othShape);

    switch(othShape){
      case Game.enums.Shape.rectangle:
      if(helpers.recCollideCirc(other.x, other.y, other.height, other.width, this.x, this.y, this.radius)){
        return true;
      }
      break;

      case Game.enums.Shape.circle:
      if(helpers.circCollideCirc(this.x, this.y, this.radius, other.x, other.y, other.radius)){
        return true;
      }
      break;

      case Game.enums.Shape.line:
      //if(debug) console.log('circ check Collide line');
      if(helpers.lineCollideCirc(other.x, other.y, other.x2, other.y2, this.x, this.y, this.radius)){
        return true;
      }

      default: 
        if(debug) console.error('circle checkCollide no shape match: othshape: ' + othShape);
    }
    
    return false;
  }
  Circle.prototype.handleCollide = function(other){//other is always unpassable

    //if(debug && (other.upperGround !== this.upperGround)) console.log('Circ handleCollide: other is not on the same groundLEvel');


    let othShape = other.shape;

    //if(debug) console.log('circle handleCollide: other shape: ' + othShape);

    //todo. handle cases when self is passable (player skills etc. ??)
    switch(othShape){
      case Game.enums.Shape.rectangle:
      if(helpers.recCollideCirc(other.x, other.y, other.height, other.width, 
        this.x, this.y, this.radius)){
          return this.handleRecCollide(other);
        }
      break;

      case Game.enums.Shape.circle:
      if(helpers.circCollideCirc(this.x, this.y, this.radius, 
        other.x, other.y, other.radius)){
          return this.handleCircCollide(other);
        }
      break;

      case Game.enums.Shape.line:
      //if(debug) console.log('circ handleCollide line');
      if(helpers.lineCollideCirc(other.x, other.y, other.x2, other.y2, this.x, this.y, this.radius)){
        return this.handleLineCollide(other);
      }

      default: 
        //if(debug) console.error('circle narrowCollide no shape match: othshape: ' + othShape);
    }   
  }
  //change self coor to prevent overlap
  Circle.prototype.handleLineCollide = function(other){
    
    //if(debug) console.log('Circ LineCollide');

    let x2 = this.x;
    let y2 = this.y;
    let r = this.radius;
    let x11 = other.x;
    let y11 = other.y;
    let x12 = other.x2;
    let y12 = other.y2;

    //get x y distance from ends of line to circ center and to each other
    let sx12 = x2 - x11;
    let sy12 = y2 - y11;
    let sx22 = x2 - x12;
    let sy22 = y2 - y12;
    let sx11 = x12 - x11;
    let sy11 = y12 - y11;
    //console.log('lineCollideCirc: sx12: ' + sx12 + ' sy12: ' + sy12 + ' sx11: ' + sx11 + ' sy11: ' + sy11 + ' sx22: ' + sx22 + ' sy22: ' + sy22);

    let mx, my;

    //first find u for further checking of collision type
    let u = (sx12 * sx11 + sy12 * sy11) / (sx11 * sx11 + sy11 * sy11);
    
    if(u >= 0 && u <= 1){//side collision
      let xi = x11 + u * (sx11);//coor of P
      let yi = y11 + u * (sy11);
      let dx = x2 - xi;//distance from circ center to P
      let dy = y2 - yi;
      let dr = r - Math.sqrt(dx * dx + dy * dy);
      let angle = Math.atan2(dy, dx);
      mx = Math.cos(angle) * dr;
      my = Math.sin(angle) * dr;
    }
    else if(sx12 * sx12 + sy12 * sy12 <= r * r){//covering end 1
      let dr = r - Math.sqrt(sx12 * sx12 + sy12 * sy12);
      let angle = Math.atan2(sy12, sx12);
      mx = Math.cos(angle) * dr;
      my = Math.sin(angle) * dr;
    }
    else{//covering end 2, must be (sx22 * sx22 + sy22 * sy22 <= r * r)
      let dr = r - Math.sqrt(sx22 * sx22 + sy22 * sy22);
      let angle = Math.atan2(sy22, sx22);
      mx = Math.cos(angle) * dr;
      my = Math.sin(angle) * dr;
    }
    
    this.vAdd(Math.round(mx), Math.round(my));//apply changes

    //if(debug) console.log('circ after lineCollide: x: ' + this.x + ' y: ' + this.y);

  }
  Circle.prototype.handleCircCollide = function(other){
    let dx = this.x - other.x;
    let dy = this.y - other.y;
    let d = other.radius + this.radius - Math.round(Math.sqrt(dx * dx + dy * dy));
    let angle = Math.atan2(dy, dx);
    this.move(angle, d, true);
  }
  Circle.prototype.handleRecCollide = function(other){

    //if(debug) console.log('circ recCollide');
    
    //save frequently used values
    let x1 = this.x;
    let y1 = this.y;
    let x2 = other.x;
    let y2 = other.y;
    let wh = other.width / 2;
    let hh = other.height / 2;
    let r = this.radius;

    //distance to move
    let hx = 0;
    let hy = 0;

    //circle distance to closest corner
    let dx = Math.abs(x2 - x1) - wh;
    let dy = Math.abs(y2 - y1) - hh;
    

    //distance of overlap. absolute value
    let ox = (r - dx);
    let oy = (r - dy);

    //straight vertical collision
    if(x1 >= (x2 - wh) && x1 <= (x2 + wh)){
      if(oy) hy += (y1 > y2) ? oy : -oy;
    }
    //straight horizontal collision
    else if(y1 >= (y2 - hh) && y1 <= (y2 + hh)){
      if(ox) hx += (x1 > x2) ? ox : -ox;
    }
    else{//else it's corner collision
      let dr = r - Math.sqrt(dx * dx + dy * dy);
      let angle = Math.atan2(dy, dx);//angle between circ center to corner
      let mx = Math.cos(angle) * dr;
      let my = Math.sin(angle) * dr;
    
      if(x1 < x2){
        hx = -mx;
      }
      else{
        hx = mx;
      }
      if(y1 < y2){
        hy = -my;
      }
      else{
        hy = my;
      }

      //if(debug) console.log('circ recCollide: hx: ' + hx.toFixed(3) + ' hy: ' + hy.toFixed(3) + ' dr: ' + dr.toFixed(3) + ' dx: ' + dx.toFixed(3) + ' dy: ' + dy.toFixed(3) + ' angle: ' + angle.toFixed(3));

    }

    //if(debug) console.log('circ recCollide: hx: ' + hx + ' hy: ' + hy);

    this.vAdd(Math.round(hx), Math.round(hy));
  }

  Game.Circle = Circle;
})();

//Character
(function(){
  function Character(health, speed, vision, tID, lWeapon, rWeapon, skill, color, name){
    Game.Circle.call(this, 25, 0, 0, 0, false, 0);//0 shield for now, add later on initcombatstats

    this.tID = tID;
    this.gList = Game.enums.GList.entity;

    //weapons and skill are type enums 
    this.lWeapon = new Game.Tool(lWeapon);
    this.lWeapon.equip(this, true);
    this.rWeapon = new Game.Tool(rWeapon);
    this.rWeapon.equip(this, false);
    this.skill = new Game.Tool(skill);
    this.skill.equip(this, undefined);

    //combat stats
    this.health = health;
    this.maxHealth = this.health;
    this.speed = speed;
    this.vision = vision;

    this.state;//initially undefined, active, daed, spectate etc.
    this.color = color;//todo. should also allow sprite(custom skin)
    this.name = name;
    this.killerID; //to be assigned when killed to remember killer

    //?? better way to tag zones. right now it's just clearing map each time them setting occupied zTypes to true. 
    this.zones = new Map();//zID for each type of occupied zone.
    this.effects = [];//buffs etc. update and terminate themselves
    this.tokens = new Map();//markers. todo. no need for map just set?
    //for server only to inform clients of token change
    this.addedTokens = [];
    this.removedTokens = [];

    this.initCombatStats();

    //if(debug) console.log("Character constructor: speed: " + this.speed + ' shield: ' + this.shield + ' vision: ' + this.vision);
    //OPTIMIZE - save speedDiag to variable so don't calculate speeddiag each time. how much difference would it make?
    
  }

  Character.prototype = Object.create(Game.Circle.prototype);
  Character.prototype.constructor = Character;

  //update personal stats like health based on dmgs received ?? combine with obj update stats?
  Character.prototype.updateStats = function(){

    //if(debug) console.log('Character updateStats: health before update: ' + this.health);
    
    //process effects
    for(let i = this.effects.length - 1; i >= 0; i--){
      //if return true means terminate
      if(this.effects[i].update()) this.effects.splice(i, 1);
    }

    //pass dmg processing if invincible
    if(!this.tokens.has(Game.enums.Token.invincible)){//optimize. inefficient to check map each time?
      for(let i = 0, l = this.dmgs.length; i < l; i++){
        let dmgObj = this.dmgs[i];
  
        //change dmg by shield level and deduct from health
        let dmg = Math.floor(dmgObj.dmg * (1 - this.shield));
        this.health -= dmg;
  
        //if killed, remember killer, player state later changed by game
        if(this.health <= 0) {
          this.killerID = dmgObj.pID;
          //if(debug) console.log('character killed by dmg: pID: ' + dmgObj.pID);
        }
      }
    }
    
    this.dmgs = [];  
  }

  //change combat stats based on player config
  Character.prototype.initCombatStats = function(){

    //speed changed by carrying weight
    this.speed -= helpers.getWeaponWeight(this.lWeapon.wType);
    this.speed -= helpers.getWeaponWeight(this.rWeapon.wType);

    //shield changed by weapon types
    this.shield += helpers.getShieldValue(this.lWeapon);
    this.shield += helpers.getShieldValue(this.rWeapon);
  }

  Character.prototype.checkZone = function(obj){
    let othShape = obj.shape;

    //if(debug) console.log('circle checkZone: obj shape: ' + othShape);

    switch(othShape){
      case Game.enums.Shape.rectangle:
      //rotated rec has different collision algorithm
      if(obj.angle !== 0) return(helpers.recRotateCollidePoint(obj.x, obj.y, obj.height, obj.width, obj.angle, this.x, this.y));
      else return(helpers.pointCollideRec(this.x, this.y, obj.x, obj.y, obj.height, obj.width));
      break;

      case Game.enums.Shape.circle:
      return (helpers.pointCollideCirc(this.x, this.y, obj.x, obj.y, obj.radius));
      break;

      default: 
        if(debug) console.error(' :: ERROR: character checkZone no shape match: othshape: ' + othShape);
    }
    return false;
  }
  //todo. find a better way to tag characters with their zone effects
  Character.prototype.handleZone = function(obj){
    //if(debug && obj.zType === Game.enums.ZType.entrance) console.log(`in entrance zone ${Date.now()}`);
    if(debug) console.assert(obj.zType !== undefined && obj.zID !== undefined);
    //if(debug && obj.zType === Game.enums.ZType.hiding) console.log(`handlezone: hiding zone: zID: ${obj.zID}`);

    let setZone = true;
    //some ztypes have special cases
    switch(obj.zType){
      case(Game.enums.ZType.hiding)://hiding places have to be larger than self
      if(obj.radius < this.radius || obj.width < this.radius * 2 || obj.height < this.radius * 2) setZone = false;
      break;

      case(Game.enums.ZType.entrance):
      this.upperGround = false;
      break;

    }
    if(setZone) this.zones.set(obj.zType, obj.zID);
  }

  //optimize. not really necessary if location is decided by coor
  //?? need map info for random spawn (boundary etc.), or let caller do it?
  Character.prototype.spawn = function(x, y){
    this.x = x;
    this.y = y;
  }
  Character.prototype.draw = function(context, xView, yView){//optimize. partially repeating circle draw.
    const angle = this.angle;

    //if(debug) console.log('entity.draw: pID: ' + this.pID + ' angle: ' + angle);

    context.save();
    //if(debug) console.log(this.x - xView, this.y - yView);
    context.translate(this.x-xView, this.y - yView); //convert player position to canvas postiion
    context.rotate(angle - PI/2);//to compensate for vertical weapon sprites, tweek the angle when drawing.

    //if in a bush etc. 
    if(this.zones.has(Game.enums.ZType.hiding) || this.tokens.has(Game.enums.Token.stealth)) context.globalAlpha = 0.6;

    //draw weapons
    this.lWeapon.draw(context); 
    this.rWeapon.draw(context);

    //draw player circle
    context.fillStyle = this.color;//testing
    context.beginPath();			
    context.arc(0, 0, this.radius, 0, 2 * PI);
    context.fill();
    context.closePath();

    //draw skill
    this.skill.draw(context);

    //draw token related graphics
    this.tokens.forEach((value, token) => {
      this.drawToken(context, token, value);
    });
    
    context.restore();
  }
  
  //?? awkward method. where should animation be updated?
  Character.prototype.updateGraphics = function(){
    //if(debug) console.log(`entity updategraphics`);
    this.lWeapon.updateGraphics();
    this.rWeapon.updateGraphics();
    this.skill.updateGraphics();
  }   

  //add and remove token are server only. client directly changes map
  Character.prototype.server_addToken = function(token){
    //need to account for token overlap, can't let an early one delete all of them together, so keep track of overlap count
    const count = this.tokens.get(token);

    //if don't have any inform clients, else increase overlap count
    if(!count){
      this.tokens.set(token, 1);
      this.addedTokens.push(token);
    } 
    else this.tokens.set(token, count + 1);
  }
  Character.prototype.server_removeToken = function(token, removeAll){
    const count = this.tokens.get(token);
    if(debug) console.assert(count);
    
    if(count === 1 || removeAll){//if only one left delete the entire thing or all overlaps are to be removed
      this.tokens.delete(token);
      this.removedTokens.push(token);
    }
    else this.tokens.set(token, count - 1);//else reduce overlap by one
    
  }
  //draw corresponding visual effect of a token on character
  Character.prototype.drawToken = function(context, token, value){
    //token is enum number ?? is value necessary?
    switch(token){
      case(Game.enums.Token.invincible):
      //if(debug) console.log(`character draw token: ${token}`);
      context.beginPath();
      context.strokeStyle = 'rgb(255, 215, 0)';
      context.lineWidth = 3;
      context.arc(0, 0, this.radius, 0, 2 * PI);
      context.stroke();
      break;
      
    }
  }

  Game.Character = Character;
})();


//Player
(function(){
  function Player(health, speed, vision, pID, tID, lWeapon, rWeapon, skill, color, name, viewW, viewH, game){
    Game.Character.call(this, health, speed, vision, tID, lWeapon, rWeapon, skill, color, name);
    this.pID = pID;

    this.instance; //websocket instance. todo. should it be initialized on construction? 
    this.playerConfig; //for other clients to create this player locally 

    this.inputs = [];
    this.last_input_seq;
    this.last_input_time; //in seconds
    
    //size of viewport
    this.viewW = viewW;
    this.viewH = viewH;

    //keep reference of the game player's in
    //this.game = game; todo. not needed?
    this.camera;//externally assigned. server only. to know what player sees

    //only used on server side; for determining what a client can see
    this.visibleFires = new Map();//server use only
    this.removedFires = [];//server only. temporarily store fires to remove then inform clients on server update

    /*todo. original game_player feature for "moving us around later" see if necessary to incorporate
    this.old_state = {pos:{x:0,y:0}};
    this.cur_state = {pos:{x:0,y:0}};
    this.state_time = new Date().getTime();
    */
    
  }

  Player.prototype = Object.create(Game.Character.prototype);
  Player.prototype.constructor = Player;

  //testing. replace with grid checking. or at least have good vision buffer
  //todo. vision should not be based on client window size(viewW,H), graphics should scale based on vision.
  //only used on server side for determining if a player can see another player or fires
  Player.prototype.sees = function(obj){
    if(debug) console.assert(obj.x !== undefined && obj.y !== undefined);
    if(debug) console.assert(this.viewW && this.viewH);
    
    let w = this.viewW / 2;
    let h = this.viewH / 2;

    //todo. this only works with small objects(no buffer area). 

    return (obj.x >= (this.x - w) && obj.x <= (this.x + w) && obj.y >= (this.y - h) && obj.y <= (this.y + h));
  }
  Player.prototype.updateVision = function(vision){
    if(debug) console.assert(this.viewW && this.viewH);
    let oldVision = this.vision;
    this.vision = vision;
    this.viewH = this.viewH / oldVision * this.vision;
    this.viewW = this.viewW / oldVision * this.vision;
  }

  //caller responsible for location
  Player.prototype.spawn = function(x, y){
    Game.Character.prototype.spawn.call(this, x, y);

    this.state = Game.enums.PState.active;
    this.upperGround = true;//players always spawn above ground
  }


  //right now only called on server side. client side would be different. todo
  Player.prototype.handleControls = function(controls, step){
    //step is time lapsed since last processed input in seconds
    const speedDiag = Math.round(Math.sqrt(this.speed * this.speed / 2));
    let dx = 0;
    let dy = 0;

    if (controls.left){
      if (controls.up || controls.down)
        dx -= speedDiag * step;
      else 
        dx -= this.speed * step;
    }
		if (controls.right){
      if (controls.up || controls.down)
        dx += speedDiag * step;
      else 
        dx += this.speed * step;
    }
		if (controls.up){
      if (controls.left || controls.right)
        dy -= speedDiag * step;
      else 
        dy -= this.speed * step;
    }
		if (controls.down){
      if (controls.left || controls.right)
        dy += speedDiag * step;
      else 
        dy += this.speed * step;
    }
    this.vAdd(Math.round(dx), Math.round(dy)); //apply coor change. optimize. rarely used little helper. 

    //change angle. controls mouse coor is based on canvas, add view coor 
    let xView = this.x - this.viewW/2;
    let yView = this.y - this.viewH/2;
    this.faceDirection(controls.mouseX + xView, controls.mouseY + yView); //mouse pos is relative to world

    //if(debug && (~~dx || ~~dy)) console.log('player handlecontrols: controls: ~~dx: ' + (~~dx) + ' ~~dy: ' + (~~dy) + ' x: ' + this.x + ' y: ' + this.y);

    //if(debug) console.log('player handlecontrols: lClick: ' + controls.lClick + ' rClick: ' + controls.rClick);
    
  }


  Player.prototype.handleServerUpdate = function(update){

    //if(debug) {console.log('player handleserverupdate: '); console.log(update);}

    //keep it simple for now. stats update should be on another slower loop
    this.x = update.x;
    this.y = update.y;
    
    this.angle = update.angle;

    this.lWeapon.spriteIndex = update.lWeaponSpriteIndex;
    this.rWeapon.spriteIndex = update.rWeaponSpriteIndex;
    this.skill.spriteIndex = update.skillSpriteIndex;

    this.health = update.health;

    //client add or remove token is completely decided by server
    update.addedTokens.forEach(token => {
      if(debug) console.assert(Number.isInteger(token));
      this.tokens.set(token, 1);
    });
    update.removedTokens.forEach(token => {
      this.tokens.delete(token);
    });
  }




  Game.Player = Player;
})();



//Camera
(function () {
  //optimize. x and y view can be calculated with player and canvas stats
	function Camera(canvasWidth, canvasHeight) {
    
    this.followed;//assigned with follow method

		// viewpo rt dimensions
		this.width = canvasWidth;
		this.height = canvasHeight;
    
    // distance from followed object to border before camera starts move
    this.xDeadZone = (this.width/2);
    this.yDeadZone = (this.height/2);

    // position of camera (left-top coordinate). assigned when following
		this.xView;
    this.yView;
  
    //client's actual window size. can change  ?? need separate from width and height?
    //this.viewWidth;
    //this.viewHeight;
    this.scale;//scale of graphics to actual size

    //bounds of viewport on graphic grid 
    this.subGridX;
    this.subGridY;
    this.subGridXMax;
    this.subGridYMax;
	}

	// gameObject needs to have "x" and "y" properties (as world(or room) position)
	Camera.prototype.follow = function (player, xDeadZone, yDeadZone) {
    this.followed = player;
    this.xDeadZone = xDeadZone || this.xDeadZone;
    this.yDeadZone = yDeadZone || this.yDeadZone;
    this.xView = this.followed.x - this.xDeadZone;
    this.yView = this.followed.y - this.yDeadZone;
  }
  //todo. all graphics should not be based on viewport size directly. should scale.
  Camera.prototype.setViewport = function(width, height) {
    this.width = width;
    this.height = height;
    this.scale = 1;//todo. when clien viewport size changes
  }
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