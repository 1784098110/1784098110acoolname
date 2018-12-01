
//Weapon
(function(){
  function Weapon(cool, dmg, range, spriteCount, name){
    Game.Tool.call(this, cool);
    
    this.dmg = dmg;
    this.range = range;
    this.wType = Game.enums.WType[name];

    //if(debug) console.log('Weapon Constructor: wtype passed in: ' + wType);

    this.name = name;
    this.spriteIndex = 0;//for animation
    this.spriteCount = spriteCount;

    //?? should this be constant across weapons?
    this.holdRadius = 15;//how far is the weapon's end from player(circle)'s center on either sides 

    this.firing = false;//is this a necessary property ?? repetitive of cool?
    this.player;
    this.left;//whether this weapon is on left hand. for deciding firing position
  }

  Weapon.prototype = Object.create(Game.Tool.prototype);
  Weapon.prototype.constructor = Weapon;

  //client only, add necessary graphic stats
  Weapon.prototype.addGraphic = function(sprite, scale, drawXScale, drawYScale){
    //todo. these stats should be different for different weapon. put sprite stats under sprite object and pass in as one to make it cleaner?
    //client only. undefined on server
    this.sprite = sprite;
    
    if(this.sprite){
      this.spriteWidth = this.sprite.width / this.spriteCount;//size of actual sprite before scale
      this.spriteHeight = this.sprite.height;
      this.scale = scale; //dynamically scale based on image size when rendered. ?? better way to scale?
      this.drawWidth = Math.round(this.spriteWidth*this.scale);//size of rendered weapons on screen
      this.drawHeight = Math.round(this.spriteHeight*this.scale);
      this.drawX = Math.round(this.drawWidth * drawXScale);//where on the sprite is the origin (point of holding)
      this.drawY = Math.round(this.drawHeight * drawYScale);
    }
  }
  Weapon.prototype.equip = function(player, left){
    //if(debug) console.log('weapon equiped: pid: ' + player.pID);
    this.player = player;
    this.left = left;
    //if(debug) console.log('weapon equipped: this tID: ' + this.tID + ' player tID: ' + player.tID);
  }
  Weapon.prototype.fire = function(fire){
    this.firing = true;
    this.lastFire = Date.now();

    fire.upperGround = this.player.upperGround;//assign groundlevel
    return fire;
  }
  //update sprite index
  Weapon.prototype.updateGraphics = function(){
    if(this.firing){
      if(++this.spriteIndex >= this.spriteCount){
        this.spriteIndex = 0;
        this.firing = false;
      }
    }
  }
  Weapon.prototype.draw = function(context){
    if(!this.sprite) return;

    //x is the position of the weapon's end relative to center of player
    //canvas should be transformed to rotated to player's pos a orientation

    let x = this.left ? (this.holdRadius) : (-this.holdRadius);

    //if(debug) console.log('Draw Sprite: sprite width: ' + sprite.width + ' height: ' + sprite.height);

    //?? how to properly and systematically set the size of weapon actually drawn?
    let sprite = this.sprite;
    let width = this.spriteWidth;//optimize. too many assignments
    let height = this.spriteHeight;
    let drawWidth = this.drawWidth;
    let drawHeight = this.drawHeight;

    //if(debug) console.log('weapon draw: sprite.src: ' + (sprite.src !== undefined) + ' width: ' + width + ' height: ' + height + ' drawWidth: ' + drawWidth + ' drawHeight: ' + drawHeight + ' drawX: ' + this.drawX + ' drawY: ' + this.drawY);
    
    context.drawImage(sprite, this.spriteIndex * width, 0, width, height, x - Math.round(drawWidth/2), 0 - this.drawY, drawWidth, drawHeight); //scale the sprite. all's rounded

  }
  Weapon.prototype.ready = function(){
  
    //if(debug) console.log('Weapon.ready: lastFire: ' + this.lastFire + ' now: ' + time + ' cool: ' + this.cool);

    return ((Date.now() - this.lastFire) > this.cool); //if weapon is cooling return nothing

  }

  Game.Weapon = Weapon;
})();

(function(){
  function WClose(cool, dmg, range, life, spriteCount, name){
    Game.Weapon.call(this, cool, dmg, range, spriteCount, name);

    this.life = life;
  }

  WClose.prototype = Object.create(Game.Weapon.prototype);
  WClose.prototype.constructor = WClose;

  WClose.prototype.fire = function(x1, y1, angle){//x1, y1, angle are player pos/angle

    //differentiate between left and right hand and find the coor of holding end of weapon
    let angle2 = this.left ? (angle - PI / 2) : (angle + PI / 2);
    let x = Math.round(Math.cos(angle2) * this.holdRadius + x1);
    let y = Math.round(Math.sin(angle2) * this.holdRadius + y1);
    
    //if(debug) console.log('wclose fire: x: ' + x + ' y: ' + y + ' x1: ' + x1 + ' y1: ' + y1);
    //if(debug) console.log('WClose Fire: left: ' + this.left + ' holdRadius: ' + this.holdRadius + ' height: ' + this.length + ' r: ' + r + ' angle1: ' + angle1 + ' angle2: ' + angle2 + ' x1: ' + x1 + ' y1: ' + y1 + ' x: ' + x + ' y: ' + y);
    
    //generate differente fire objects based on wtype
    let fire;
    switch(this.wType){
      case(Game.enums.WType.dagger)://?? can't just pass in shape, different shape need to inherit from different classes. best solution
      fire = new Game.Fires.FClose(this.dmg, x, y, this.range, angle, this.life, this.left, this.holdRadius, this.player, this.wType, Game.enums.Shape.line);
      break;

      case(Game.enums.WType.katana)://?? can't just pass in shape, different shape need to inherit from different classes. best solution
      fire =  new Game.Fires.FClose(this.dmg, x, y, this.range, angle, this.life, this.left, this.holdRadius, this.player, this.wType, Game.enums.Shape.circle);
      break;

      default:
      if(debug) console.log(' :: ERROR: Weapon.Fire no matching wType: this.wtype: ' + this.wType);
      
    }
    return Game.Weapon.prototype.fire.call(this, fire);//pass fire to common processing
  }

  Game.Weapons.WClose = WClose;
})();

(function(){
  function WShoot(cool, dmg, range, speed, length, spriteCount, name){
    Game.Weapon.call(this, cool, dmg, range, spriteCount, name);

    this.length = length;//length of weapon to determine fire spawn position. ?? messy. bette way?
    this.speed = speed;//bullet speed
  }

  WShoot.prototype = Object.create(Game.Weapon.prototype);
  WShoot.prototype.constructor = WShoot;

  WShoot.prototype.fire = function(x1, y1, angle){//x1, y1, angle are player pos/angle

    //differentiate between left and right hand and find the coor of far end of weapon(at rest state)
    let r = Math.sqrt(this.holdRadius * this.holdRadius + this.length * this.length);
    let angle1 = Math.atan2(this.holdRadius, this.length);
    let angle2 = this.left ? (angle - angle1) : (angle + angle1);
    let x = Math.round(Math.cos(angle2) * r) + x1;
    let y = Math.round(Math.sin(angle2) * r) + y1;
    
    //if(debug) console.log('Weapon Fire: left: ' + this.left + ' holdRadius: ' + this.holdRadius + ' height: ' + this.length + ' r: ' + r + ' angle1: ' + angle1 + ' angle2: ' + angle2 + ' x1: ' + x1 + ' y1: ' + y1 + ' x: ' + x + ' y: ' + y);

    //generate differente fire objects based on wtype
    //?? optimize. differentiating between weapon classes when creating fire not necessary? since it's just passing in weapon params
    let fire;
    switch(this.wType){
      case (Game.enums.WType.fist):
      fire =  new Game.Fires.FShoot(this.dmg, x, y, this.range, angle, this.speed, this.player, this.wType, Game.enums.Shape.point);
      break;
      
      default:
      if(debug) console.log(' :: ERROR: Weapon.Fire no matching wType: this.wtype: ' + this.wType);
    }

    return Game.Weapon.prototype.fire.call(this, fire);//pass fire to common processing
  }

  Game.Weapons.WShoot = WShoot;
})();
