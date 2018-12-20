//Tool
(function(){
  //cooltime is in milliseconds
  function Tool(wType){
    
    this.lastFire = 0;

    this.spriteIndex = 0;//for animation
    this.spriteCount;

    this.wType = wType;
    this.left;

    this.cool;
    this.holdRadius;
    this.length;

    this.fire;//method to be assigned based on wtype

    this.firing = false;//is this a necessary property ?? repetitive of cool?
    this.tID;
    this.player;

    //length is the distance between firing end and holding base
    //1 spriteCount means no sprite or unchanging sprite
    //addGraphic arguments: sprite, scale, drawXScale, drawYScale
    switch(wType){
      case(Game.enums.WType.fist):
      this.spriteCount = 1;
      this.cool = 200;
      this.length = 20;
      this.holdRadius = 15;
      this.addGraphic(Game.sprites[this.wType], 0, 0, 0);
      this.fire = this.shootFire;
      break;

      case(Game.enums.WType.katana):
      this.spriteCount = 8;
      this.cool = 1000;
      this.length = undefined;
      this.holdRadius = 15;
      this.addGraphic(Game.sprites[this.wType], 0.8, 0.5, 0.5);
      this.fire = this.closeFire;
      break;

      case(Game.enums.WType.dagger):
      this.spriteCount = 3;
      this.cool = 100;
      this.length = undefined;
      this.holdRadius = 15;
      this.addGraphic(Game.sprites[this.wType], 0.2, 0, 0);
      this.fire = this.closeFire;
      break;

      case(Game.enums.WType.fireball):
      this.spriteCount = 1;
      this.cool = 5000;
      this.length = 20;
      this.holdRadius = 0;
      this.addGraphic(Game.sprites[this.wType], 0.8, 0.5, 0.5);
      this.fire = this.fireballFire;
      break;

      case(Game.enums.WType.heal):
      this.spriteCount = 1;
      this.cool = 10000;
      this.length = undefined;
      this.holdRadius = 0;
      this.addGraphic(Game.sprites[this.wType], 0.8, 0.5, 0.5);
      this.fire = this.healFire;
      break;

      case(Game.enums.WType.stealth):
      this.spriteCount = 1;
      this.cool = 15000;
      this.length = undefined;
      this.holdRadius = 0;
      this.addGraphic(Game.sprites[this.wType], 0.8, 0.5, 0.5);
      this.fire = this.stealthFire;
      break;

    }
  }

  Tool.prototype.equip = function(player, left){
    this.player = player;
    this.tID = player.tID; 

    this.left = left;
  }
  Tool.prototype.ready = function(){
    
    //if(debug) console.log('Skill.ready: lastFire: ' + this.lastFire + ' now: ' + time + ' cool: ' + this.cool);

    return ((Date.now() - this.lastFire) > this.cool); //if skill is cooling return nothing
  }
  //client only, add necessary graphic stats, return if no sprite(server or just no sprite)
  Tool.prototype.addGraphic = function(sprite, scale, drawXScale, drawYScale){
    //?? put sprite stats under sprite object and pass in as one to make it cleaner?
    if(!sprite) return;
    //if sprite is not yet fetched. 
    if(!sprite.src){
      //sprite.waitlist.push([this, scale, drawXScale, drawYScale]);
    }
    
    //if(debug && !sprite.src) console.log(` ::ERROR:: addgraphic: sprite has no src yet. scale: ${scale}`);

    this.sprite = sprite;
    
    //size of one actual sprite (not the whole sprite sheet) before scale
    this.spriteWidth = this.sprite.width / this.spriteCount;
    this.spriteHeight = this.sprite.height;
    this.scale = scale; //dynamically scale based on image size when rendered. ?? better way to scale?
    this.drawWidth = Math.round(this.spriteWidth * this.scale);//size of rendered weapons on screen
    this.drawHeight = Math.round(this.spriteHeight * this.scale);
    this.drawX = Math.round(this.drawWidth * drawXScale);//where on the sprite is the origin (point of holding)
    this.drawY = Math.round(this.drawHeight * drawYScale);
  
  }
  //update sprite index
  Tool.prototype.updateGraphics = function(){

    //if(debug) console.log(`updateGraphic: wType: ${this.wType}`);

    if(this.firing){
      if(++this.spriteIndex >= this.spriteCount){
        this.spriteIndex = 0;
        this.firing = false;
      }
    }
  }
  Tool.prototype.draw = function(context){
    if(!this.sprite) return;

    //if(debug && this.wType === Game.enums.WType.dagger) console.log(`dagger draw: spriteIndex:${this.spriteIndex}`);

    //x is the position of the weapon's end relative to center of player
    //canvas should be transformed to rotated to player's pos a orientation

    const x = this.holdRadius ? (this.left ? (this.holdRadius) : (-this.holdRadius)) : 0;

    //?? how to properly and systematically set the size of weapon actually drawn?
    let width = this.spriteWidth;//optimize. too many assignments
    let height = this.spriteHeight;
    let drawWidth = this.drawWidth;
    let drawHeight = this.drawHeight;


    //if(debug) console.log('Draw Sprite: sprite width: ' + width + ' height: ' + height);
    //if(debug && this.wType === Game.enums.WType.dagger) console.log('weapon draw: sprite.src: ' + (this.sprite.src !== undefined) + ' width: ' + width + ' height: ' + height + ' drawWidth: ' + drawWidth + ' drawHeight: ' + drawHeight + ' drawX: ' + this.drawX + ' drawY: ' + this.drawY + ' spriteindex: ' + this.spriteIndex);
    
    context.drawImage(this.sprite, this.spriteIndex * width, 0, width, height, x - Math.round(drawWidth/2), 0 - this.drawY, drawWidth, drawHeight); //scale the sprite. all's rounded

  }
  
  //different fire methods for different tools
  //arguments: game, mouse x, mouse y(all relative to world)
  Tool.prototype.shootFire = function(game, mx, my){//optimize stored vaiables
    this.firing = true;
    this.lastFire = Date.now();

    const x1 = this.player.x;
    const y1 = this.player.y;
    const angle = this.player.angle;

    //differentiate between left and right hand and find the coor of far end of weapon(at rest state)
    let r = Math.sqrt(this.holdRadius * this.holdRadius + this.length * this.length);
    let angle1 = Math.atan2(this.holdRadius, this.length);
    let angle2 = this.left ? (angle - angle1) : (angle + angle1);
    let x = Math.round(Math.cos(angle2) * r) + x1;
    let y = Math.round(Math.sin(angle2) * r) + y1;
    
    //if(debug) console.log(`shootFire: x1:${x1} y1:${y1} angle:${angle} x:${x} y:${y} wType:${this.wType} left:${this.left}`);
    //if(debug) console.log('Weapon Fire: left: ' + this.left + ' holdRadius: ' + this.holdRadius + ' height: ' + this.length + ' r: ' + r + ' angle1: ' + angle1 + ' angle2: ' + angle2 + ' x1: ' + x1 + ' y1: ' + y1 + ' x: ' + x + ' y: ' + y);
    
    game.server_addFire(new Game.Fire(x, y, angle, this.player, this.wType, 0, undefined, undefined));
  }
  Tool.prototype.closeFire = function(game, mx, my){

    this.firing = true;
    this.lastFire = Date.now();

    const x1 = this.player.x;
    const y1 = this.player.y;
    const angle = this.player.angle;

    const angle2 = this.left ? (angle - PI / 2) : (angle + PI / 2);
    const x = Math.round(Math.cos(angle2) * this.holdRadius + x1);
    const y = Math.round(Math.sin(angle2) * this.holdRadius + y1);

    //if(debug) console.log(`closeFire: x1:${x1} y1:${y1} angle:${angle} x:${x} y:${y} wType:${this.wType} left:${this.left}`);

    game.server_addFire(new Game.Fire(x, y, angle, this.player, this.wType, undefined, this.left, this.holdRadius));
  }
  Tool.prototype.healFire = function(game, mx, my){
    const player = this.player;
    if(debug) console.log(`heal fired: pID: ${player.pID}`);
      
    player.health += 30;
    if(player.health > player.maxhHealth) player.health = player.maxhHealth;
  }

  Game.Tool = Tool;
})();