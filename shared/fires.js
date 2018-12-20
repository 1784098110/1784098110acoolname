(function(){
  //fire constructor assigns fire details based on wtype
  function Fire(x, y, angle, player, wType, traveled, left, holdRadius){
    
    if(debug) console.assert(player.pID !== undefined);
    Game.Gobject.call(this, x, y, undefined, angle, undefined, undefined, undefined);

    this.wType = wType;
    this.gList = Game.enums.GList.fire;

    /*might or might not have based on type
    this.dmg;
    this.range;//for stopping when range limit's reached
    this.speed;
    this.traveled;
    this.life;
    */
    //assigned based on type
    this.shape;
    this.hitOnce;//if fire disapears after one hit
    this.hurtOnce;//if fire only causes one time damage

    this.fID;//fire id to be assigned by game core after construction. ?? needed on client side for removal? got to be a more elegant way to inform clients of fire removal
    this.player = player;
    this.pID = this.player.pID;//to know who killed who
    this.tID = this.player.tID;
    this.upperGround = this.player.upperGround;
    this.viewers = [];//server only. store players who sees the fire for fast removal
    this.hit = [];//pIDs of hit objects for hitonce checking. todo. need more than pIDs.

    this.terminate = false; //0 means unrelated to time, -1 means to be removed, other positive numbers mean life time in millisecs
    this.lastTime = Date.now();

    //array that belongs to core that stores ids of objects who need to update stats
    this.toUpdateStatsObjects;//server only, externally assigned

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
      this.color = 'red';//testing. should have sprite for bullets
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
      this.left = left;
      this.holdRadius = holdRadius;
      this.hitOnce = false;
      this.hurtOnce = true;
      this.color = undefined;//testing. because there's a default color for object and color is used to determine draw
      this.update = this.closeUpdate;
      break;

      case(Game.enums.WType.katana):
      this.dmg = 30;
      this.range = 62;
      this.life = 500;
      this.shape = Game.enums.Shape.circle;
      this.radius = this.range;
      this.x2 = this.x + Math.cos(this.angle) * this.length;
      this.y2 = this.y + Math.sin(this.angle) * this.length;
      this.left = left;
      this.holdRadius = holdRadius;
      this.hitOnce = false;
      this.hurtOnce = true;
      this.color = undefined;//testing
      this.update = this.closeUpdate;
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
    if(collide){
      if(other.health){//if other has health do dmg
        this.handleDmgCollide(other);
      }
      if(debug) console.assert(!other.passable);//passables should not be passed in
      if(this.hitOnce) this.terminate = true;//kill fire if hitonce
    }


  }
  Fire.prototype.handleDmgCollide = function(other){
    if(this.terminate) return;//terminate is decided and handled outside of this funciton.
    if(other.tID === this.tID) return;//don't hurt if on the same team. obstacles don't have tid

    //if(debug) console.log('fire: hitonce: ' + this.hitOnce + ' hurtOnce: ' + this.hurtOnce + ' passable: ' + this.passable + ' hit: ' + this.hit);
    //if(debug) console.log('fire handle character collide: this tID: ' + this.tID + ' other tID: ' + other.tID);
    
    //if already handled this obj's dmg, don't hit multiple times
    if(!this.hitOnce && this.hurtOnce){
      if(this.hit.includes(other.jID)) return;
      else this.hit.push(other.jID);
    }

    if(debug) console.assert(this.pID !== undefined);
    
    other.dmgs.push({pID: this.pID, dmg: this.dmg, wType: this.wType});//add dmg object to be processed by the receiver on its update
    
    if(other.name === undefined){//if other is not a player, need to put it on update stats list
      if(debug) console.assert(other.jID !== undefined);//should only have objs
      //if(debug) console.log('fire hits obj: fId: ' + this.fID + ' other.jid: ' + other.jID + ' other.health: ' + other.health);   

      this.toUpdateStatsObjects.push(other.jID);//tell core to update other's stats
    }

    //if(debug) console.log('fire hits obj: fId: ' + this.fID + ' other.jid: ' + other.jID + ' other.health: ' + other.health);   
    //if(debug) console.log(' other dmgs: ' + other.dmgs);
  }

  Fire.prototype.shootUpdate = function(t){//time: update time in milliseconds

    //fshoot life is unrelated to time but to travel distance
    if(this.traveled > this.range){
      this.terminate = true;//indicate the object should dissapear now. 
      return;
    }

    let step = (t - this.lastTime) / 1000; //convert to seconds from milliseconds
    this.lastTime = t;
    let d = (this.speed * step);

    //if(debug) console.log('fire update: this.traveled: ' + this.traveled + ' range: ' + this.range + ' step: ' + step);
    //if(debug) console.log('fire update fID: ' + this.fID + ' x: ' + this.x + ' y: ' + this.y);

    this.move(this.angle, d);
    this.traveled += Math.round(d);//traveled is only used for termination so keep it integer. or not??
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
    let angle2 = this.left ? (this.player.angle - PI / 2) : (this.player.angle + PI / 2);
    this.x = Math.round(Math.cos(angle2) * this.holdRadius) + this.player.x;
    this.y = Math.round(Math.sin(angle2) * this.holdRadius) + this.player.y;
    this.angle = this.player.angle;

    if(this.shape === Game.enums.Shape.line){//line also needs to update other end coor
      this.x2 = Math.round(this.x + Math.cos(this.angle) * this.length);
      this.y2 = Math.round(this.y + Math.sin(this.angle) * this.length);
    }
    //if(debug) console.log('fire update fID: ' + this.fID + ' x: ' + this.x + ' y: ' + this.y + ' range: ' + this.range + ' angle: ' + this.angle + ' dmg: ' + this.dmg);
  }

  //only called on client. 
  Fire.prototype.draw = function(context, xView, yView, scale){
    if(!this.color) return;//if fire has not graphics

    context.fillStyle = this.color;//TESTING
    context.beginPath();
    context.arc(this.x - xView, this.y - yView, this.radius, 0, 2*PI);
    context.fill();
    context.closePath();
  }

  Game.Fire = Fire
})();

(function(){
  function FClose(dmg, x, y, range, angle, life, left, holdRadius, player, wType, shape, hitOnce, hurtOnce, passable){
    Game.Fire.call(this, dmg, x, y, range, angle, player, wType, shape, hitOnce || false, hurtOnce, passable);

    //if(debug) console.log('fclose constructor');

    this.life = life;
    this.left = left;
    this.holdRadius = holdRadius;

  }

  FClose.prototype = Object.create(Game.Fire.prototype);
  FClose.prototype.constructor = FClose;



  //only called on client. 
  FClose.prototype.draw = function(context, xView, yView, scale){
    
    return;//close fires don't have own sprites(some might in the future)
    /*
    //draw a circle to visualize range.
    context.fillStyle = 'blue';//TESTING
    context.beginPath();
    context.arc(this.x - xView, this.y - yView, this.range, 0, 2*PI);
    context.fill();
    context.closePath();
    
    //draw line to visualize range
    context.save();
    context.translate(this.x - xView, this.y - yView);
    context.rotate(this.angle);
    context.strokeStyle = 'blue';
    context.beginPath();
    context.moveTo(0,0);
    context.lineTo(this.range, 0);
    context.stroke();
    context.restore();
    */

    //if(debug) console.log('fire draw: x: ' + this.x + ' y: ' + this.y + ' range: ' + this.range + ' angle: ' + this.angle);
  }

  Game.Fires.FClose = FClose;

})();

(function(){
  function FShoot(dmg, x, y, range, angle, speed, player, wType, shape, traveled, hitOnce, hurtOnce){
    Game.Fire.call(this, dmg, x, y, range, angle, player, wType, shape, hitOnce, hurtOnce);

    this.traveled = traveled || 0;//on server the new fire would have traveled 0. but on client it might be already created before it entered client's view
    this.speed = speed;//speed only applies to shoot fires
  }

  FShoot.prototype = Object.create(Game.Fire.prototype);
  FShoot.prototype.constructor = FShoot;

  FShoot.prototype.update = function(t){//time: update time in milliseconds

    //fshoot life is unrelated to time but to travel distance
    if(this.traveled > this.range){
      this.terminate = true;//indicate the object should dissapear now. 
      return;
    }

    let step = (t - this.lastTime) / 1000; //convert to seconds from milliseconds
    this.lastTime = t;
    let d = (this.speed * step);

    //if(debug) console.log('fire update: this.traveled: ' + this.traveled + ' range: ' + this.range + ' step: ' + step);
    //if(debug) console.log('fire update fID: ' + this.fID + ' x: ' + this.x + ' y: ' + this.y);

    this.move(this.angle, d);
    this.traveled += Math.round(d);//traveled is only used for termination so keep it integer. or not??
  }

  //only called on client. 
  FShoot.prototype.draw = function(context, xView, yView, scale){
    //only drawing a circle for now. should implement rendering optimization(pre render/ multi canvas) for complex objects
    context.fillStyle = 'red';//TESTING
    context.beginPath();
    context.arc(this.x - xView, this.y - yView, 5, 0, 2*PI);
    context.fill();
    context.closePath();
  }

  Game.Fires.FShoot = FShoot;
})();