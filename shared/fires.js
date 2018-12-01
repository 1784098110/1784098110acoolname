
//Fire todo.if daggerfire moves as a projectile then it's moving independently of player. pass in player to account for its possition?
(function(){
  function Fire(dmg, x, y, range, angle, player, wType, shape, hitOnce, hurtOnce, passable){
    
    if(debug) console.assert(player.pID !== undefined);

    Game.Gobject.call(this, x, y, shape, angle, passable || true);

    this.wType = wType;
    this.gList = Game.enums.GList.fire;

    this.dmg = dmg;
    //for stopping when range limit's reached
    this.range = range;
    this.angle = angle;

    this.fID;//fire id to be assigned by game core after construction. ?? needed on client side for removal? got to be a more elegant way to inform clients of fire removal
    this.player = player;
    this.pID = this.player.pID;//to know who killed who
    this.tID = this.player.tID;
    this.viewers = [];//server only. store players who sees the fire for fast removal
    this.hit = [];//pIDs of hit objects for hitonce checking. todo. need more than pIDs.

    this.hitOnce = (hitOnce === undefined) ? true : hitOnce;//if fire disapears after one hit
    this.hurtOnce = (hurtOnce === undefined) ? true : hurtOnce;//if fire only causes one time damage

    this.terminate = false; //0 means unrelated to time, -1 means to be removed, other positive numbers mean life time in millisecs
    this.lastTime = Date.now();

    //todo. too inelegant way to give fire a shape. how???
    //give fire necessary attributes based on passed in shape since it can't just inherit the shape due to its dynamic shape
    switch(shape){
      case(Game.enums.Shape.circle):
        this.radius = this.range;
        break;
      case(Game.enums.Shape.rectangle):
        this.width = range;//todo. rec shape needs special passed in specs
        this.height = range;
        break;
      case(Game.enums.Shape.line):
        this.length = this.range;

        //store the other end of line for easy collision
        this.x2 = this.x + Math.cos(this.angle) * this.length;
        this.y2 = this.y + Math.sin(this.angle) * this.length;

        //if(debug) console.log('fire line constructor: angle: ' + this.angle + ' x: ' + this.x + ' y: ' + this.y + ' x2: ' + this.x2 + ' y2: ' + this.y2);

        break;
      case(Game.enums.Shape.point):
        this.radius = 10;
        this.point = true;
        break;
      default:
        console.log(' ::ERROR:: Fire Constructor: No matching Shape');
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

      //doesn't do anything when hit a rectangle for now
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

      //do nothing for now if it's another point
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

      //do nothing for now if it's a line
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
      if(other.shape === Game.enums.Shape.circle && other.health){//if other has health and is circle meaning character
        this.handleCharacterCollide(other);
      }
      else if(other.fID === undefined){//not a fire meaning it's a obstacle
        if(!other.passable && this.hitOnce) this.terminate = true;//so kill fire if it hits once
      }
    }


  }
  Fire.prototype.handleCharacterCollide = function(other){
    if(this.terminate) return;
    if(other.tID === this.tID) return;

    //if(debug) console.log('fire: hitonce: ' + this.hitOnce + ' hurtOnce: ' + this.hurtOnce + ' passable: ' + this.passable + ' hit: ' + this.hit);
    //if(debug) console.log('fire handle character collide: this tID: ' + this.tID + ' other tID: ' + other.tID);
    
    if(this.hitOnce) this.terminate = true;//disapears at collission if config says so. ?? should fire pass through teammates
    if(!this.hitOnce && this.hurtOnce){
      if(this.hit.includes(other.pID)) return;
      else this.hit.push(other.pID);
    } //todo. hurtonce is checking only pID, need to include AI etc.

    if(debug) console.assert(this.pID !== undefined);
    
    other.dmgs.push({pID: this.pID, dmg: this.dmg, wType: this.wType});//add dmg object to be processed by the receiver on its update
    
    //if(debug) console.log('fire hits character: fId: ' + this.fID + ' pid: ' + other.pID + ' other.health: ' + other.health);   
    //if(debug) console.log(' other dmgs: ' + other.dmgs);
  }

  Game.Fire = Fire;
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

  FClose.prototype.update = function(t){//time: update time in milliseconds
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

    //if(debug) console.log('fire update fID: ' + this.fID + ' x: ' + this.x + ' y: ' + this.y + ' range: ' + this.range + ' angle: ' + this.angle);

  }

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