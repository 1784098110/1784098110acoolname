(function(){

  function Effect(eType, player){
    //Variables if applicable: rate: amount per time interval, length: time effective
    this.eType = eType;
    this.player = player;

    this.startTime = Date.now();

    this.update;//called by character updatestats

    switch(eType){
    case(Game.enums.EType.invincible):
    //?? what if different lengths of invincible? assign after call? pass in additional arguments?
    this.length = 4000;//magic number. 
    this.update = this.invincibleUpdate;
    this.player.server_addToken(Game.enums.Token.invincible);
    break;
    
    }
  }

  Effect.prototype.invincibleUpdate = function(){
      if(Date.now() - this.startTime > this.length){
        //delete associated token
        this.player.server_removeToken(Game.enums.Token.invincible);
        //delete effect from player effects list by returning true
        return true;
      } 

      return false;//return true if time to terminate else false
  }


  Game.Effect = Effect;
})();