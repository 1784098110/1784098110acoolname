(function(){

  function Effect(eType, player){
    //Variables if applicable: rate: amount per time interval, length: time effective
    this.eType = eType;
    this.player = player;

    this.startTime = Date.now();

    this.update;//called by character updatestats

    //?? what if different effect variables? assign after call? pass in additional arguments?
    switch(eType){
    case(Game.enums.EType.invincible):
    this.length = 4000;//magic number. 
    this.update = this.invincibleUpdate;
    this.player.server_addToken(Game.enums.Token.invincible);
    break;

    case(Game.enums.EType.stealth):
    this.length = 8000;//magic number. 
    this.update = this.stealthUpdate;
    this.player.server_addToken(Game.enums.Token.stealth);
    this.oldSpeed = this.player.speed;
    this.player.speed *= 1.3;//magic number, sealth increases speed
    break;
    
    }
  }

  Effect.prototype.invincibleUpdate = function(){
      if(Date.now() - this.startTime > this.length){
        //delete associated token
        this.player.server_removeToken(Game.enums.Token.invincible, false);
        //delete effect from player effects list by returning true
        return true;
      } 

      return false;//return true if time to terminate else false
  }
  Effect.prototype.stealthUpdate = function(){
    //if stealth is already broken out by firing or time ran out
    if(!this.player.tokens.has(Game.enums.Token.stealth)){
      //revert back player speed
      this.player.speed = this.oldSpeed;

      //inform player that effect should be removed
      return true;
    }
    else if(Date.now() - this.startTime > this.length){
      //delete associated token. optimize. no need to remove if already removed
      this.player.server_removeToken(Game.enums.Token.stealth, false);

      //revert back player speed
      this.player.speed = this.oldSpeed;

      //inform player that effect should be removed
      return true;
    } 

    return false;//return true if time to terminate else false
}


  Game.Effect = Effect;
})();