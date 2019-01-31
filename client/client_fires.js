(function(){
  //fire constructor assigns fire details based on wtype
  function Fire(x, y, angle, player, wType, mx, my, traveled, holdRadius){
    
    if(debug) console.assert(player.pID !== undefined);
    Game.Gobject.call(this, x, y, undefined, angle, undefined, undefined, undefined);


    /*might or might not have based on type
    this.dmg;
    this.range;//for stopping when range limit's reached
    this.speed;
    this.traveled;
    this.life;

    */
    /*assigned based on type
    this.shape;
    this.hitOnce;//if fire disapears after one hit
    this.hurtOnce;//if fire only causes one time damage
    */

    //only for shoot or instant distant
    this.mx = mx;
    this.my = my;
    this.dx = mx - x;
    this.dy = my - y;
    this.dd = Math.sqrt(this.dx * this.dx + this.dy * this.dy);

    //for !hurtonce fires
    this.lastDmg;
    this.dmgInterval = 100;//magic number. the interval between successive dmg register

    this.fID;//fire id to be assigned by game core after construction. ?? needed on client side for removal? got to be a more elegant way to inform clients of fire removal
    this.player = player;
    this.pID = player.pID;//to know who killed who
    this.tID = player.tID;
    this.wType = wType;

    this.gList = Game.enums.GList.fire;
    this.upperGround = player.upperGround;
    this.viewers = [];//server only. store players who sees the fire for fast removal
    this.hit = [];//pIDs of hit objects for hitonce checking. todo. need more than pIDs.

    this.terminate = false; //0 means unrelated to time, -1 means to be removed, other positive numbers mean life time in millisecs
    this.lastTime = Date.now();

    //array that belongs to core that stores ids of objects who need to update stats
    this.toUpdateStatsObjects;//server only, externally assigned

    //wType specific functions
    this.onTravelEnd;

    //decide fire details based on WType
    //todo. add sprite
    switch(wType){
      case(Game.enums.WType.fist):
      this.dmg = 4;
      this.range = 500;
      this.speed = 400;
      this.shape = Game.enums.Shape.point;
      this.radius = 5;
      this.traveled = traveled || 0;
      this.hitOnce = true;
      this.hurtOnce = true;
      this.color = 0xff0000;//testing. should have sprite for bullets
      this.update = this.shootUpdate;
      break;

      case(Game.enums.WType.dagger):
      this.dmg = 8;
      this.range = 47;
      this.life = 200;
      this.shape = Game.enums.Shape.line;
      this.length = this.range;
      this.x2 = this.x + Math.cos(this.angle) * this.length;
      this.y2 = this.y + Math.sin(this.angle) * this.length;
      this.holdRadius = holdRadius;
      this.hitOnce = false;
      this.hurtOnce = true;
      this.color = undefined;//testing. because there's a default color for object and color is used to determine draw
      this.update = this.closeUpdate;
      break;

      case(Game.enums.WType.broadsword):
      this.dmg = 60;
      this.range = 62;
      this.life = 500;
      this.shape = Game.enums.Shape.circle;
      this.radius = this.range;
      this.x2 = this.x + Math.cos(this.angle) * this.length;
      this.y2 = this.y + Math.sin(this.angle) * this.length;
      this.holdRadius = holdRadius;
      this.hitOnce = false;
      this.hurtOnce = true;
      this.color = undefined;//testing
      this.update = this.closeUpdate;
      break;

      case(Game.enums.WType.fireball):
      this.dmg = 5;
      this.range = 200;
      this.speed = 100;
      this.shape = Game.enums.Shape.circle;
      this.radius = 35;
      this.traveled = traveled || 0;
      this.hitOnce = false;
      this.hurtOnce = false;
      this.color = 0xffa500;
      this.update = this.shootUpdate;
      break;

      case(Game.enums.WType.teleport):
      this.range = 300;
      this.speed = 1000;
      this.shape = Game.enums.Shape.point;
      this.radius = 25;
      this.traveled = traveled || 0;
      this.hitOnce = false;
      this.color = 0x33000000;
      this.update = this.shootUpdate;
      this.onTravelEnd = this.onTeleportTravelEnd;
      break;

      case(Game.enums.WType.snipeShot):
      this.dmg = 20;
      this.range = 1200;
      this.speed = 2500;
      this.shape = Game.enums.Shape.point;
      this.radius = 6;
      this.traveled = traveled || 0;
      this.hitOnce = true;
      this.hurtOnce = true;
      this.color = 0x00ffff;//testing. should have sprite for bullets
      this.update = this.shootUpdate;
      break;

      case(Game.enums.WType.machineGun):
      this.dmg = 4;
      this.range = 700;
      this.speed = 700;
      this.shape = Game.enums.Shape.point;
      this.radius = 4;
      this.traveled = traveled || 0;
      this.hitOnce = true;
      this.hurtOnce = true;
      this.color = 0xff0000;//testing. should have sprite for bullets
      this.update = this.shootUpdate;
      break;

      default:
      if(debug) console.log(` ::ERROR:: fire construct no matching wType: ${wType}`);

    }
  }

  Fire.prototype = Object.create(Game.Gobject.prototype);
  Fire.prototype.constructor = Fire;

  Fire.prototype.handleCollide = function(other){
    
    let othShape = other.shape;
    let collide = false;

    //if(debug) console.log('Fire handleCollide: this.fID: ' + this.fID + ' other shape: ' + othShape + ' other.pID: ' + other.pID);

    //check for actual collision depending on self and other shapes
    switch(othShape){

      //if other is rec
      case (Game.enums.Shape.rectangle):
        switch(this.shape){
          case (Game.enums.Shape.circle):
          if(helpers.recCollideCirc(other.x, other.y, other.height, other.width, this.x, this.y, this.radius)){
            collide = true;
          }break;
          case (Game.enums.Shape.point):
          if(helpers.pointCollideRec(this.x, this.y, other.x, other.y, other.height, other.width)){
            collide = true;
          }break;
          case (Game.enums.Shape.line):
          if(helpers.lineCollideRec(this.x, this.y, this.x2, this.y2, other.x, other.y, other.height, other.width)){
            collide = true;
          }break;
        }break;
      //if it's circle
      case (Game.enums.Shape.circle):
        switch(this.shape){
          case (Game.enums.Shape.circle): 
          if(helpers.circCollideCirc(other.x, other.y, other.radius, this.x, this.y, this.radius)){
            collide = true;
          }break;
          case (Game.enums.Shape.point):
          if(helpers.pointCollideCirc(this.x, this.y, other.x, other.y, other.radius)){
            collide = true;
          }break;
          case (Game.enums.Shape.line):
          if(helpers.lineCollideCirc(this.x, this.y, this.x2, this.y2, other.x, other.y, other.radius)){
            collide = true;
          }break;
        } break;

      //if other is point
      case (Game.enums.Shape.point):
      switch(this.shape){
        case (Game.enums.Shape.circle): 
        if(helpers.pointCollideCirc(other.x, other.y, this.x, this.y, other.radius)){
          collide = true;
        }break;
        case (Game.enums.Shape.point):
        if(helpers.pointCollidePoint(this.x, this.y, other.x, other.y)){
          collide = true;
        }break;
        case (Game.enums.Shape.line):
        //if(debug) console.log('fire handleCollide self: line, oth: point')
        if(helpers.pointCollideLine(other.x, other.y, this.x, this.y, (this.x + Math.cos(this.angle) * this.length), (this.y + Math.sin(this.angle) * this.length), this.length, this.angle)){
          collide = true;
        }break;
      }  break;

      //if other is line
      case (Game.enums.Shape.line):
      switch(this.shape){
        case (Game.enums.Shape.circle): 
        //if(debug) console.log('fire handleCollide self: circle, oth: line')
        if(helpers.lineCollideCirc(other.x, other.y, other.x2, other.y2, this.x, this.y, this.radius)){
          collide = true;
        }break;
        case (Game.enums.Shape.line):
        if(helpers.lineCollideLine(this.x, this.y, this.x2, this.y2, other.x, other.y, other.x2, other.y2)){
          collide = true;
        }break;
        case (Game.enums.Shape.point):
        //if(debug) console.log('fire handleCollide self: point, oth: line. oth: pID: ' + other.pID + ' health: ' + other.health + ' radius: ' + other.radius);
        if(helpers.pointCollideLine(this.x, this.y, other.x, other.y, (other.x + Math.cos(other.angle) * other.length), (other.y + Math.sin(other.angle) * other.length), other.length, other.angle)){
          collide = true;
        }break;
      }  break;
    }
    //handle collision if collide
    if(!collide) return;
    if(debug) console.assert(!other.passable);//passables should not be passed in

    if(other.health && this.dmg) this.handleDmgCollide(other);//do dmg if appropriate
    if(this.wType === Game.enums.WType.teleport && other.oID !== undefined) this.onTravelEnd();//if teleport only obstacle collision count
  
  }

  //WType specific collision handling
  Fire.prototype.handleDmgCollide = function(other){
    if(this.terminate) return;//terminate is decided and handled outside of this funciton.
    if(this.hitOnce) this.terminate = true;//kill fire if hitonce
    if(other.tID === this.tID) return;//don't hurt if on the same team. obstacles don't have tid

    //if(debug) console.log('fire: hitonce: ' + this.hitOnce + ' hurtOnce: ' + this.hurtOnce + ' passable: ' + this.passable + ' hit: ' + this.hit);
    //if(debug) console.log('fire handle character collide: this tID: ' + this.tID + ' other tID: ' + other.tID);
    
    //if already handled this obj's dmg, don't hit multiple times
    if(!this.hitOnce && this.hurtOnce){
      if(this.hit.includes(other.jID)) return;
      else this.hit.push(other.jID);
    }
    //don't register dmg if !hurtonce and time lapse is smaller than dmginterval
    if(!this.hurtOnce){
      if(Date.now() - this.lastDmg < this.dmgInterval) return;
      else this.lastDmg = Date.now();
    } 

    //register dmg
    other.dmgs.push({pID: this.pID, dmg: this.dmg, wType: this.wType});
    
    //if dmg is registered and other is not a player, need to put it on update stats list
    if(other.name === undefined){
      if(debug) console.assert(other.jID !== undefined);//should only have objs
      //if(debug) console.log('fire hits obj: fId: ' + this.fID + ' other.jid: ' + other.jID + ' other.health: ' + other.health);   

      this.toUpdateStatsObjects.push(other.jID);//tell core to update other's stats
    }

    //if(debug) console.log('fire hits obj: fId: ' + this.fID + ' other.jid: ' + other.jID + ' other.health: ' + other.health);   
    //if(debug) console.log(' other dmgs: ' + other.dmgs);
  }
  Fire.prototype.onTeleportTravelEnd = function(){
    this.terminate = true;
    this.player.x = this.x;
    this.player.y = this.y;

    //if(debug) console.log(`teleport travel end: player: x: ${this.player.x} y: ${this.player.y}`);
  }

  Fire.prototype.shootUpdate = function(t){//time: update time in milliseconds

    //fshoot life is unrelated to time but to travel distance
    if(this.traveled > this.range){
      if(this.onTravelEnd) this.onTravelEnd();
      this.terminate = true;//indicate the object should dissapear now. 
      return;
    }

    const step = (t - this.lastTime) / 1000; //convert to seconds from milliseconds
    this.lastTime = t;
    const d = (this.speed * step);

    
    //use target coor to be more precise and fast. 
    const ratio = d / this.dd;
    this.x += Math.round(this.dx * ratio);
    this.y += Math.round(this.dy * ratio);
    

    //if(debug) console.log('fire update: this.traveled: ' + this.traveled + ' range: ' + this.range + ' step: ' + step);
    //if(debug) console.log('fire update fID: ' + this.fID + ' x: ' + this.x + ' y: ' + this.y + ` mx: ${this.dx} my: ${this.dy}`);
    //this.move(this.angle, d, true); 

    this.traveled += Math.round(d);//traveled is only used for termination so keep it integer
  }  
  Fire.prototype.closeUpdate = function(t){//time: update time in milliseconds
    //if(debug) console.log('FClose update');
    //fclose's termination is related to time
    if(t - this.lastTime > this.life){
      //if(debug) console.log('fclose update: terminate: t: ' + t + ' lastTime: ' + this.lastTime + ' interval: ' + (t-this.lastTime));
      this.terminate = true;//indicate the object should dissapear now. 
      return;
    }

    //update fire pos according to player pos
    //differentiate between left and right hand and find the coor of holding end of weapon optimize ?? a lot of computations each physics update
    let angle2 = this.holdRadius > 0 ? (this.player.angle - PI / 2) : (this.player.angle + PI / 2);
    this.x = Math.round(Math.cos(angle2) * Math.abs(this.holdRadius)) + this.player.x;
    this.y = Math.round(Math.sin(angle2) * Math.abs(this.holdRadius)) + this.player.y;
    this.angle = this.player.angle;

    if(this.shape === Game.enums.Shape.line){//line also needs to update other end coor
      this.x2 = Math.round(this.x + Math.cos(this.angle) * this.length);
      this.y2 = Math.round(this.y + Math.sin(this.angle) * this.length);
    }
    //if(debug) console.log('fire update fID: ' + this.fID + ' x: ' + this.x + ' y: ' + this.y + ' range: ' + this.range + ' angle: ' + this.angle + ' dmg: ' + this.dmg);
  }

  Game.Fire = Fire
})();